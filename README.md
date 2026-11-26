# AppStore — 个人应用分发中心

自建应用商店，用于展示、整理与分发个人开发的作品，并为已安装应用提供版本更新推送。

## 一、项目规划

| 组成 | 技术选型 | 说明 |
|---|---|---|
| Web 端（前台 + 管理后台 + API） | Next.js（App Router）+ TypeScript + Prisma + SQLite | 单体自托管，APK 存本地磁盘，后续可切 Postgres |
| Android 商店客户端 | Flutter | 浏览、下载、安装、检测更新、商店自身自更新 |
| 更新能力开放 | 标准 HTTP 更新检查接口 + 轻量接入示例 | 供自有其他 App 直接接入 |

范围要点：
- 公开浏览 + 单管理员登录后台
- 应用分两类：Android 应用（APK 下载）、网页作品（截图 + 跳转链接）
- 版本线按应用独立（每个应用各自版本号，不做灰度/渠道）
- 更新检测：商店客户端全局检测为主，同时提供标准接口供单个 App 自行接入
- 部署：先本机 / 内网试用，服务端基地址与下载签名密钥全部走环境变量，上线只改配置

里程碑：
1. M1 数据模型 + 管理员登录 + 应用/版本管理 API
2. M2 Web 前台（应用墙、详情、下载）
3. M3 Flutter 商店客户端（列表、详情、下载安装、更新）
4. M4 更新检查接口与接入示例
5. M5 部署配置与商店自更新

## 二、实现策略

- 规格驱动：先 Align（需求与边界）→ Architect（架构与接口）→ Atomize（任务拆分）→ 核准后编码
- 单一数据源：版本、包名、签名指纹、SHA256 全部由上传的 APK 自动解析，人工只填文案与截图
- 下载安全：签名短链 + 完整性校验（SHA256），避免裸路径被爬
- 客户端最小权限：安装未知来源应用按系统规范引导授权，不申请无关权限

## 三、进度跟踪

| 阶段 | 状态 | 产出 |
|---|---|---|
| 需求对齐（Align） | 已完成 | docs/AppStore/ALIGNMENT_AppStore.md、CONSENSUS_AppStore.md |
| 架构设计（Architect） | 已完成 | docs/AppStore/DESIGN_AppStore.md |
| 任务拆分（Atomize） | 已完成 | docs/AppStore/TASK_AppStore.md |
| 开发实施（Automate） | 已完成：B6 完成 | 代码与 ACCEPTANCE_AppStore.md |
| 验收总结（Assess） | 已完成 | docs/AppStore/FINAL_AppStore.md、TODO_AppStore.md |

### 批次进度

| 批次 | 内容 | 状态 |
|---|---|---|
| B1 | T01–T06 骨架、数据模型、基础设施、鉴权、存储、APK 解析 | 已完成 |
| B2 | T07–T12 应用/版本服务、公开 API、下载、更新检查 | 已完成 |
| B3 | T13 管理 API | 已完成 |
| B4 | T14–T15 前台与后台界面 | 已完成 |
| B5 | T16 Flutter 客户端 | 已完成 |
| B6 | T17–T18 接入示例、部署文档、端到端验收 | 已完成 |
| B7 | UI 深度重构：Apple 风格、品牌蓝 #1E51EE、新 LOGO、全站垂直居中 | 已完成 |
| B8 | Web 优化：全站统一 1440px 容器、全宽铺满、访问标识自动生成与重名自动编号 | 已完成 |
| B9 | 后台应用管理页：移除垂直居中导致的顶部空白，新增四项概览统计填充首屏 | 已完成 |
| B10 | 后台检索/分页、分类标签候选、版本删除、统计页、操作日志、改密设置；Web manifest/robots/sitemap/OG/暗色切换/OpenAPI；批量归档 Code 目录应用 | 已完成 |
| B11 | APK 图标解析支持矢量图/自适应图标与混淆资源名；补齐爱健身图标并上传发布 LifeOS v1.0.0 | 已完成 |
| B12 | 按品牌图标规范更新站点 LOGO（白底渐变蓝、圆角 22%、应用商店图形），同步 favicon、PWA 图标与客户端图标，客户端升至 1.0.1 并发布 | 已完成 |
| B13 | 开发者分发：开发者账号（管理员创建/启停/重置密码）、独立门户 /developer、应用归属、上传自动发布、版本记录上传者与公开历史版本下载 | 已完成 |
| B14 | 更新检查开放 API：返回最低支持版本与签名下载直链、单 IP 限流，开发者门户新增「接入文档」与 Kotlin/Flutter 示例 | 已完成 |
| B15 | 站点改版：新增宣传首页，应用墙迁至 /apps；管理员与开发者共用 /login 并按角色分流；公开 /docs 覆盖 9 种语言；全站视觉升级与云服务器/容器部署配置 | 已完成 |
| B16 | 后台改版：固定侧边栏与等宽按钮；操作日志分页/清除/完整来源 IP；设置页垂直居中；站点根地址按请求头自动推导；产品更名为「应用仓库」 | 已完成 |
| B17 | 细节优化：开发者后台内嵌接入文档；新建应用页统一；站点设置迁入后台数据库；移除 Docker 与深浅色模式 | 已完成 |
| B18 | OpenAPI 可视化：浏览器访问 /api/openapi 展示接口文档，工具请求与 ?format=json 仍返回 JSON | 已完成 |
| B19 | 安全加固：全站安全响应头与 CSP、写请求 Origin 校验、登录按 IP+账号双维度限流、URL/包名校验、私有资源隔离复测 | 已完成 |
| B20 | 开发者体验：可见性开放给开发者自行设置，隐藏归属/置顶等管理员字段；修正应用名称示例为「应用仓库」 | 已完成 |
| B21 | 手机端适配：前台导航改为移动端双行布局；修复首页 Hero 接口预览撑宽导致的内容裁切；逐页复核 390px 无页面级横向溢出 | 已完成 |
| B22 | 客户端更名与云端更新：APP 统一更名「应用仓库」、默认连接 `https://apps.01iot.top`、版本升至 1.0.3(4)；修复状态栏图标不可见与代理 10MB 请求体上限；已发布云端并完成真机远程更新验证 | 已完成 |
| B23 | 开发者注册：新增关闭/开放/邀请码三种模式与邀请码管理，全部配置存数据库后台、优先生效；新增 `/register`、`/admin/registration`，注册自动登录并进入开发者后台 | 已完成 |
| B24 | 客户端应用卡片优化：移除卡片内部弹性留白、收紧高度与间距，版本与下载量紧随简介展示；发布 1.0.4(5) 至云端 | 已完成 |

## 四、约定

- 密钥与配置只放 `.env`，不提交仓库
- 代码注释与文档使用简体中文
- 每个阶段完成后暂停，等待确认再进入下一阶段

## 五、运行与文档

```bash
npm install && npx prisma generate
npx prisma migrate deploy && npm run init-admin
npm run dev
```

| 文档 | 用途 |
|---|---|
| [DEPLOY_AppStore.md](docs/AppStore/DEPLOY_AppStore.md) | 部署、备份、HTTPS、冒烟脚本 |
| [INTEGRATION_AppStore.md](docs/AppStore/INTEGRATION_AppStore.md) | 自家应用接入更新（Kotlin/Flutter） |
| [ACCEPTANCE_AppStore.md](docs/AppStore/ACCEPTANCE_AppStore.md) | 分批验收记录与真机证据 |
| [FINAL_AppStore.md](docs/AppStore/FINAL_AppStore.md) | 交付总结 |
| [TODO_AppStore.md](docs/AppStore/TODO_AppStore.md) | 待办与已知限制 |
