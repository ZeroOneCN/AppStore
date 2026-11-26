import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { REGISTER_RATE_LIMIT } from "../infra/constants";
import { AppError } from "../infra/errors";
import { hashPassword } from "./auth.service";
import { getSiteSettings } from "./settings.service";
import { normalizeInviteCode } from "./invite-code.service";

/** 注册用户名规则，与开发者账号保持一致 */
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

/** 注册尝试计数：key 为客户端标识（IP） */
const attempts = new Map<string, { count: number; resetAt: number }>();

/** 内存计数上限 */
const MAX_TRACKED_KEYS = 5000;

/**
 * 检查注册尝试是否超限。
 * @param clientKey 客户端标识（IP）
 * @throws AppError 超过次数时抛出 RATE_LIMITED
 */
function assertNotRateLimited(clientKey: string): void {
  const record = attempts.get(clientKey);
  if (!record) return;
  if (Date.now() >= record.resetAt) {
    attempts.delete(clientKey);
    return;
  }
  if (record.count >= REGISTER_RATE_LIMIT.maxAttempts) {
    throw new AppError("RATE_LIMITED", "注册尝试过于频繁，请 15 分钟后再试");
  }
}

/**
 * 记录一次注册尝试，并清理过期计数。
 * @param clientKey 客户端标识（IP）
 * @returns 无
 */
function recordAttempt(clientKey: string): void {
  const now = Date.now();
  const record = attempts.get(clientKey);
  if (!record || now >= record.resetAt) {
    if (attempts.size >= MAX_TRACKED_KEYS) {
      for (const [key, item] of attempts) {
        if (now >= item.resetAt) attempts.delete(key);
      }
      while (attempts.size >= MAX_TRACKED_KEYS) {
        const oldest = attempts.keys().next().value;
        if (typeof oldest !== "string") break;
        attempts.delete(oldest);
      }
    }
    attempts.set(clientKey, { count: 1, resetAt: now + REGISTER_RATE_LIMIT.windowMs });
    return;
  }
  record.count += 1;
}

/**
 * 校验注册密码强度。
 * @param password 明文密码
 * @throws AppError 长度不合规时抛出 VALIDATION_FAILED
 */
function assertPassword(password: string): void {
  if (password.length < 8) throw new AppError("VALIDATION_FAILED", "密码至少 8 位");
  if (password.length > 64) throw new AppError("VALIDATION_FAILED", "密码不能超过 64 位");
}

/** 注册输入 */
export interface RegisterInput {
  username: string;
  displayName?: string;
  password: string;
  inviteCode?: string;
}

/**
 * 注册开发者账号：注册模式与邀请码均以数据库后台设置为准。
 * @param input 注册信息
 * @param clientKey 客户端标识（IP）
 * @returns 新建开发者与会话所需信息
 * @throws AppError 未开放注册、邀请码无效、用户名重复或参数不合规时抛出
 */
export async function registerDeveloper(
  input: RegisterInput,
  clientKey: string,
): Promise<{ id: string; username: string; displayName: string }> {
  assertNotRateLimited(clientKey);
  recordAttempt(clientKey);

  const { registrationMode } = await getSiteSettings();
  if (registrationMode === "OFF") {
    throw new AppError("FORBIDDEN", "管理员暂未开放注册");
  }

  const username = input.username.trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new AppError("VALIDATION_FAILED", "用户名仅允许 3-32 位字母、数字、下划线或连字符");
  }
  const displayName = input.displayName?.trim() ?? "";
  if (displayName.length > 40) {
    throw new AppError("VALIDATION_FAILED", "昵称最多 40 个字符");
  }
  assertPassword(input.password);

  const exists = await prisma.developer.findUnique({ where: { username }, select: { id: true } });
  if (exists) throw new AppError("VALIDATION_FAILED", "该用户名已被其他开发者使用");

  const adminExists = await prisma.adminUser.findUnique({
    where: { username },
    select: { id: true },
  });
  if (adminExists) throw new AppError("VALIDATION_FAILED", "该用户名不可用，请更换一个");

  const passwordHash = await hashPassword(input.password);
  const inviteCode = input.inviteCode ? normalizeInviteCode(input.inviteCode) : "";
  if (registrationMode === "INVITE" && !inviteCode) {
    throw new AppError("VALIDATION_FAILED", "请输入邀请码");
  }

  try {
    const developer = await prisma.$transaction(async (tx) => {
      if (registrationMode === "INVITE") {
        const consumed = await tx.inviteCode.updateMany({
          where: {
            code: inviteCode,
            usedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          data: { usedAt: new Date(), usedBy: username },
        });
        if (consumed.count !== 1) {
          throw new AppError("VALIDATION_FAILED", "邀请码无效、已使用或已过期");
        }
      }

      return tx.developer.create({
        data: {
          username,
          displayName,
          passwordHash,
          status: "ACTIVE",
        },
      });
    });

    attempts.delete(clientKey);
    return { id: developer.id, username: developer.username, displayName: developer.displayName };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("VALIDATION_FAILED", "该用户名已被其他开发者使用");
    }
    throw error;
  }
}

/**
 * 清空注册限流状态，仅用于单元测试。
 * @returns 无
 */
export function resetRegisterRateLimit(): void {
  attempts.clear();
}
