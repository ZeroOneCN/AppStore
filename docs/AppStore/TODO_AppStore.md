# 待办与已知限制

按优先级列出当前未完成项、需要人工确认的配置与操作指引。

## 1. 待验证（建议优先）

| 项 | 说明 | 建议处理 |
|---|---|---|
| MIUI 自更新最终安装 | F11 已完成自更新弹窗、下载与安装器调起；MIUI 对 162 MB 调试包云端扫描超时，未完成最后安装 | 换用 release 包（51.6 MB）或等待扫描完成后重试；确认版本号递增后再次验证 |
| 真机断点续传 | 接口 Range 206 已由 api-smoke 覆盖，客户端续传为代码走查 | 下载大文件途中关闭 Wi-Fi/切飞行模式，再重进下载页确认从断点继续且最终 SHA-256 一致 |
| admin-smoke 全量 | 示例包名 `com.packkeeper.packkeeper` 与现有应用唯一约束冲突，创建步骤 400 | 在干净数据库执行，或把脚本示例包名换成空闲包名并同步 `SMOKE_APK` |

## 2. 配置与上线

| 项 | 说明 |
|---|---|
| `.env` 生产值 | 确认 `BASE_URL` 为设备可达地址；`DOWNLOAD_SIGN_SECRET`、`SESSION_SECRET` 为独立随机值；初始化后删除 `ADMIN_PASSWORD` |
| HTTPS | 内网试用允许 HTTP；对外提供服务前按 DEPLOY 第 9 节接入反向代理并改 `BASE_URL` |
| 防火墙 | 放行 TCP 3000；反向代理场景仅本机监听并放行 443 |
| 备份 | `data/`、`storage/`、`.env` 需定期备份；当前未配置自动备份任务 |
| 客户端自更新 | 如需客户端自更新，需在后台发布「应用商店」应用，`packageName=com.appstore.appstore_client`，并随版本递增 versionCode |

## 3. 已知限制

1. **会话无状态**：登出仅清除 Cookie，已泄漏的 JWT 在过期前仍有效（DESIGN 约定）；如需强制撤销，需引入服务端会话表或 token 黑名单。
2. **下载计数**：每次成功响应计数，未做防刷/去重。
3. **QUERY_ALL_PACKAGES**：客户端为批量检测已安装版本申请该权限，仅适合个人内网分发，不适合上架应用市场。
4. **国产 ROM 安装提示**：MIUI 等会额外提示风险/备案信息，属系统行为，无法由商店绕过。
5. **真机证据**：截图保存在 `docs/AppStore/evidence/`，其余为命令输出记录。
6. **网页作品交互**：Web 前台验证了详情、截图与外部链接；客户端对网页作品以浏览器打开，未做内嵌 WebView。

## 4. 常用操作

| 操作 | 命令/路径 |
|---|---|
| 重置管理员密码 | 在 `.env` 设置新 `ADMIN_PASSWORD` 后执行 `npm run init-admin` |
| 校验 APK 元信息 | `npx tsx scripts/verify-apk.ts <apk路径>` |
| 初始化/清理示例数据 | `npx tsx scripts/smoke-seed.ts` / `npx tsx scripts/smoke-seed.ts --cleanup` |
| 接口冒烟 | `node scripts/api-smoke.mjs http://localhost:3000` |
| 后台冒烟 | `node scripts/admin-smoke.mjs http://localhost:3000` |
| 查看服务日志 | 运行 `npm start` 的终端输出 |
