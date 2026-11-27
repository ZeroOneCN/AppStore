import { originFromRequest } from "@/server/http/base-url";
import { renderOpenApiHtml } from "./openapi-html";

/**
 * 输出 OpenAPI 3.1 描述：浏览器访问时渲染可视化文档，工具请求返回 JSON。
 * @param request HTTP 请求，用于推导当前部署地址
 * @returns HTML 文档或 OpenAPI JSON
 */
export async function GET(request: Request): Promise<Response> {
  const base = originFromRequest(request);

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "应用仓库 API",
      version: "1.0.0",
      description: "应用仓库的公开浏览、下载与更新检查接口，以及管理后台接口。",
    },
    servers: [{ url: base, description: "当前部署" }],
    tags: [
      { name: "public", description: "公开接口，无需登录" },
      { name: "update", description: "应用内更新检查" },
      { name: "analytics", description: "客户端可选上报（页面浏览、安装与更新）" },
      { name: "ops", description: "运维与健康检查" },
      { name: "admin", description: "管理后台接口，需会话 Cookie" },
    ],
    components: {
      securitySchemes: {
        sessionCookie: { type: "apiKey", in: "cookie", name: "appstore_session" },
      },
      headers: {
        RetryAfter: {
          description: "建议等待的秒数，客户端应在该时间后重试",
          schema: { type: "integer" },
        },
      },
      schemas: {
        AppCard: {
          type: "object",
          properties: {
            id: { type: "string" },
            slug: { type: "string" },
            name: { type: "string" },
            summary: { type: "string" },
            type: { type: "string", enum: ["ANDROID", "WEB"] },
            category: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            iconUrl: { type: ["string", "null"] },
            packageName: { type: ["string", "null"] },
            visibility: { type: "string", enum: ["PUBLIC", "PRIVATE"] },
            pinned: { type: "boolean" },
            downloadCount: { type: "integer" },
            updatedAt: { type: "string", format: "date-time" },
            currentVersion: {
              type: ["object", "null"],
              properties: {
                versionName: { type: "string" },
                versionCode: { type: "integer" },
                publishedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        Health: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok", "degraded"] },
            checks: {
              type: "object",
              properties: {
                database: { type: "boolean", description: "数据库是否可连通" },
                storage: { type: "boolean", description: "存储目录是否可写" },
              },
            },
            uptime: { type: "integer", description: "进程运行秒数" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
      },
    },
    paths: {
      "/api/public/apps": {
        get: {
          tags: ["public"],
          summary: "公开应用列表",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" }, description: "关键词" },
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "tag", in: "query", schema: { type: "string" } },
            { name: "type", in: "query", schema: { type: "string", enum: ["ANDROID", "WEB"] } },
            { name: "sort", in: "query", schema: { type: "string", enum: ["recent", "name", "downloads"] } },
          ],
          responses: {
            "200": {
              description: "应用列表",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      total: { type: "integer" },
                      items: { type: "array", items: { $ref: "#/components/schemas/AppCard" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/public/apps/{slug}": {
        get: {
          tags: ["public"],
          summary: "应用详情",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "应用详情（含截图、当前版本与历史版本）" },
            "404": { description: "应用不存在或未公开", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/api/public/apps/{slug}/releases": {
        get: {
          tags: ["public"],
          summary: "应用已发布版本列表",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "版本列表" } },
        },
      },
      "/api/public/releases/{id}/download-ticket": {
        get: {
          tags: ["public"],
          summary: "获取带签名的下载短链",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "下载地址与过期时间" } },
        },
      },
      "/api/download/{id}": {
        get: {
          tags: ["public"],
          summary: "下载 APK（支持 Range 断点续传）",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "expires", in: "query", required: true, schema: { type: "string" } },
            { name: "signature", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "APK 文件流" },
            "206": { description: "断点续传片段" },
            "410": { description: "签名已过期" },
          },
        },
      },
      "/api/update/check": {
        get: {
          tags: ["update"],
          summary: "按包名与版本号检查更新",
          description:
            "公开接口，供应用内置检查更新；返回最新的已发布版本（私有应用不进入前台列表但仍可更新）。单 IP 每分钟最多 120 次，超出返回 429。downloadUrl 为 10 分钟有效的签名直链。",
          parameters: [
            { name: "packageName", in: "query", required: true, schema: { type: "string" } },
            { name: "versionCode", in: "query", required: true, schema: { type: "integer" } },
          ],
          responses: {
            "200": {
              description: "hasUpdate / forceUpdate / latest 下载信息",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      hasUpdate: { type: "boolean" },
                      forceUpdate: { type: "boolean" },
                      reason: { type: ["string", "null"], enum: ["NOT_FOUND", null] },
                      latest: {
                        type: ["object", "null"],
                        properties: {
                          versionName: { type: "string" },
                          versionCode: { type: "integer" },
                          changelog: { type: "string" },
                          fileSize: { type: "integer" },
                          sha256: { type: "string" },
                          minSdk: { type: ["integer", "null"] },
                          minSupportedVersionCode: { type: ["integer", "null"] },
                          downloadUrl: { type: "string" },
                          publishedAt: { type: ["string", "null"], format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "429": {
              description: "同一 IP 每分钟超过 120 次请求",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/api/health": {
        get: {
          tags: ["ops"],
          summary: "健康检查",
          description:
            "检查数据库连通性与存储目录可写权限，正常返回 200，异常返回 503；响应禁用缓存，适合监控与部署探活。",
          responses: {
            "200": {
              description: "服务正常",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Health" } } },
            },
            "503": {
              description: "服务降级（数据库或存储目录异常）",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Health" } } },
            },
          },
        },
      },
      "/api/analytics/install": {
        post: {
          tags: ["analytics"],
          summary: "安装/更新上报（可选）",
          description:
            "客户端在安装或更新完成后调用，用于统计首次安装、更新、设备与系统分布；未接入时仅统计下载。同一设备同一版本 5 分钟内重复上报会自动去重。单 IP 每分钟最多 30 次，超出返回 429。",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["packageName", "versionCode", "installType"],
                  properties: {
                    packageName: { type: "string" },
                    versionCode: { type: "integer" },
                    installType: { type: "string", enum: ["install", "update"] },
                    deviceModel: { type: "string" },
                    osVersion: { type: "string" },
                    channel: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "上报成功：{ ok: true }" },
            "400": {
              description: "参数缺失或 installType 非法",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "404": {
              description: "包名未匹配到应用",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "429": {
              description: "同一 IP 每分钟超过 30 次上报",
              headers: { "Retry-After": { $ref: "#/components/headers/RetryAfter" } },
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/api/analytics/pageview": {
        post: {
          tags: ["analytics"],
          summary: "页面浏览上报",
          description:
            "由前台页面信标自动调用，记录 PV/UV、来源域名与渠道；爬虫 UA 会被忽略。单 IP 每分钟最多 60 次，超出返回 429。",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["path"],
                  properties: {
                    path: { type: "string" },
                    appId: { type: "string" },
                    channel: { type: "string" },
                    referrer: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "204": { description: "已记录" },
            "400": { description: "path 缺失" },
            "429": {
              description: "同一 IP 每分钟超过 60 次上报",
              headers: { "Retry-After": { $ref: "#/components/headers/RetryAfter" } },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["admin"],
          summary: "统一登录（管理员 / 开发者）",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["username", "password"],
                  properties: { username: { type: "string" }, password: { type: "string" } },
                },
              },
            },
          },
          responses: {
            "200": { description: "登录成功，返回 role 与 redirectTo，并下发 appstore_session Cookie" },
            "401": { description: "账号或密码错误" },
            "403": { description: "开发者账号已停用" },
            "429": { description: "失败次数过多，已限流" },
          },
        },
      },
      "/api/auth/logout": {
        post: { tags: ["admin"], summary: "统一退出登录", responses: { "200": { description: "已清除会话 Cookie" } } },
      },
      "/api/auth/password": {
        post: {
          tags: ["admin"],
          summary: "修改当前账号密码（按角色区分）",
          security: [{ sessionCookie: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["currentPassword", "newPassword"],
                  properties: {
                    currentPassword: { type: "string" },
                    newPassword: { type: "string", minLength: 8 },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "修改成功" }, "401": { description: "当前密码错误或未登录" } },
        },
      },
      "/api/admin/apps": {
        get: {
          tags: ["admin"],
          summary: "后台应用列表（含草稿与私有）",
          security: [{ sessionCookie: [] }],
          responses: { "200": { description: "全部应用" }, "401": { description: "未登录" } },
        },
        post: {
          tags: ["admin"],
          summary: "创建应用",
          security: [{ sessionCookie: [] }],
          responses: { "201": { description: "创建成功" }, "400": { description: "字段不合法" } },
        },
      },
      "/api/admin/apps/{id}": {
        put: {
          tags: ["admin"],
          summary: "更新应用",
          security: [{ sessionCookie: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "更新成功" } },
        },
        delete: {
          tags: ["admin"],
          summary: "删除应用及其文件",
          security: [{ sessionCookie: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "已删除" } },
        },
      },
      "/api/admin/apps/{id}/releases": {
        post: {
          tags: ["admin"],
          summary: "上传 APK 创建版本草稿",
          description: "请求体为 APK 二进制流，X-Version-Changelog 头可携带 URL 编码的更新日志。",
          security: [{ sessionCookie: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "201": { description: "草稿与解析结果" }, "409": { description: "版本号已存在" } },
        },
      },
      "/api/admin/releases/{id}": {
        delete: {
          tags: ["admin"],
          summary: "删除历史版本",
          security: [{ sessionCookie: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "已删除" }, "400": { description: "当前版本不能删除" } },
        },
      },
      "/api/admin/releases/{id}/publish": {
        post: { tags: ["admin"], summary: "发布并设为当前版本", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "已发布" } } },
      },
      "/api/admin/releases/{id}/archive": {
        post: { tags: ["admin"], summary: "归档版本", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "已归档" } } },
      },
      "/api/admin/releases/{id}/set-current": {
        post: { tags: ["admin"], summary: "切换当前版本（回滚）", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "已切换" } } },
      },
    },
  };

  const format = new URL(request.url).searchParams.get("format");
  const accept = request.headers.get("accept") ?? "";
  const wantsHtml = format !== "json" && (format === "html" || accept.includes("text/html"));

  if (wantsHtml) {
    return new Response(renderOpenApiHtml(spec as unknown as Record<string, unknown>, base), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        Vary: "X-Forwarded-Host, X-Forwarded-Proto, Host",
      },
    });
  }

  return Response.json(spec, {
    headers: {
      "Cache-Control": "no-store",
      Vary: "X-Forwarded-Host, X-Forwarded-Proto, Host",
    },
  });
}
