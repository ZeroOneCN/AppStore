# AppStore 接口说明

公开浏览与更新检查无需登录；后台接口使用登录后下发的会话 Cookie（`appstore_session`）。
完整机器可读描述见 `GET /api/openapi`（OpenAPI 3.1），本文补充调用示例与常见场景。

- 基地址：`BASE_URL`（开发默认 `http://localhost:3000`）
- 返回格式：除下载接口外均为 JSON，错误结构为 `{ "error": { "code": "...", "message": "..." } }`
- 缓存：公开列表与详情遵循页面缓存策略；更新检查、下载短链与后台接口均为 `no-store`

## 一、公开接口

### 1. 应用列表

`GET /api/public/apps`

| 参数 | 说明 |
|---|---|
| `q` | 关键词，匹配名称与简介 |
| `category` | 分类精确匹配 |
| `tag` | 标签精确匹配 |
| `type` | `ANDROID` / `WEB` |
| `sort` | `recent`（默认）/ `name` / `downloads`；置顶应用始终优先 |

```bash
curl "$BASE_URL/api/public/apps?type=ANDROID&sort=downloads"
```

响应：

```json
{
  "total": 4,
  "items": [
    {
      "id": "cmww2f1mh00038fbgtgiytzcm",
      "slug": "ai-jian-shen",
      "name": "爱健身",
      "summary": "1324 个动作、离线可用、无需注册的徒手健身 App",
      "type": "ANDROID",
      "category": "健康",
      "tags": ["健身", "离线", "无需注册"],
      "iconUrl": "/api/assets/icons/xxx.png",
      "packageName": "com.aijianshen.app",
      "visibility": "PUBLIC",
      "pinned": false,
      "downloadCount": 0,
      "updatedAt": "2026-11-25T09:00:00.000Z",
      "currentVersion": { "versionName": "1.9.5", "versionCode": 16, "publishedAt": "..." }
    }
  ]
}
```

### 2. 应用详情

`GET /api/public/apps/{slug}`

在列表字段基础上增加 `description`、`screenshots`（可直接访问的站内地址）、`webUrl`、`currentRelease`（含 `downloadUrl`、`sha256`、`minSdk`）与 `releases`（已发布版本列表）。私有或不存在返回 404。

### 3. 版本列表

`GET /api/public/apps/{slug}/releases` —— 返回该应用所有已发布版本（版本号倒序）。

### 4. 下载短链

`GET /api/public/releases/{id}/download-ticket` —— 返回签名后的 `downloadUrl` 与过期时间，避免直接暴露存储路径。

### 5. 下载 APK

`GET /api/download/{id}?expires=...&signature=...` —— 返回 APK 流，支持 `Range` 断点续传（206）。签名过期返回 410。

## 二、应用内更新检查

`GET /api/update/check?packageName={包名}&versionCode={当前版本号}`

```json
{
  "hasUpdate": true,
  "forceUpdate": false,
  "reason": null,
  "latest": {
    "versionName": "1.9.5",
    "versionCode": 16,
    "changelog": "1.9.5：动作库与训练计划优化",
    "fileSize": 99733590,
    "sha256": "…",
    "minSdk": 24,
    "minSupportedVersionCode": 8,
    "downloadUrl": "/api/download/…?expires=…&signature=…",
    "publishedAt": "2026-11-25T09:00:00.000Z"
  }
}
```

约定：
- 应用不存在或没有正式版本时仍返回 200，`hasUpdate=false`、`reason="NOT_FOUND"`
- `forceUpdate` 由版本的强制更新标记或 `minSupportedVersionCode` 判定
- `downloadUrl` 已带签名，可直接下载；有效期 10 分钟，请使用 HTTPS 并校验 `sha256`
- 只返回「公开 + 已发布」的版本；单 IP 每分钟最多 120 次，超出返回 429
- 开发者可在门户「接入文档」页查看 Kotlin / Flutter 示例（`/developer/docs`）

## 三、后台接口

登录后浏览器自动携带 Cookie；脚本可用 `curl -c cookies.txt` 保存会话。

| 方法与路径 | 说明 |
|---|---|
| `POST /api/admin/login` | `{ "username", "password" }`，连续失败会触发限流（429） |
| `POST /api/admin/logout` | 清除会话 Cookie |
| `POST /api/admin/password` | `{ "currentPassword", "newPassword" }`，新密码至少 8 位 |
| `GET /api/admin/apps` | 全部应用（含私有与草稿） |
| `POST /api/admin/apps` | 创建应用；`slug` 重复时自动追加序号，包名重复报 400 |
| `PUT /api/admin/apps/{id}` | 更新应用，仅传需要修改的字段 |
| `DELETE /api/admin/apps/{id}` | 删除应用、版本记录与磁盘文件 |
| `POST /api/admin/apps/{id}/releases` | 请求体为 APK 二进制流；`X-Version-Changelog` 头传 URL 编码的更新日志 |
| `POST /api/admin/releases/{id}/publish` | 发布并设为当前版本 |
| `POST /api/admin/releases/{id}/archive` | 归档版本 |
| `POST /api/admin/releases/{id}/set-current` | 切换到该版本（回滚） |
| `DELETE /api/admin/releases/{id}` | 删除历史版本，当前版本返回 400 |
| `GET/POST /api/admin/developers` | 开发者列表（含应用数）/ 创建开发者 |
| `PATCH /api/admin/developers/{id}` | `{ "status": "ACTIVE" \\| "DISABLED" }` 启停 |
| `POST /api/admin/developers/{id}/reset-password` | 重置密码，明文仅在本次响应返回一次 |

## 四、开发者接口

开发者登录使用独立 Cookie（`appstore_dev_session`），与管理员会话互不通用；所有接口只能操作归属自己的应用。

| 方法与路径 | 说明 |
|---|---|
| `POST /api/dev/login` | `{ "username", "password" }`，失败限流同管理员 |
| `POST /api/dev/logout` / `POST /api/dev/password` | 登出 / 修改自己的密码 |
| `GET/POST /api/dev/apps` | 我的应用列表 / 创建应用（归属自动写入） |
| `GET/PUT /api/dev/apps/{id}` | 应用详情与版本记录 / 更新基础资料 |
| `POST /api/dev/apps/{id}/releases` | 二进制流上传 APK，解析成功后自动发布为当前版本 |
| `POST /api/dev/apps/{id}/icon`、`POST/DELETE .../screenshots` | 图标与截图管理 |
| `POST /api/dev/releases/{id}/set-current` / `archive` | 切换当前版本 / 归档 |
| `DELETE /api/dev/releases/{id}` | 删除历史版本（当前版本禁止） |

上传示例：

```bash
curl -c cookies.txt -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"…"}'

curl -b cookies.txt -X POST "$BASE_URL/api/admin/apps/{id}/releases" \
  -H "Content-Type: application/octet-stream" \
  -H "X-Version-Changelog: 1.9.5%EF%BC%9A%E4%BC%98%E5%8C%96" \
  --data-binary @app-release.apk
```

版本号、包名、签名指纹与图标全部从 APK 自动解析；版本号重复会在落盘前被拒绝（409）。

## 四、页面与元数据

| 路径 | 说明 |
|---|---|
| `/api/openapi` | OpenAPI 3.1 描述 |
| `/manifest.webmanifest` | PWA 清单（可添加到主屏） |
| `/robots.txt` | 抓取规则，屏蔽 `/admin` 与 `/api` |
| `/sitemap.xml` | 首页与公开应用详情 |
| `/opengraph-image` | 1200×630 分享卡片图 |
