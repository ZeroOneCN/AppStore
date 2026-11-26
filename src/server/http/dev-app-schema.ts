import { z } from "zod";

/** 开发者可维护的应用字段（不含归属与置顶；可见性由开发者自行决定） */
const baseDevAppSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "访问标识只能包含小写字母、数字与短横线"),
  name: z.string().trim().min(1).max(60),
  summary: z.string().trim().min(1).max(120),
  description: z.string().max(5000).optional(),
  type: z.enum(["ANDROID", "WEB"]),
  category: z.string().trim().min(1).max(30),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).optional(),
  /** 访问链接仅允许 http(s)，禁止 javascript: 等危险协议 */
  webUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), {
      message: "访问链接需以 http:// 或 https:// 开头",
    })
    .nullable()
    .optional(),
  /** Android 包名格式 */
  packageName: z
    .string()
    .trim()
    .max(128)
    .refine(
      (value) => value === "" || /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(value),
      { message: "包名格式不正确" },
    )
    .nullable()
    .optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
});

/** 开发者创建应用请求体 */
export const devAppCreateSchema = baseDevAppSchema;

/** 开发者更新应用请求体，所有字段可选 */
export const devAppUpdateSchema = baseDevAppSchema.partial();
