# ACCEPTANCE — 个人应用商店（AppStore）

> 阶段：Phase 5 Automate｜最后更新：2026-11-25
> 说明：逐任务记录实测结果。未实测项必须显式标注，不得以推断代替。

## B1（T01–T06）

| 任务 | 验收项 | 结果 | 证据 |
|---|---|---|---|
| T01 工程骨架 | `npm run typecheck` 0 error | 通过 | `next typegen && tsc --noEmit`，退出码 0 |
| T01 | `npm run lint` 0 error / 0 warning | 通过 | 无输出，退出码 0 |
| T01 | `npm run build` 成功 | 通过 | 编译 5.0s，静态页 4/4 |
| T01 | 首页返回 200 | 通过 | `Invoke-WebRequest` STATUS=200，页面含「我的应用仓库」 |
| T01 | `.env` 不被跟踪、`.env.example` 可提交 | 通过 | `.gitignore` 增加 `!.env.example` 与 `/data/`、`/storage/` |
| T02 数据模型 | 迁移成功、表结构含 AdminUser/App/Release | 通过 | `prisma migrate dev --name init` 生成 `20261125085723_init` |
| T02 | `init-admin` 幂等写入管理员 | 通过 | 首次执行输出「管理员账号已就绪：admin」 |
| T03 基础设施 | 错误码映射与脱敏单测 | 通过 | `errors.test.ts` 2 组用例全绿 |
| T03 | 环境变量校验单测（缺字段报错） | 通过 | `env.test.ts` 4 例全绿 |
| T04 鉴权 | 密码哈希 / 令牌签发 / 篡改 / 过期 | 通过 | `auth.service.test.ts` 7 例全绿 |
| T04 | 连续 5 次密码错误后第 6 次 429 | 通过 | 单测断言 `RATE_LIMITED` |
| T05 存储 | 图标转 512×512 PNG、截图落盘、穿越拦截、级联清理 | 通过 | `storage.service.test.ts` 4 例全绿 |
| T06 APK | 非 ZIP 拒绝、ZIP 通过、流式 SHA256、超限清理、坏包报错 | 通过 | `apk.service.test.ts` 5 例全绿 |

**单测汇总**：5 个文件 / 24 个用例，全部通过（5.56s）。

### 待补测项补测结果（2026-11-25 完成）

用真实安装包 `C:\Code\PackKeeper\dist\包裹管家-1.0.0-4026.apk`（104,936,069 字节）补测，通过 `scripts/verify-apk.ts` 与 `apksigner verify --print-certs` 交叉验证：

| 验收项 | 实测值 | 结果 |
|---|---|---|
| 包名解析 | `com.packkeeper.packkeeper` | 通过 |
| versionCode / versionName | `4026` / `1.0.0` | 通过 |
| minSdk | `24`（取自 `usesSdk.minSdkVersion`） | 通过 |
| 图标解析 | 顶层 `icon` data URI，解码后 1210 字节 | 通过 |
| 签名证书 SHA-256 指纹 | `5A:93:64:8A:A0:EF:C4:83:D5:86:ED:0F:D8:17:9A:D2:FE:3C:5E:90:E1:33:97:DE:94:24:CD:E4:27:30:AF:06` | 通过（与 apksigner `5a93648aa0efc483d586ed0fd8179ad2fe3c5e90e13397de9424cde42730af06` 完全一致） |
| 无 v1 签名时的回退 | 该包 363 个 zip 条目无 `META-INF/*.RSA`，回退解析 APK Signature Scheme v2 签名块取证书 | 通过 |
| 文件 SHA256（全量 vs 流式） | 两种算法结果一致（`13909d5a…0123`） | 通过 |

第二个包 `AiJianShen-1.9.5.apk` 交叉验证同样通过：包名 `com.aijianshen.app`、versionCode `16`、versionName `1.9.5`、minSdk `26`、图标 548 字节。

> 备注：`apksigner.bat` 经管道调用时 shell 退出码为 -1，但输出完整且指纹与本地解析一致，不影响结论。

## B2（T07–T12）

| 任务 | 验收项 | 结果 | 证据 |
|---|---|---|---|
| T07 签名 | 票据含 `exp`+64 位 hex 签名；过期/篡改分别 410/403 | 通过 | `signing.service.test.ts` 5 例全绿 |
| T08 应用服务 | 列表过滤/排序/置顶、详情聚合、创建校验、删除级联 | 通过 | `app.service.test.ts` 9 例全绿（真实 SQLite） |
| T09 版本服务 | 包名不一致、版本号重复、发布切换当前版本、回滚、归档、更新判定 | 通过 | `release.service.test.ts` 9 例全绿 |
| T10 公开 API | 列表 / 详情 / 版本列表 / 下载票据 4 个接口 | 通过 | 冒烟 18 项断言全过 |
| T11 下载与资源 | 签名校验、Range 206、越界 416、资源仅公开应用可读 | 通过 | 冒烟实测，见下 |
| T12 更新检查 | 低版本有更新、同版本无更新、未知包名 200 + `NOT_FOUND` | 通过 | 冒烟实测 |
| 整体 | `npm run typecheck` 0 error | 通过 | 退出码 0 |
| 整体 | `npm run lint` 0 error / 0 warning | 通过 | 无输出 |
| 整体 | `npm run build` 成功且无预渲染异常日志 | 通过 | 7 个 API 路由均为 ƒ 动态；为 `/api/public/apps`、`/api/update/check` 增加 `connection()` 消除构建期预渲染报错 |
| 整体 | 单元/集成测试全绿 | 通过 | 8 个文件 / 47 个用例（13s） |
| 整体 | HTTP 端到端冒烟 | 通过 | `node scripts/api-smoke.mjs`，18/18 PASS |

HTTP 冒烟实测明细（种子数据：`smoke-pack`，真实 APK 4026 版，跑完后已清理）：

| 断言 | 结果 |
|---|---|
| 列表返回至少 1 个应用、含 slug | PASS |
| 详情含当前版本与包名 | PASS |
| `versionCode=0` 检出更新，`downloadUrl` 含 64 位签名 | PASS |
| 同版本无更新 | PASS |
| 未知包名 200 且 `reason=NOT_FOUND` | PASS |
| 下载票据含 64 位签名 | PASS |
| `Range: bytes=0-1023` → 206，响应体 1024 字节，`Content-Range: bytes 0-1023/104936069`，`Accept-Ranges: bytes` | PASS |
| `Range: bytes=1024-2047` → 206，响应体 1024 字节 | PASS |
| 篡改签名 → 403 | PASS |
| 越界 Range → 416 | PASS |
| 下载计数口径 | 通过：3 次 `start=0` 请求后 app/release 计数均为 3，第二段 Range 不计数 |

> 说明：Next 对流式响应使用 `chunked` 编码，不保留 `Content-Length`，因此断言改为校验实际响应体字节数与 `Content-Range`。

## B3（T13 管理 API）

| 任务 | 验收项 | 结果 | 证据 |
|---|---|---|---|
| T13 鉴权 | 未登录访问后台接口统一 401 | 通过 | 冒烟：未登录列表/创建均 401 |
| T13 | 登录限流：同来源第 6 次失败返回 429 | 通过 | 冒烟：`x-forwarded-for` 固定来源连试 6 次 |
| T13 | 登录下发 HttpOnly Cookie，登出清除（`Max-Age=0`） | 通过 | 冒烟：Set-Cookie 断言通过 |
| T13 应用 CRUD | 创建 Android/网页应用、私有可见性、删除清理磁盘 | 通过 | 冒烟：创建、删除、`storage/apks/{id}` 已移除 |
| T13 上传 | 非 APK 返回 415；真实 APK 返回 201 且解析正确 | 通过 | 冒烟：包名 `com.packkeeper.packkeeper`、versionCode `4026` |
| T13 | 重复版本返回 409 `VERSION_CONFLICT`，且不覆盖既有版本文件 | 通过 | 冒烟：二次上传同版本 409；落盘前提前校验 |
| T13 | 更新日志请求头 URL 解码 | 通过 | 冒烟：`- 首个版本` 原样入库 |
| T13 版本操作 | 发布设当前、归档当前版本被拒 | 通过 | 冒烟：发布后 `PUBLISHED`+`isCurrent`；归档当前 400 |
| T13 资源 | 图标转 512 PNG 且可匿名访问；截图上传/详情展示/删除 | 通过 | 冒烟：`/api/assets/icons/{id}.png` 200 `image/png`，截图 1→0 |
| T13 可见性 | 私有应用不进公开列表、后台列表标记 `PRIVATE` | 通过 | 冒烟断言通过 |
| T13 | 私有应用资源未登录 401、登录后 404 | 通过 | 冒烟断言通过 |
| 整体 | `npm run lint` / `typecheck` / `build` 0 error | 通过 | 构建路由表含 10 个 `ƒ` 后台接口 |
| 整体 | 既有单测回归 | 通过 | 8 文件 / 47 用例全绿 |
| 整体 | HTTP 端到端冒烟 | 通过 | `node scripts/admin-smoke.mjs`，40/40 PASS |

> 冒烟链路：未登录守卫 → 限流 → 登录 → 建应用 → 上传 APK → 发布 → 前台/更新接口可见 → 图标与截图 → 私有可见性 → 删除清理 → 登出。跑完后数据与文件均已清理。

## B4–B6

尚未开始。
