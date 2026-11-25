import { logger } from "./logger";

/** 错误码 → HTTP 状态码映射，与 DESIGN 第 9.1 节保持一致 */
export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  LINK_EXPIRED: 410,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_TYPE: 415,
  PACKAGE_MISMATCH: 422,
  APK_PARSE_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/**
 * 业务异常：携带错误码与 HTTP 状态，接口层统一转换为响应。
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  /**
   * @param code 错误码
   * @param message 面向用户的中文提示
   * @param details 可选的结构化补充信息（如冲突字段）
   */
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}

/**
 * 判断是否为业务异常。
 * @param error 任意异常值
 * @returns 是业务异常返回 true
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 将任意异常转换为标准错误响应，未预期异常统一脱敏为 INTERNAL_ERROR。
 * @param error 捕获到的异常
 * @param requestId 可选的请求标识，便于与日志关联
 * @returns 标准 JSON 错误响应
 */
export function toErrorResponse(error: unknown, requestId?: string): Response {
  if (isAppError(error)) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  logger.error("未处理的异常", {
    requestId,
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  });

  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "服务器内部错误，请稍后重试" } },
    { status: 500 },
  );
}
