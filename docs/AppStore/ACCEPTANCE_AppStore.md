# ACCEPTANCE — 个人应用商店（AppStore）

> 阶段：Phase 5 Automate｜最后更新：2026-11-26
> 说明：逐任务记录实测结果。未实测项必须显式标注，不得以推断代替。

## B1（T01–T06）

| 任务 | 验收项 | 结果 | 证据 |
|---|---|---|---|
| T01 工程骨架 | `npm run typecheck` 0 error | 通过 | `next typegen && tsc --noEmit`，退出码 0 |
| T01 | `npm run lint` 0 error / 0 warning | 通过 | 无输出，退出码 0 |
| T01 | `npm run build` 成功 | 通过 | 编译 5.0s，静态页 4/4 |
| T01 | 首页返回 200 | 通过 | `Invoke-WebRequest` STATUS=200，页面含站点标题 |
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

## B4（T14–T15 前台与后台界面）

| 任务 | 验收项 | 结果 | 证据 |
|---|---|---|---|
| T14 前台 | 应用墙卡片、置顶/类型徽标、自适应栅格 | 通过 | 浏览器实测：卡片显示图标、名称、简介、Android 徽标、分类、版本与下载数 |
| T14 | 搜索防抖与结果过滤 | 通过 | 浏览器输入「包裹」后地址变为 `?q=包裹`，仅保留目标卡片 |
| T14 | 分类/标签筛选与排序 | 通过 | 筛选栏已接入 URL 查询参数；组合过滤与排序规则由 B2 `app.service.test.ts` 9 例覆盖 |
| T14 | 详情页截图、版本、更新日志、下载 | 通过 | 详情页显示 v1.0.0、100 MB、minSdk 24、SHA-256 与更新日志；点击「下载 APK」后服务端日志出现 `GET /api/download/... 200` |
| T14 | 空结果空态 | 通过 | 浏览器访问 `/?q=不存在`，显示「没有符合条件的应用」与清空筛选提示 |
| T14 | 深浅色跟随系统 | 通过（代码走查） | 全站使用 Tailwind `dark:` 变体，`globals.css` 保留 `prefers-color-scheme`；未做逐页像素对比 |
| T14 | 390px 窄屏无横向滚动 | 通过 | 浏览器将视口约束到 390px：筛选栏纵向堆叠、卡片单列、标签自动换行，无横向溢出 |
| T15 后台 | 登录与应用列表 | 通过 | 浏览器实测 admin 登录后进入 `/admin/apps`，列表显示应用卡片与草稿/私有/置顶标识 |
| T15 | 新建应用表单 | 通过 | 浏览器填写「包裹管家 / pack-keeper / 工具 / com.packkeeper.packkeeper」提交，跳转 `/admin/apps/{id}` 并显示「版本管理」 |
| T15 | 编辑表单与字段说明 | 通过 | 编辑页平铺「基础信息 / 类型与链接 / 展示设置」三组，说明文字使用问号悬浮提示；保存后 `router.refresh()` 保持状态 |
| T15 | APK 上传进度与解析回显 | 通过（接口 + 界面走查） | 真实 APK 上传返回 201 并回显包名/versionCode/versionName/签名；版本列表刷新后显示 v1.0.0（4026）。上传进度条基于 XHR `upload.onprogress`，受浏览器文件选择自动化限制未逐步截图 |
| T15 | 版本发布/设为当前/归档 | 通过 | 发布后后台版本列表显示「已发布 / 当前版本」；归档与设为当前按钮按状态显隐 |
| T15 | 图标与截图管理 | 通过（部分走查） | APK 内置图标自动落盘并在前后台显示；截图上传/删除接口已由 B3 冒烟覆盖，界面按钮与二次确认走查通过 |
| T15 | 错误提示与危险操作确认 | 通过（代码走查） | 错误统一展示 `【错误码】具体文案`，含字段校验详情；删除应用、归档版本、删除截图均有二次确认 |
| 整体 | `npm run lint` / `typecheck` / `build` | 通过 | 均 0 error；构建 14 个静态/部分预渲染页面，前后台页面为 PPR（◐），API 为动态（ƒ） |

浏览器链路：登录 → 新建应用（UI）→ 上传真实 APK（接口）→ 发布 → 前台应用墙搜索 → 详情页点击下载 → 后台版本状态核对 → 前台空态 → 390px 窄屏检查。

## B5（T16 Flutter Android 客户端）

| 验收项 | 结果 | 证据 |
|---|---|---|
| 工程可构建 | 通过 | `flutter analyze` 0 issue；`flutter build apk --debug` 与 `flutter build apk --release` 均成功（release 51.6 MB） |
| 单元测试 | 通过 | `flutter test` 5 例全绿：字节格式化、进度百分比、基地址校验、相对/绝对地址重写 |
| 应用墙 | 通过（代码走查） | 搜索 350ms 防抖、Android/网页类型与分类筛选、最近更新/名称/下载数排序、自适应网格、下拉刷新、空态与错误重试 |
| 详情与下载 | 通过（代码走查） | 截图横向浏览与全屏查看、更新日志、SHA-256、历史版本；每次下载前重新获取签名票据 |
| 断点续传与校验 | 通过（代码走查） | Range 续传（206 追加 / 200 重下 / 416 清理 / 410 过期提示），完成后校验文件长度与 SHA-256，失败删除 |
| 安装引导 | 通过（代码走查） | 下载完成后检查「安装未知应用」权限，未授权时引导至系统设置；FileProvider 共享 `files/downloads` |
| 更新页 | 通过（代码走查） | 读取商店自身版本与已安装应用版本，逐个调用 `/api/update/check`（间隔 320ms），强制更新置顶，支持单个/全部更新 |
| 启动自更新 | 通过（代码走查） | 启动后检测商店自身更新；强制更新弹窗 `barrierDismissible=false` 且 `PopScope` 禁止返回关闭 |
| 基地址配置 | 通过（代码走查） | 设置页支持保存与连接测试，地址变更后应用墙/更新页自动重载；绝对下载地址会重写主机以适配内网 |
| 接口契约联调 | 通过 | `GET /api/public/apps` 返回 `packageName`；`GET /api/update/check` 返回 `hasUpdate/forceUpdate/latest`；未知包名返回 `hasUpdate=false` + `reason=NOT_FOUND` |
| 真机浏览与安装 | 通过 | ADB 连接 Xiaomi 23127PN0CC 实测：首页显示包裹管家，详情页正常；点击「下载并安装」下载 100 MB 后调起 MIUI 安装器，安装完成后 `lastUpdateTime` 更新，证明下载、校验与安装链路可用 |
| 真机更新检测 | 通过 | 更新页读取商店自身 v1.0.0(1) 与已安装应用 4026；临时将库中版本号改为 4027 后刷新，正确显示「已安装 4026 → 最新 v1.0.0（4027）」并可单条更新；随后已还原为 4026 |
| 真机自更新 | 部分通过 | 上传 v1.0.1(2) 后启动客户端，弹出「发现商店新版本」对话框；点击更新完成下载并调起 MIUI 安装器，因 MIUI 对新 APK 的云端扫描耗时超出验收时间未完成最终安装 |
| 字体与窄屏 | 通过 | 1.3 倍系统字体与 360dp 窄屏（1080×2400）下首页无溢出、无横向滚动；截图见 `docs/AppStore/evidence/` |

> 为支持客户端更新检测，公开应用卡片 DTO 新增 `packageName` 字段（服务端 `AppCardDto`），服务端 `typecheck` / `lint` / 47 例单测回归均通过。

## B6（T17–T18 接入文档与端到端验收）

### 文档交付

| 文档 | 内容 |
|---|---|
| [DEPLOY_AppStore.md](file:///c:/Code/AppStore/docs/AppStore/DEPLOY_AppStore.md) | 环境要求、`.env` 配置、迁移、初始化管理员、启动、内网访问、备份、HTTPS、冒烟脚本、常见问题、升级 |
| [INTEGRATION_AppStore.md](file:///c:/Code/AppStore/docs/AppStore/INTEGRATION_AppStore.md) | 更新接口约定、Kotlin 与 Flutter 最小接入示例、下载/安装要点与常见坑 |

### F1–F12 端到端验收

| 功能 | 结果 | 证据 |
|---|---|---|
| F1 应用档案 | 通过 | B4 浏览器新建 Android 应用；B6 脚本创建网页作品（201），详情返回 `type=WEB`、`webUrl`、1 张截图，SSR HTML 同时包含外部链接与截图地址 |
| F2 APK 上传解析 | 通过 | B4 真实 APK 上传返回 201，解析包名 `com.packkeeper.packkeeper`、versionCode `4026`、versionName `1.0.0`、SHA-256 与文件大小；`apk.service` 5 例单测通过 |
| F3 版本发布与回滚 | 通过 | B4 发布后在后台显示「已发布 / 当前版本」；`release.service` 9 例单测覆盖发布、设为当前、归档约束 |
| F4 下载 | 通过 | `node scripts/api-smoke.mjs` 18 项全 PASS：票据 64 位签名、Range 206（两段）、篡改签名 403、越界 Range 416；详情 `downloadCount` 随下载递增（实测 3） |
| F5 前台浏览 | 通过 | B4 浏览器验证关键词搜索、URL 查询参数、空态与 390px 窄屏；列表排序与筛选逻辑由 `app.service` 9 例单测覆盖 |
| F6 网页作品 | 通过 | 脚本创建网页作品并上传截图：`detail.screenshots.length=1`，`/apps/web-smoke` HTML 含 `https://example.com` 与 `/api/assets/screenshots/`；截图灯箱为 B4 已实现组件 |
| F7 管理员鉴权 | 通过 | `admin-smoke` 前 10 项 PASS：未登录后台接口 401、连续 5 次错误后 429、正确登录下发 Cookie；`POST /api/admin/logout` 返回 200 并按 DESIGN 约定清除 Cookie（无状态 JWT，不撤销已签发令牌） |
| F8 更新检查接口 | 通过 | `api-smoke`：低版本检出更新且含签名地址、同版本无更新、未知包名 200 + `NOT_FOUND`；真机更新页实测结果一致 |
| F9 客户端浏览与下载 | 通过 | 真机（Xiaomi 23127PN0CC）首页/详情正常；下载 100 MB 后调起 MIUI 安装器，安装完成且 `lastUpdateTime` 更新；截图见 [client-home.png](file:///c:/Code/AppStore/docs/AppStore/evidence/client-home.png)、[client-detail.png](file:///c:/Code/AppStore/docs/AppStore/evidence/client-detail.png) |
| F10 客户端更新检测 | 通过 | 更新页先显示「已安装应用均为最新版本」；临时把库中版本号改为 4027 并刷新，正确显示「已安装 4026 → 最新 v1.0.0（4027）」及单条/全部更新入口，见 [client-update-detected.png](file:///c:/Code/AppStore/docs/AppStore/evidence/client-update-detected.png)；随后已还原 |
| F11 商店自更新 | 部分通过 | 上传 v1.0.1(2) 并发布后，已安装的 v1.0.0(1) 启动弹出商店更新对话框（见 [client-self-update.png](file:///c:/Code/AppStore/docs/AppStore/evidence/client-self-update.png)），点击后完成 162 MB 下载并调起 MIUI 安装器；MIUI 对新 APK 云端扫描超时，最终安装未在验收时间内完成 |
| F12 部署可配置 | 通过 | 全部配置来自 `.env.example`；`npm run build` + `npm start` 生产启动成功，验收脚本均运行于生产服务；客户端基地址可在设置页修改并即时生效 |

### 构建与测试

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过（0 error） |
| `npm test` | 8 文件 / 47 用例全绿 |
| `npm run build` | 成功，14 个页面（前台/后台 PPR，API 动态） |
| `npm start` | 生产服务启动成功，用于本轮接口与页面验收 |
| `node scripts/api-smoke.mjs` | 18/18 PASS |
| `node scripts/admin-smoke.mjs` | 前 10 项 PASS；创建应用步骤因示例包名与现有应用冲突（`packageName` 唯一）中止，详见下方说明 |
| `flutter analyze` | No issues found |
| `flutter test` | 5/5 通过 |
| `flutter build apk --release` | 成功，51.6 MB |

### 未完成与说明

1. **admin-smoke 后段**：脚本固定使用 `com.packkeeper.packkeeper` 作为示例包名，与已发布的真实应用冲突（`App.packageName` 唯一），创建返回 400。需在干净数据库执行，或换用与 `SMOKE_APK` 匹配的空闲包名。
2. **F11 最终安装**：下载与安装器调起已验证；MIUI 对 162 MB 调试包的安全扫描未在验收时间内结束，未完成最后一步安装。真机普通应用安装已由 F9 覆盖。
3. **真机断点续传**：接口侧 Range 206 已由 api-smoke 覆盖，客户端续传逻辑为代码走查；未在真机人为中断后验证。
4. **自更新条目**：验收用的「应用商店」条目已删除。若需要客户端自更新，需在后台把自己发布为一个 Android 应用并保持 `packageName=com.appstore.appstore_client`。


### UI 重构（Apple 风格，B7）

| 项目 | 结果 | 证据 |
|---|---|---|
| 品牌与配色 | 通过 | 新 LOGO 落盘 `public/logo.svg`、`src/app/icon.svg`；Web 设计令牌 `--color-brand: #1E51EE`，并把历史 indigo 色阶统一映射到品牌蓝；Flutter 主题显式覆盖 `primary` 为 `#1E51EE` |
| Web 前台 | 通过 | 毛玻璃导航、居中 Hero、iOS 分段筛选与圆角卡片；浏览器验证首页、详情页均无控制台错误，见 [web-home-apple.jpg](file:///c:/Code/AppStore/docs/AppStore/evidence/web-home-apple.jpg)、[web-app-detail-apple.jpg](file:///c:/Code/AppStore/docs/AppStore/evidence/web-app-detail-apple.jpg) |
| Web 后台 | 通过 | 登录卡片垂直居中并展示 LOGO，后台外壳统一玻璃导航与品牌色；浏览器验证通过，见 [web-admin-login-apple.jpg](file:///c:/Code/AppStore/docs/AppStore/evidence/web-admin-login-apple.jpg) |
| Flutter 客户端 | 通过 | 首页 AppBar 展示 LOGO，详情页头部居中，底部导航与按钮统一品牌蓝；真机截图 [client-home-apple.png](file:///c:/Code/AppStore/docs/AppStore/evidence/client-home-apple.png)、[client-detail-apple.png](file:///c:/Code/AppStore/docs/AppStore/evidence/client-detail-apple.png) |
| 垂直居中 | 通过 | Web 统一使用 `.page-center`：内容较少时垂直居中、内容较多时自然撑开；Flutter 加载/错误/空态保持居中 |
| 应用图标 | 通过 | 由新 LOGO 生成各密度 Android 启动图标（mdpi–xxxhdpi），随 release APK 安装生效 |
| 构建与测试 | 通过 | `npm run typecheck` / `lint` / `build` 通过；`flutter analyze` 0 issue；`flutter test` 5/5；`flutter build apk --release` 成功 |

### Web 全宽布局与标识符自动生成（B8）

| 项目 | 结果 | 证据 |
|---|---|---|
| 统一页面尺寸 | 通过 | 新增 `.page-shell`（最大宽度 1440px），前台首页、应用详情、后台外壳与列表全部复用同一容器宽度与内边距 |
| 全宽铺满 | 通过 | 首页顶部品牌区横跨整行，右侧展示作品总数/Android/网页作品统计；筛选栏与卡片网格同宽，卡片最小宽度 280px 自适应多列并等高 |
| 标识符自动生成 | 通过 | 新建应用输入名称时按拼音自动生成访问标识（如「测试应用」→ `ce-shi-ying-yong`），手动修改后不再覆盖，支持「重新生成」 |
| 重名处理 | 通过 | 创建应用时 slug 重复自动追加序号（如 `notes-2`），包名重复仍明确报错；单测 `重复 slug 自动追加序号，重复包名会被拒绝` 通过 |
| 构建与测试 | 通过 | `npm run typecheck` / `lint` / `build` 通过，`npm test` 47/47；浏览器验证首页与后台新建页，见 [web-home-fullwidth.jpg](file:///c:/Code/AppStore/docs/AppStore/evidence/web-home-fullwidth.jpg)、[web-admin-slug-auto.jpg](file:///c:/Code/AppStore/docs/AppStore/evidence/web-admin-slug-auto.jpg) |

### 后台应用管理页顶部留白修复（B9）

| 项目 | 结果 | 证据 |
|---|---|---|
| 根因定位 | 通过 | 后台主内容容器 `main` 带 `justify-center`，内容高度不足一屏时被垂直居中，导致标题上方出现大片空白 |
| 顶部对齐 | 通过 | `admin/(dashboard)/layout.tsx` 移除垂直居中，改为 `flex-1 flex-col py-8 sm:py-10`，标题紧贴导航栏下方 |
| 首屏内容填充 | 通过 | 应用管理页新增「应用总数 / 已发布 / Android / 网页作品」四项概览统计，桌面 4 列、窄屏 2 列；Suspense 骨架同步为该结构 |
| 浏览器验证 | 通过 | 登录后访问 `/admin/apps`：标题与统计数据紧接导航栏，无大片空白、无控制台报错；HTML 校验含「应用总数/已发布/Android/网页作品」，见 [web-admin-apps-overview.jpg](file:///c:/Code/AppStore/docs/AppStore/evidence/web-admin-apps-overview.jpg) |
| 构建与测试 | 通过 | `npm run typecheck` / `lint` 通过，`npm run build` 成功（仅既有 Turbopack tracing 警告） |

### 后台能力补全与 Web 元数据（B10）

| 项目 | 结果 | 证据 |
|---|---|---|
| 列表检索 | 通过 | `/admin/apps` 支持关键词（名称/标识/简介/包名）、类型、可见性筛选与最近更新/名称/下载量排序，全部通过 URL 查询参数生效，可分享与刷新保持 |
| 分页 | 通过 | 每页 12 条，上一页/下一页保留当前筛选条件；筛选无结果时展示「没有匹配的应用」与清除入口 |
| 分类与标签候选 | 通过 | 表单分类输入绑定已有分类 datalist；标签区展示已有标签，点击一键补充，最多 10 个 |
| 版本删除与回滚 | 通过 | 新增 `DELETE /api/admin/releases/{id}`，当前版本禁止删除；历史版本可删除并清理 APK；「设为当前」即回滚 |
| 统计页 | 通过 | 新增 `/admin/stats`：应用/发布/版本/累计下载四项总量、类型分布与下载排行，排行可跳转到按下载排序的列表 |
| 操作审计日志 | 通过 | 新增 `AuditLog` 模型与迁移；创建/更新/删除应用、上传/发布/归档/切换/删除版本、登录、改密均写入日志；`/admin/logs` 展示最近 100 条 |
| 管理员设置 | 通过 | 新增 `/admin/settings` 修改密码：校验当前密码、新密码至少 8 位且不能与旧密码相同，成功后退出登录；`init-admin` 保留为兜底 |
| PWA 与抓取 | 通过 | 新增 `/manifest.webmanifest`、`/robots.txt`（屏蔽 `/admin`、`/api`）、`/sitemap.xml`（首页 + 公开应用详情） |
| 分享图 | 通过 | `/opengraph-image` 输出 1200×630 品牌蓝渐变 PNG，用于社交平台分享卡片 |
| 暗色模式 | 通过 | 深色样式改为 class 驱动；前台与后台均提供「跟随系统 / 浅色 / 深色」切换并本地持久化，首屏前内联脚本避免闪白 |
| 接口描述 | 通过 | `/api/openapi` 输出 OpenAPI 3.1 描述（公开浏览、下载、更新检查与后台接口），配套 [API_AppStore.md](file:///c:/Code/AppStore/docs/AppStore/API_AppStore.md) |
| Code 目录应用归档 | 通过 | 登录后台 API 批量创建并发布：爱健身 v1.9.5、应用商店 v1.0.0、全屋智能 v1.0.0；包裹管家已存在保持不变；LifeOS 因无 APK 建为草稿条目。公开列表由 1 个增至 5 个，详情页均返回 200 |
| 构建与测试 | 通过 | `npm run typecheck` / `lint` / `build` 通过，`npm test` 47/47；新增页面 `/admin/apps`、`/admin/stats`、`/admin/logs`、`/admin/settings`、`/manifest.webmanifest`、`/robots.txt`、`/sitemap.xml`、`/api/openapi`、`/opengraph-image` 均返回 200 |

### APK 矢量图标识别与 LifeOS 发布（B11）

| 项目 | 结果 | 证据 |
|---|---|---|
| 自适应图标 | 通过 | 新增 `apk-icon.service.ts`：解析 `mipmap-anydpi-v26/ic_launcher.xml`，将背景 layer-list/渐变与前景 vector 合成为 108×108 SVG 后栅格化为 512×512 PNG |
| 清单驱动解析 | 通过 | 先从 AndroidManifest 读取 `android:icon` / `roundIcon` 资源 ID，经 `resources.arsc` 解析真实文件；可识别 Flutter 包混淆后的 `res/9w.png`、`res/BW.xml` 等扁平资源名 |
| 图标有效性校验 | 通过 | `parseApk` 先确认解析器返回的图标是真实图片（PNG/JPEG/WebP 魔数），无效时改走矢量提取，避免把二进制 XML 当 PNG 保存 |
| 爱健身图标 | 通过 | 提取结果 512×512、97,285 字节，蓝色渐变 + 白色肌肉线条，已通过图标接口补齐（`iconUrl=/api/assets/icons/cmww2f1mh00038fbgtgiytzcm.png`） |
| LifeOS 发布 | 通过 | 上传 `LifeOS-1.0.0-2010.apk`（63.5 MB，versionCode 2010，包名 `com.lifeos.mobile`）并发布为当前版本；图标 512×512、34,429 字节（白底红色层叠图形） |
| 验证 | 通过 | 公开列表 5 个应用图标均返回 200 image/png；`/api/public/apps/lifeos` 当前版本 1.0.0 (2010)；`typecheck` / `lint` / `test` 47/47 / `build` 全部通过 |

### 品牌 LOGO 更新（B12）

| 项目 | 结果 | 证据 |
|---|---|---|
| 图形规范 | 通过 | 按 brand-icon-system 令牌生成：256×256 画布、圆角 56（22%）、白底 146° 渐变（`#FFFFFF → #F3F8FD → #E9F1FA`）、1px `#DCE5F1` 描边、图形占 92% |
| 图形 | 通过 | 使用 `store` 预设（应用商店图形），渐变 `#64C1F7 → #2E93E4 → #1A6DBC`，等比居中不裁切 |
| 落地 | 通过 | 更新 `public/logo.svg` 与 `src/app/icon.svg`；页头、登录页、错误页、PWA 清单共用新图标 |
| 客户端同步 | 通过 | 用同一 SVG 生成 `client/assets/brand/logo.png` 与 5 档 `mipmap/ic_launcher.png`；`pubspec.yaml` 版本升至 `1.0.1+2` |
| 真机安装 | 通过 | `flutter build apk --release`（51.8 MB）后 `adb install -r` 成功，设备版本 1.0.1 (2)，首页顶部已显示新品牌图 |
| 商店发布 | 通过 | 客户端 1.0.1 (2) 已上传并发布，应用图标替换为新品牌图（25,917 字节） |
| 验证 | 通过 | `/logo.svg`、`/icon.svg` 均返回 200 且包含新渐变；`npm run build` 通过 |

### 开发者分发（B13）

| 项目 | 结果 | 证据 |
|---|---|---|
| 数据模型 | 通过 | 新增 `Developer`（用户名唯一、状态 ACTIVE/DISABLED）；`App.developerId`（SetNull）与 `Release.uploadedBy`；迁移 `add_developer` |
| 会话隔离 | 通过 | 开发者独立 Cookie `appstore_dev_session` 与派生密钥；单元测试验证管理员令牌与开发者令牌互不通用 |
| 管理员侧 | 通过 | `/admin/developers` 支持创建、启停、重置密码（一次性明文）；应用表单可指派归属开发者；导航新增「开发者」 |
| 开发者门户 | 通过 | `/developer/login`、`/developer/apps`、`/developer/apps/new`、`/developer/apps/[id]`、`/developer/settings` 均返回 200；越权访问他人应用 API 返回 403 FORBIDDEN |
| 上传与记录 | 通过 | 开发者上传客户端 1.0.2 (3) 后自动发布为当前版本，`uploadedBy=dev:devtest`；审计记录 `dev.release.upload` |
| 历史下载 | 通过 | 公开详情页历史版本每行带下载按钮（3 个版本）；归档版本保留在列表并可下载，草稿不公开 |
| 页面鉴权加固 | 通过 | 页面数据层补充 `requireAdminPage` / `requireDeveloperPage`；未登录访问 `/admin/apps`、`/admin/developers`、`/developer/*` 的响应不再包含业务数据 |
| 测试 | 通过 | `npm test` 58/58；`typecheck`、`lint`、`build` 全部通过 |
### 更新检查开放 API（B14）

| 项目 | 结果 | 证据 |
|---|---|---|
| 响应字段 | 通过 | `/api/update/check` 的 `latest` 增加 `minSupportedVersionCode`，配合 `forceUpdate` 供客户端判断强制更新 |
| 限流 | 通过 | 单 IP 每分钟最多 120 次，超出返回 429 RATE_LIMITED；进程内实现，多实例部署需换共享存储 |
| 接入文档 | 通过 | 开发者门户新增 `/developer/docs`：接口地址、参数表、响应示例、forceUpdate 语义、Kotlin/Flutter 示例 |
| 文档同步 | 通过 | `docs/AppStore/API_AppStore.md` 补充 minSupportedVersionCode、限流、开发者接口清单；`/api/openapi` 更新响应 schema |
| 验证 | 通过 | `npm test` 58/58；`typecheck`、`lint`、`build` 通过；`/developer/docs` 登录后返回 200 |

### 站点改版与统一登录（B15）

| 项目 | 结果 | 证据 |
|---|---|---|
| 统一会话 | 通过 | 管理员与开发者共用 `appstore_session` Cookie；管理员令牌载荷为 `{sub:"admin",username,role:"admin"}`，开发者令牌仍使用派生密钥，两个方向互不通用（既有单测通过）；`getSession()` 依次验签并返回角色 |
| 统一登录接口 | 通过 | 新增 `POST /api/auth/login`、`/api/auth/logout`、`/api/auth/password`，删除 `/api/admin/login|logout|password` 与 `/api/dev/*` 对应路由；实测 admin 返回 `role=admin`、devtest 返回 `role=developer`，错误账号 401 |
| 登录页与分流 | 通过 | 新增 `/login` 玻璃卡片垂直居中；登录后 admin→`/admin/apps`、developer→`/developer/apps`，支持 `?next=` 且仅允许同角色区域；已登录访问 `/login` 自动跳转对应控制台 |
| 旧入口兼容 | 通过 | `/admin/login`、`/developer/login` 返回 307 到 `/login`；`/developer/docs` 重定向到公开 `/docs` |
| 角色隔离 | 通过 | 携带开发者 Cookie 访问 `/admin/apps`、携带管理员 Cookie 访问 `/developer/apps` 均触发登录重定向，响应不含对方业务数据 |
| 宣传首页 | 通过 | 新增 `/`：Hero、接口预览、平台统计、精选应用、能力网格、三步接入与底部 CTA；浏览器验证无水平滚动 |
| 应用广场迁移 | 通过 | `/apps` 复用筛选、搜索、分类标签与排序逻辑；浏览器验证桌面与 390px 窄屏均无页面级横向溢出 |
| 详情页重构 | 通过 | `/apps/[slug]` 改为应用头部 + 截图/介绍/更新日志/历史版本 + 右侧信息卡（包名、大小、最低系统、SHA-256、发布时间） |
| 公开接入文档 | 通过 | `/docs` 含目录、接口参数、响应字段、强制更新语义、cURL/Java/Kotlin/Flutter/React Native/Node.js/Python/Go/C# 九种示例、下载校验、错误码与 FAQ；浏览器验证语言切换可用 |
| 视觉系统 | 通过 | `globals.css` 新增 `surface`、`page-header`、`chip`、`code-block`、`empty-state`、`gradient-text`、`hero-glow` 等组件类与圆角/阴影令牌；新增 SiteHeader/SiteFooter/PageHeader/StatCard/EmptyState/CodeTabs |
| 后台视觉统一 | 通过 | 管理员与开发者页面标题区统一为 `PageHeader`，统计与空态复用共享组件，详情页区块改用 `surface` |
| 部署准备 | 通过 | `next.config.ts` 开启 `output: "standalone"`；新增 `Dockerfile`、`.dockerignore`；`.env.example` 与 DEPLOY 补充统一会话、数据卷、反向代理与 HTTPS 说明；sitemap 增加 `/apps`、`/docs` |
| 验证 | 通过 | `npm run typecheck`、`npm run lint`、`npm test`（58/58）、`npm run build` 全部通过；生产服务逐页走查 `/`、`/apps`、`/apps/appstore-client`、`/docs`、`/login` 均 200 |

### 后台改版与细节优化（B16）

| 项目 | 结果 | 证据 |
|---|---|---|
| 后台布局 | 通过 | 管理员与开发者共用 `ConsoleShell`：768px 起固定左侧栏（分组导航、用户卡片、等宽操作按钮），窄屏改为三列等分导航 |
| 导航高亮 | 通过 | 按最长前缀匹配，`/admin/apps/new` 只高亮「新建应用」，不再同时选中「应用管理」；浏览器实测通过 |
| 按钮规范 | 通过 | 主/次按钮统一最小高度与圆角；并排按钮使用 `btn-group` 等分；侧边栏六个导航项宽度实测均为 231.2px |
| 固定滚动条 | 通过 | `html` 启用 `scrollbar-gutter: stable` 与 `overflow-y: scroll`，切换后台标签页不再抖动 |
| 设置页居中 | 通过 | 管理员与开发者设置页均为 `flex items-center justify-center`，密码卡片最大宽度 576px，水平垂直居中 |
| 操作日志 | 通过 | 新增 `ip` 字段迁移；20 条/页分页、来源 IP 列展示完整转发链；新增 `DELETE /api/admin/logs` 与二次确认清除按钮，实测清除 50 条并写入清空记录 |
| 站点地址自动推导 | 通过 | 新增 `originFromRequest` / `getRequestOrigin`；`/docs`、首页接口预览、OpenAPI、robots、sitemap、更新检查下载链接均按请求头生成，实测 `Host=apps.example.com` + `X-Forwarded-Proto=https` 输出正确 |
| 品牌与文案 | 通过 | 产品名统一为「应用仓库」，移除「私有部署」措辞，改为「数据存储在自建服务器上」 |
| 验证 | 通过 | `typecheck`、`lint`、`test`（58/58）、`build` 全部通过；新增迁移 `20261126084617_add_audit_log_ip` 已应用 |

### 细节优化（B17）

| 项目 | 结果 | 证据 |
|---|---|---|
| 开发者内嵌文档 | 通过 | `/developer/docs` 不再跳转，直接复用 `DocsEmbedded` 在控制台内渲染；浏览器验证 URL 保持在开发者后台，语言标签可切换 |
| 新建应用统一 | 通过 | 开发者新建页移除窄容器并复用分类/标签候选项；`展示设置` 区保留但禁用，显示「由管理员控制」；数据层补充 `requireDeveloperPage` |
| 站点配置后台化 | 通过 | 新增 `SiteSetting` 模型与迁移 `20261126090045_add_site_settings`；`/api/admin/settings` 支持读写；站点名称、APK 上限、兜底地址改由数据库驱动，实测改名后首页与 manifest 即时生效 |
| 移除 Docker | 通过 | 删除 `Dockerfile`、`.dockerignore` 与 `BUILD_STANDALONE` 条件输出；DEPLOY 改为普通 `npm run build && npm start` |
| 移除深浅色模式 | 通过 | 删除 `ThemeToggle`、首屏主题脚本，`html` 固定 `color-scheme: light`；浏览器验证页面无主题切换入口 |
| 验证 | 通过 | `typecheck`、`lint`、`test`（58/58）、`build` 全部通过；开发者后台三项浏览器走查均通过 |

### OpenAPI 可视化（B18）

| 项目 | 结果 | 证据 |
|---|---|---|
| 内容协商 | 通过 | 浏览器（Accept: text/html）返回可视化文档；`curl` 默认与 `?format=json` 返回 OpenAPI 3.1 JSON |
| 文档内容 | 通过 | 自动读取描述中的 tags 与 paths，渲染 18 个接口、3 个分组；展示参数、请求体字段、响应码与「需登录」标记 |
| 视觉与交互 | 通过 | Hero、统计 chip、桌面固定目录、彩色方法徽标、代码复制按钮；浏览器验证桌面与 390px 均无页面级横向溢出 |
| 验证 | 通过 | `typecheck`、`lint`、`build` 通过；桌面与响应式走查均 PASS |

### 安全测试与加固（B19）

| 测试项 | 结果 | 证据 |
|---|---|---|
| 未登录访问后台接口 | 通过 | `/api/admin/*`、`/api/dev/*` 均返回 401 |
| 角色越权 | 通过 | 管理员令牌访问开发者接口 401，开发者令牌访问管理接口 401 |
| 跨开发者越权（IDOR） | 通过 | 以 devtest 读取/修改其他开发者的应用均返回 403 |
| 私有应用泄露 | 通过 | 私有应用不在公开列表与 API 中，详情页无名称/摘要泄露 |
| 存储型 XSS | 通过 | 名称与摘要注入 `<script>`、`<img onerror>` 在页面中被转义 |
| 危险链接协议 | 通过 | 创建 `javascript:` 访问链接被 422/400 校验拒绝 |
| 下载签名 | 通过 | 缺失、篡改、过期签名均被拒绝 |
| 路径遍历 / 敏感文件 | 通过 | `/.env`、`/data/*`、`/storage/*`、编码穿越路径均 404 |
| 登录限流 | 通过 | 同 IP 第 6 次失败返回 429；轮换 X-Forwarded-For 后第 6 次仍 429（改为取最近代理跳） |
| 账号维度撞库 | 通过 | 轮换 IP 对同一账号连续失败 20 次后锁定 15 分钟 |
| 账号枚举 | 通过 | 不存在的账号也执行 bcrypt 比较，响应时间与错误提示一致 |
| CSRF | 通过 | 跨站 Origin 的写请求返回 403；无 Origin 的客户端调用不受影响 |
| Cookie 安全 | 通过 | HTTPS 请求下返回 `Secure; HttpOnly; SameSite=lax` |
| 安全响应头 | 通过 | CSP、HSTS、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy、COOP/CORP；移除 X-Powered-By |
| 缓存投毒 | 通过 | `/api/openapi` 与更新检查均 `no-store`，OpenAPI 追加 Host 相关 Vary |
| 页面功能回归 | 通过 | 浏览器加载首页、后台与 OpenAPI 页面无 CSP 报错，复制按钮可用 |
| 已知限制 | 说明 | 不存在的应用详情受 PPR 流式渲染影响仍返回 200（页面为 404 内容且无数据泄露）；CSP 因 Next 内联脚本保留 `unsafe-inline`；限流计数为进程内存储，重启后清空 |

### 开发者可见性（B20）

| 项目 | 结果 | 证据 |
|---|---|---|
| 新建页隐藏展示设置 | 通过 | 开发者新建/编辑页不再渲染「展示设置」「归属开发者」「置顶展示」 |
| 开发者可设置可见性 | 通过 | 基本信息新增可见性选择；API 创建 `PRIVATE` 成功且不进入公开列表，改为 `PUBLIC` 后立即公开 |
| 私有资源权限 | 通过 | 私有应用图标/截图改为管理员与归属开发者可读，其他账号 404 |
| 表单示例 | 通过 | 应用名称占位改为「例如：应用仓库」 |
| 安全回归 | 通过 | 开发者接口同步启用 http(s) 链接与包名校验，`javascript:` 链接返回 400 |
| 验证 | 通过 | `typecheck`、`lint`、`test`（58/58）、`build` 全部通过 |

### 手机端尺寸适配（B21）

> 实测方式：Chrome DevTools Protocol `Emulation.setDeviceMetricsOverride`（390×844、DPR 2、mobile），逐页输出 `documentElement.scrollWidth` 与越界元素并截图；不使用 `--window-size=390` 的 headless 截图（Windows 最小窗口宽度会污染结论）。

| 项目 | 结果 | 证据 |
|---|---|---|
| 前台导航 | 通过 | `SiteHeader` 移动端改为双行：首行品牌 + 登录，次行导航独立一行；品牌不再截断为「应用…」，登录按钮不被挤出；桌面仍单行 |
| 首页 Hero | 通过 | Hero 左右两列补 `min-w-0`，接口预览 `pre` 不再把网格单列撑到 445px；此前被 `overflow-hidden` 裁切的标题、简介、按钮与统计卡已完整显示 |
| 前台页面 | 通过 | `/`、`/apps`、`/apps/appstore-client`、`/docs`、`/login` 在 390px 下 `scrollWidth=390`，无页面级横向滚动；越界元素仅剩装饰性 `hero-glow`（被容器裁切）与文档表格（位于 `overflow-x-auto` 容器内可横向滚动） |
| 代码块与表格 | 通过 | `/docs` 与开发者内嵌文档的 `pre.code-block` 宽度 308px、`scrollWidth` 534–637px 且 `overflow-x:auto`；参数表格父容器 `overflow-x:auto`，均为容器内滚动而非页面溢出 |
| 管理员后台 | 通过 | `/admin/apps`、`/admin/apps/new`、`/admin/apps/[id]`、`/admin/logs`、`/admin/settings`、`/admin/stats`、`/admin/developers` 在 390px 下均无页面级横向溢出；操作日志 820px 宽表格在 `overflow-x-auto` 容器内滚动 |
| 开发者后台 | 通过 | `/developer/apps`、`/developer/apps/new`、`/developer/apps/[id]`、`/developer/settings`、`/developer/docs` 同上；版本列表行在窄屏纵向堆叠、操作按钮自动换行 |
| 骨架屏 | 通过 | `SiteHeaderSkeleton` 同步双行高度，会话读取期间无布局跳动 |
| 验证 | 通过 | `npm run typecheck`、`npm run lint`、`npm test`（10 文件 / 58 用例）、`npm run build` 全部通过；构建后以 `npm start` 复测全部页面 |

### 客户端更名与云端更新（B22）

| 项目 | 结果 | 证据 |
|---|---|---|
| APP 名称 | 通过 | Android `android:label`、`MaterialApp.title`、首页标题、更新弹窗、更新列表与设置页文案统一为「应用仓库」 |
| 默认服务地址 | 通过 | `AppConfig` 编译期默认值改为 `https://apps.01iot.top`；升级后若本地仍保存 `10.0.2.2`/`localhost`/`127.0.0.1` 等旧调试地址，自动切换到云端地址 |
| 版本 | 通过 | `pubspec.yaml` 升至 `1.0.3+4`；`aapt dump badging` 实测 `package=com.appstore.appstore_client`、`versionCode=4`、`versionName=1.0.3`、`application-label=应用仓库` |
| 构建与单测 | 通过 | `flutter analyze` 0 issue；`flutter test` 5/5；`flutter build apk --release` 成功（51.8 MB），SHA-256 `34a8429a…f74a` |
| 状态栏显示 | 通过 | 复现：Android 15 边到边模式下状态栏为浅色背景、图标同为白色，时间与电量看不清。修复：`main()` 首帧前与 `AppBarThemeData.systemOverlayStyle` 按主题设置深/浅图标，状态栏与导航栏透明。真机截图确认时间、信号、电量清晰可见，AppBar 正常位于状态栏下方 |
| 真机安装 | 通过 | `adb install` 覆盖安装成功；清空数据后启动，首页标题「应用仓库」、状态栏可读，并从云端加载到已发布的应用（v1.0.3、图标、下载次数） |
| 本地完整链路 | 通过 | 本地上传 54,286,957 字节 APK 返回 201（versionCode 4、SHA-256 与本地一致），发布后 `/api/update/check?versionCode=3` 返回 `hasUpdate=true` 且 `latest.versionCode=4` |
| 云端只读与鉴权 | 通过 | 云端 37 项冒烟全过：4 个公开页面 200、公开列表/更新检查/OpenAPI/robots/sitemap/manifest、CSP/HSTS/X-Frame-Options 等安全头、未登录 401、跨站写请求 403、管理员登录与 6 个后台页面 200、站点设置读取 |
| 大文件上传缺陷 | 已修复 | 复现：云端上传 54MB APK 返回 422「end of central directory record signature not found」。根因：`proxy.ts` 对所有路径生效，Next 代理默认仅保留前 10MB 请求体。修复：`proxyClientMaxBodySize: "64mb"` 并将 APK 上传路由从代理匹配器排除（保持流式落盘）；本地复测同一 APK 上传返回 201 |
| CSRF 回归 | 通过 | 排除上传路由后，其余写接口跨站 Origin 仍返回 403（本地实测 `/api/auth/login`） |
| 云端发布 | 通过 | 云端重新部署后上传 1.0.3 APK 返回 201，`iconSaved=true`；发布为当前版本并设为公开；公开列表返回 `currentVersion=1.0.3(4)`，图标接口 200 `image/png` |
| 云端更新接口 | 通过 | `versionCode=3` 返回 `hasUpdate=true`、`latest.versionCode=4`、`downloadUrl` 指向 `https://apps.01iot.top/api/download/...`；`versionCode=4` 返回 `hasUpdate=false` |
| 下载校验 | 通过 | 按签名地址下载 54,286,957 字节，SHA-256 `34a8429a9e66c8645494a183bfb98cb10c5504bc5a4d52c613E7C1DAD505F74A` 与包内一致 |
| 真机远程更新 | 通过 | 真机卸载后安装 1.0.2(3)（测试包指向云端），启动弹出「发现应用仓库新版本 v1.0.3 (4)」；点击更新后从云端下载 51.8 MB，进度 99%→完成，调起 MIUI 安装器（提示 ICP 备案，选择继续安装）后版本变为 `versionCode=4 / versionName=1.0.3` |

### 开发者注册与邀请码（B23）

| 项目 | 结果 | 证据 |
|---|---|---|
| 配置来源 | 通过 | 新增 `SiteSetting.registrationMode`（OFF/OPEN/INVITE）与 `InviteCode` 表，迁移 `add_registration_invite_codes`；注册模式只读取数据库，不依赖任何环境变量，后台保存后立即生效（单测「注册模式以数据库后台设置为准」覆盖） |
| 注册模式 | 通过 | `/admin/registration` 提供关闭注册 / 开放注册 / 邀请码注册三档；`PUT /api/admin/registration` 仅管理员可调用，写入审计日志 `settings.registration` |
| 邀请码管理 | 通过 | `GET/POST /api/admin/invite-codes` 与 `DELETE /api/admin/invite-codes/{id}`：单次生成 1–20 个 `APP-XXXX-XXXX`、可填备注与有效期（0 为长期）、列表展示可用/已使用/已过期、支持复制与删除；生成/删除写入审计日志 |
| 注册接口 | 通过 | 新增 `POST /api/auth/register`：OFF 返回 403、OPEN 无需邀请码、INVITE 必须有效邀请码；邀请码单次使用（事务内条件更新，并发安全），大小写不敏感；用户名 3–32 位、密码至少 8 位，bcrypt 存储；注册成功自动下发统一会话并进入 `/developer/apps` |
| 安全 | 通过 | 注册尝试按 IP 限流（15 分钟 10 次）；用户名不可与管理员或其他开发者重复；邀请码失效/过期/已使用统一提示；跨站写请求仍由代理返回 403 |
| 页面 | 通过 | 新增 `/register`：关闭时展示「暂未开放注册」，开放/邀请码模式展示对应表单；登录页按模式展示「立即注册 / 使用邀请码注册」入口；手机端 390px 无横向溢出 |
| 手机端回归 | 通过 | 修复登录/注册页 `-inset-x-16` 光晕把布局宽度撑到 438px 的问题（`overflow-hidden` 裁切装饰层后恢复 390px）；注册管理页在 390px 下模式卡片与邀请码表单正常堆叠 |
| 测试 | 通过 | `npm test` 10 文件 / 62 用例全绿；`typecheck`、`lint`、`build` 通过；HTTP 全链路 22 项 PASS（关闭/开放/邀请码、重复使用、大小写、越权、跨站、页面渲染、恢复关闭） |
| 部署 | 说明 | 云端升级需执行 `npx prisma migrate deploy` 以创建 `InviteCode` 表与注册模式字段 |

### 客户端应用卡片优化（B24）

| 项目 | 结果 | 证据 |
|---|---|---|
| 问题定位 | 通过 | 卡片固定高度 `182dp` 且内容之间使用 `Spacer`，简介只有 1–2 行时底部操作行被推到卡片底部，中间形成 60–80dp 大片留白；真机截图卡片高度约占 283px（图像像素） |
| 布局调整 | 通过 | 移除 `Spacer`，简介后直接跟随类型、版本与下载量；卡片内边距 14→12、图标 46→44、圆角 18→16、阴影更轻；栅格高度 `182→118dp`（随字号缩放）、间距 `12→10` |
| 信息密度 | 通过 | 改写后卡片高度降至约 139px（图像像素），同类信息更紧凑；两列布局在 390dp 宽度下名称、两行简介与元信息均完整显示，无溢出 |
| 版本与发布 | 通过 | `pubspec.yaml` 升至 `1.0.4+5`；`flutter analyze` 0 issue、`flutter test` 5/5、release APK 51.8 MB（SHA-256 `6cc50949…9f2c`）；已上传并发布为当前版本，`/api/update/check?versionCode=4` 正确返回 1.0.4(5) |
| 验证 | 通过 | 真机覆盖安装后首页卡片留白明显收窄；云端公开列表当前版本为 `1.0.4(5)` |

### 客户端历史版本详情（B25）

| 项目 | 结果 | 证据 |
|---|---|---|
| 问题定位 | 通过 | 历史版本区域只渲染版本号与日期，无点击事件；详情接口的 `releases` 摘要也不含日志与包信息，无法展示版本详情 |
| 服务端数据 | 通过 | `getAppBySlug` 的 `releases` 增加 `changelog`、`fileSize`、`sha256`、`minSdk` 字段；客户端同时读取已有的 `/api/public/apps/{slug}/releases` 接口，兼容尚未升级的服务端 |
| 客户端交互 | 通过 | 历史版本行增加箭头与「点击查看日志、截图与包信息」提示；点击弹出底部详情层，展示版本号、发布时间、包大小、最低 API、应用截图（横滑、点击全屏）、完整更新日志、SHA-256 与关闭按钮 |
| 数据兼容 | 通过 | 版本列表接口加载失败时自动回退到详情内置版本列表；旧服务端未返回的字段（如 SHA-256、最低 API）自动隐藏，不影响日志与截图展示 |
| 截图数据 | 通过 | 通过后台上传接口为「应用仓库」补充 3 张真机截图，详情页与版本弹层均可展示并全屏查看 |
| 版本与验证 | 通过 | `flutter analyze` 0 issue、`flutter test` 5/5、`npm run typecheck/lint/test` 通过；发布 `1.0.5(6)`，`/api/update/check?versionCode=5` 返回 1.0.5(6)，真机弹层实测显示 v1.0.3 日志与 3 张截图 |
| 部署 | 说明 | 服务端重新部署后，详情接口会直接携带版本日志与校验值，可减少一次版本列表请求；客户端当前已兼容线上旧服务端 |

### 网页版历史版本详情（B26）

| 项目 | 结果 | 证据 |
|---|---|---|
| 问题定位 | 通过 | 网页详情页历史版本仅展示版本号、日期与下载按钮，点击版本无任何反馈 |
| 交互实现 | 通过 | 新增 `VersionHistory` 客户端组件：版本行整行可点击（下载按钮独立），点击弹出详情层，展示版本号、当前标记、发布时间、包大小、最低 API、应用截图、完整更新日志、SHA-256，并提供「下载此版本」与关闭 |
| 数据补充 | 通过 | 首次打开弹层时请求 `/api/public/apps/{slug}/releases` 合并更新日志与包大小，兼容尚未升级的服务端；接口异常时回退服务端已有信息 |
| 截图查看 | 通过 | 弹层内截图横向排列，点击打开全屏灯箱，支持点击遮罩、关闭按钮或 Esc 退出 |
| 渲染修复 | 通过 | 弹层通过 `createPortal` 挂载到 `body`；修复原先 `position: fixed` 被 `.surface` 的 `backdrop-filter` 限制、遮罩只覆盖卡片区域的问题 |
| 可用性 | 通过 | 打开弹层锁定页面滚动；Esc 依次关闭大图与弹层；桌面居中弹窗，移动端底部抽屉式弹层 |
| 验证 | 通过 | `typecheck`、`lint`、`test`、`build` 通过；CDP 实测桌面 1280 与手机 390 均正常，手机端 `scrollWidth=390`；弹层文本包含日志、51.8 MB、最低 API 24、SHA-256 与下载按钮 |
| 部署 | 说明 | 网页端改动需重新构建部署后生效；版本日志接口已兼容当前线上服务端 |

### 新建应用一步完成创建与上传（B27）

| 项目 | 结果 | 证据 |
|---|---|---|
| 问题定位 | 通过 | 新建应用表单强制填写 Android 包名，但 APK 只能在创建后的详情页上传，用户需要先手动查询包名，流程割裂 |
| 交互调整 | 通过 | 新建页「类型与链接」新增安装包选择：选择 APK 后隐藏手填包名，展示包名自动读取提示与「版本更新说明」；按钮变为「创建并上传」，页脚提示同步更新；切换为网页作品时自动清除已选文件 |
| 服务端 | 通过 | 新增 `POST /api/dev/apps/with-apk` 与 `POST /api/admin/apps/with-apk`：接收 multipart，流式落盘校验 ZIP 与解析 APK，读取包名后创建应用，再复用上传服务写入版本并自动发布、补全图标 |
| 回滚 | 通过 | 创建后上传失败会删除刚创建的应用与临时文件；重复包名、版本冲突等错误原样返回，不留下空应用或残留 APK |
| 兼容 | 通过 | 不选择安装包时保持原有流程（手填包名创建空应用）；网页作品逻辑不变；开发者仍只能设置公开/私有，管理员可同时设置置顶与归属 |
| 实测 | 通过 | 管理员 multipart 上传 1.0.5 APK 返回 201，自动解析包名 `com.appstore.appstore_client`、版本 1.0.5(6)、`iconSaved=true` 并发布为当前版本；测试应用删除后存储目录同步清理，原应用包名已恢复 |
| 界面验证 | 通过 | 手机端 390px 新建页无横向溢出，安装包选择、提示与包名回退输入正常展示 |
| 质量 | 通过 | `typecheck`、`lint`、`test`、`build` 全部通过 |

### 上传报错修复与进度条（B28）

| 项目 | 结果 | 证据 |
|---|---|---|
| 问题定位 | 通过 | `with-apk` 路由未加入 `src/proxy.ts` 匹配器排除列表，代理接管请求后 `request.formData()` 解析失败，统一返回 `VALIDATION_FAILED / 请使用表单方式提交应用信息与安装包` |
| 代理修复 | 通过 | 匹配器排除 `api/admin/apps/with-apk` 与 `api/dev/apps/with-apk`，请求体直接流式进入路由，避免代理缓冲 50MB+ 上传 |
| 安全补位 | 通过 | 新增 `src/server/http/origin.ts` 的 `assertSameOrigin`，两个被排除的上传路由在入口自行校验 Origin；实测伪造 `Origin: https://evil.example` 返回 403 `跨站请求已被拒绝` |
| 上传进度 | 通过 | 因 fetch 无法获取上传进度，表单改为 `XMLHttpRequest` 提交并监听 `upload.onprogress`，实时展示百分比进度条；上传完成（100%）时提示「上传完成，正在解析并创建应用…」，失败或结束自动隐藏 |
| 实测 | 通过 | 浏览器同源 multipart 上传 51.9MB APK 返回 201，自动解析 `com.appstore.appstore_client`、版本 1.0.5(6) 并发布；测试应用删除后存储目录与图标同步清理 |
| 质量 | 通过 | `typecheck`、`lint`（0 warning）、`test`（62/62）、`build` 全部通过 |
| 部署 | 说明 | 网页端重新构建部署后生效，无数据库变更 |

### 创建流程体验与 APK 完整性校验（B29）

| 项目 | 结果 | 证据 |
|---|---|---|
| 问题定位 | 通过 | `end of central directory record signature not found` 表示收到的文件缺少 ZIP 目录尾，属于文件不完整或不是 APK；同时创建成功后落在与新建页高度相似的编辑表单，缺少「已完成创建」的明确反馈 |
| 创建完成反馈 | 通过 | 创建成功后跳转详情页并携带 `created=1` 与首个版本号，页面顶部展示绿色提示「应用已创建，首个版本 v1.0.5（6）已发布」，说明后续可上传新版本或修改基础信息 |
| 区块顺序 | 通过 | 管理员与开发者详情页均把「版本管理」前置到首屏，截图、图标与记录信息紧随其后，「基础信息」编辑表单移至页面底部，与新建页明显区分 |
| 客户端校验 | 通过 | 新增 `src/lib/apk-file.ts` 的 `checkApkFile`：上传前读取文件首尾，校验 ZIP 文件头与中央目录结束记录；新建页与版本上传共用。校验失败会清空已选文件并重置选择框，提示「安装包不完整（缺少 ZIP 目录），请重新选择安装包后再试」，避免继续使用刚生成/仍在复制时的过期文件快照 |
| 服务端提示 | 通过 | APK 解析失败时附带已接收大小；实测把 52MB 安装包截断到 10MB 上传，返回 `APK 解析失败：end of central directory record signature not found（已接收 10.0 MB）`，可直接判断上传不完整 |
| 校验实测 | 通过 | 完整 APK 校验返回 null；截断文件返回不完整提示；非 ZIP 文本文件被拒绝 |
| 兼容 | 通过 | 云端同源 multipart 54MB 与二进制 52MB 上传均正常（分别返回包名冲突与版本冲突），说明服务端未截断请求体；本次仅补充提示与前置校验 |
| 质量 | 通过 | `typecheck`、`lint`、`test`（62/62）、`build` 全部通过 |
| 部署 | 说明 | 网页端重新构建部署后生效，无数据库变更 |

### 发布页重构与同版本号覆盖（B30）

| 项目 | 结果 | 证据 |
|---|---|---|
| 页面结构 | 通过 | 管理员与开发者详情页改为查询参数驱动的三标签：`版本发布`（默认）、`基础信息`、`图标与截图`；基础信息独立分区后，页面不再同时出现「保存修改」与「点击发布」 |
| 当前版本概览 | 通过 | 版本发布标签首屏展示当前线上版本大卡片（版本号、版本码、大小、发布时间、更新日志，开发者端带下载按钮）；无版本时展示引导文案；页头展示「线上 vX」状态徽标 |
| 上传交互 | 通过 | 上传区提供「覆盖同版本号」「上传后立即发布」两个复选框（默认勾选发布），主按钮随选项变为「上传并发布 / 上传为草稿」，保留实时上传进度与 APK 完整性前置校验 |
| 草稿发布 | 通过 | 存在草稿时在版本列表上方展示琥珀色「待发布草稿」区块，每行提供实心「立即发布」按钮；版本列表操作按钮同步加大，发布入口不再藏在行内小字 |
| 服务端覆盖 | 通过 | `uploadApkRelease` 新增 `overwrite` 与 `autoPublish` 参数，同版本号命中时改为 `overwriteRelease`：保留版本 ID、发布时间与下载统计，更新包名信息与文件大小/哈希；未填写日志时保留原日志；已归档版本禁止覆盖后直接发布 |
| 失败回滚 | 通过 | 覆盖前把旧安装包复制为 `.bak-时间戳`，落盘或数据库更新失败时删除新文件并还原备份；成功后再清理备份，旧路径与新路径不同时删除历史文件 |
| 接口参数 | 通过 | 管理端 `?overwrite=1&publish=1|0`（默认草稿），开发者端默认发布、`publish=0` 可仅建草稿；审计日志记录 `release.overwrite` 并标注「覆盖同版本号」 |
| Windows 加固 | 通过 | 覆盖时 `fs.rename` 因目标文件被杀毒/索引短暂占用报 `EPERM`；`moveApkToFinal` 改为带退避重试并在失败时退化为覆盖复制，复测通过 |
| 实测 | 通过 | 同版本号不勾选覆盖返回 409 `版本号 4 已存在，如需替换请勾选「覆盖同版本号」`；勾选覆盖返回 201 且 `overwritten=true`，版本状态与下载统计保持不变；勾选覆盖并发布返回 201，仍为唯一当前版本 |
| 界面验证 | 通过 | 本地管理员会话请求三个标签均渲染正确：版本发布含当前版本卡片与两个选项，基础信息含「保存修改」且无上传区，图标与截图含截图管理/应用图标且无保存按钮 |
| 质量 | 通过 | `typecheck`、`lint`、`test`（64/64）、`build` 全部通过 |
| 部署 | 说明 | 网页端重新构建部署后生效，无数据库变更 |