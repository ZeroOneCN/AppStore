# CONSENSUS — 个人应用商店（AppStore）

> 阶段：Phase 1 Align 产出｜状态：待批准｜最后更新：2026-11-25

## 1. 需求描述

构建一个自托管的个人应用商店，包含 Web 端（公开前台 + 单管理员后台 + API）与 Flutter Android 客户端。Web 端负责展示与整理应用、提供 APK 下载与网页作品跳转；客户端负责浏览、下载、安装与全局更新检测；同时对外提供标准更新检查接口，供自有应用单独接入。

## 2. 验收标准

| 编号 | 需求 | 验收标准（可测） |
|---|---|---|
| F1 | 应用档案 | 后台可创建 Android 应用与网页作品；字段含名称、slug、简介、详情、分类、标签、图标、截图、可见性；前台列表与详情正确展示 |
| F2 | APK 上传解析 | 上传 APK 后自动得到包名、versionCode、versionName、图标、文件大小、SHA256，且与文件实际值一致，无需手工填写 |
| F3 | 版本发布与回滚 | 发布新版本后前台最新版本与客户端更新接口立即指向新版本；可将任一历史版本设为当前版本 |
| F4 | 下载 | 下载链接为签名短链，过期或篡改后返回 403；下载内容 SHA256 与库中记录一致；下载计数递增 |
| F5 | 前台浏览 | 支持关键词搜索、分类/标签筛选、按置顶/更新时间排序；空结果有明确空态 |
| F6 | 网页作品 | 详情页可查看多张截图并跳转到配置的外部链接（新窗口） |
| F7 | 管理员鉴权 | 未登录访问后台页面/接口返回登录页或 401；密码错误有提示；登录态可退出 |
| F8 | 更新检查接口 | 传入包名与当前 versionCode，当前无更新时返回 `hasUpdate=false`；有更高已发布版本时返回最新版本信息、强制标记、更新日志、下载地址与 SHA256 |
| F9 | 客户端浏览与下载 | 客户端可拉取应用列表与详情，下载显示进度，完成后校验 SHA256 并调起系统安装器 |
| F10 | 客户端更新检测 | 客户端读取已装应用版本，与接口比对后逐条展示可更新项；支持单条与全部更新 |
| F11 | 商店自更新 | 商店客户端自身版本落后时，可用同一机制完成自更新 |
| F12 | 部署可配置 | 仅修改 `.env` 即可切换基地址、存储目录、签名密钥、管理员账号；本机可一键启动 |

## 3. 技术方案

### 3.1 总体结构

- Web：Next.js（App Router，TypeScript）+ Tailwind，前后台同一应用；API 走 Route Handlers。
- 数据：Prisma + SQLite，迁移脚本纳入版本管理。
- 文件：APK 与图片落本地 `storage/`，由受控路由流式输出（支持 Range，便于断点续传）。
- 客户端：Flutter，状态管理保持轻量，网络用 dio，安装用 open_file/install 插件，包信息读取用原生通道或 package_info 类插件。
- 密钥：`.env` 提供 `DOWNLOAD_SIGN_SECRET`、`ADMIN_USERNAME`、`ADMIN_PASSWORD_HASH`、`BASE_URL`、`STORAGE_DIR`。

### 3.2 数据模型（草案）

```
AdminUser   id, username, passwordHash, createdAt
App         id, slug, name, summary, description, type(ANDROID|WEB),
            category, tagsJson, iconPath, screenshotsJson, webUrl,
            packageName?, visibility(PUBLIC|PRIVATE), pinned,
            downloadCount, createdAt, updatedAt
Release     id, appId, versionName, versionCode, changelog,
            filePath, fileSize, sha256, forceUpdate,
            status(DRAFT|PUBLISHED|ARCHIVED), isCurrent,
            downloadCount, publishedAt
```

约束：同一 `App` 下 `versionCode` 唯一；同一时刻仅一个 `Release` 满足 `isCurrent=true`；`App.packageName` 全局唯一。

### 3.3 接口（草案）

公开：
- `GET /api/public/apps?q=&category=&tag=&sort=` 列表
- `GET /api/public/apps/{slug}` 详情（含截图与当前版本）
- `GET /api/public/apps/{slug}/releases` 历史版本
- `GET /api/download/{releaseId}?exp=&sig=` 签名下载（流式，支持 Range）
- `GET /api/update/check?packageName=&versionCode=` 更新检查

管理（需登录）：
- `POST /api/admin/login`、`POST /api/admin/logout`
- `POST/PUT/DELETE /api/admin/apps`、`POST /api/admin/apps/{id}/publish`
- `POST /api/admin/apps/{id}/releases`（multipart 上传 APK 并解析）
- `POST /api/admin/releases/{id}/set-current`

### 3.4 更新检查返回（约定）

```json
{
  "hasUpdate": true,
  "forceUpdate": false,
  "latest": {
    "versionName": "1.2.0",
    "versionCode": 12,
    "changelog": "...",
    "fileSize": 12345678,
    "sha256": "...",
    "downloadUrl": "https://host/api/download/xx?exp=..&sig=..",
    "publishedAt": "2026-11-20T10:00:00Z"
  }
}
```

## 4. 约束与集成策略

- 不引入与现有项目冲突的约定（当前为空仓库）。
- 组件与样式复用统一封装，避免逐页复制。
- 所有人工录入项只保留文案与图片，技术性字段由 APK 解析自动生成，减少输入错误。
- 服务端不依赖外部云服务，纯本地文件与 SQLite，保证离线可跑。
- 安装流程严格走系统安装器，不做免确认安装。

## 5. 范围边界

严格按 ALIGNMENT 第 3 节执行。以下明确不做：多用户、收藏评论、灰度/渠道、iOS/桌面端、静默安装、对象存储与 CDN、支付。

## 6. 里程碑与交付物

| 里程碑 | 内容 | 交付物 |
|---|---|---|
| M1 | 数据模型、迁移、管理员登录、应用/版本管理 API 与 APK 解析 | 可用的后台接口 |
| M2 | Web 前台应用墙、详情、搜索筛选、签名下载 | 可浏览可下载的站点 |
| M3 | 管理后台页面（登录、应用表单、版本上传、发布/回滚） | 完整闭环后台 |
| M4 | Flutter 客户端（列表、详情、下载安装、更新检测） | 可安装的 APK |
| M5 | 更新接口接入示例、部署说明与自更新验证 | 文档 + 验收记录 |

## 7. 待确认事项

无。ALIGNMENT 第 8 节的默认值若需调整，请在批准前提出；批准后进入 Architect 阶段。
