import { z } from "zod";

/** 开发者可维护的应用字段（不含归属、可见性与置顶） */
const baseDevAppSchema = z.object({
  slug: z.string().trim().min(2).max(48),
  name: z.string().trim().min(1).max(60),
  summary: z.string().trim().min(1).max(120),
  description: z.string().max(5000).optional(),
  type: z.enum(["ANDROID", "WEB"]),
  category: z.string().trim().min(1).max(30),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).optional(),
  webUrl: z.string().trim().max(500).nullable().optional(),
  packageName: z.string().trim().max(128).nullable().optional(),
});

/** 开发者创建应用请求体 */
export const devAppCreateSchema = baseDevAppSchema;

/** 开发者更新应用请求体，所有字段可选 */
export const devAppUpdateSchema = baseDevAppSchema.partial();
