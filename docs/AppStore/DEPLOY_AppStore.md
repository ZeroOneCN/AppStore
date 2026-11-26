# 部署与运维指南

适用于个人/内网/云服务器自建场景：Next.js 服务端 + SQLite + 本地文件存储。按本文步骤可在干净目录或容器中完成启动与首次发版。

## 1. 环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | 22 LTS 及以上 | 服务端与脚本运行时 |
| npm | 10 及以上 | 随 Node 安装 |
| 磁盘 | ≥ 2 GB 可用 | APK、图标、截图与数据库 |
| Flutter（可选） | 3.47+ | 仅构建 Android 客户端时需要 |

服务端解析 APK 使用纯 JavaScript 实现，**不需要**安装 Android SDK 或 Java。

## 2. 安装依赖

```bash
npm install
npx prisma generate
```

## 3. 配置 `.env`

复制模板并修改：

```bash
cp .env.example .env
```

生成两个随机密钥（分别执行一次）：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| 变量 | 必填 | 说明 |
|---|---|---|
| `BASE_URL` | 否 | 站点兜底基地址。页面展示、下载签名链接与 SEO 地址会优先根据请求头（Host / X-Forwarded-Host / X-Forwarded-Proto）自动推导，仅在无请求上下文时使用该值；HTTPS 部署时建议仍填 `https://你的域名` 作为协议兜底 |
| `DATABASE_URL` | 是 | 默认 `file:../data/appstore.db`，相对 `prisma/schema.prisma` 解析 |
| `STORAGE_DIR` | 是 | 文件根目录，默认 `./storage` |
| `DOWNLOAD_SIGN_SECRET` | 是 | 下载链接 HMAC 密钥，32 字节随机十六进制 |
| `SESSION_SECRET` | 是 | 统一会话签名密钥，管理员与开发者共用同一登录入口，角色由令牌载荷区分；32 字节随机十六进制 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 初始化时 | 仅 `npm run init-admin` 读取，初始化后可删除 `ADMIN_PASSWORD` 并重启 |
| `MAX_APK_MB` | 否 | 首次启动时的上传上限默认值，之后可在「后台 → 设置」中修改 |
| `NEXT_PUBLIC_SITE_NAME` | 否 | 首次启动时的站点名称默认值，之后可在「后台 → 设置」中修改 |

> 密钥只写入 `.env`，不要提交到 Git；`data/`、`storage/` 已被忽略。

## 4. 初始化数据库与管理员

```bash
npx prisma migrate deploy
npm run init-admin
```

`init-admin` 幂等：账号已存在时仅重置密码。完成后建议删除 `.env` 中的 `ADMIN_PASSWORD`，重启服务。

## 5. 启动

开发调试：

```bash
npm run dev
```

生产运行：

```bash
npm run build
npm start
```

默认监听 `3000` 端口并允许局域网访问（启动日志会打印 Network 地址）。首次访问：

- 宣传首页：`http://<主机IP>:3000/`
- 应用广场：`http://<主机IP>:3000/apps`
- 接入文档：`http://<主机IP>:3000/docs`
- 统一登录：`http://<主机IP>:3000/login`（管理员与开发者共用，登录后按角色进入对应控制台）

## 6. 内网访问与防火墙

1. 站点根地址会自动跟随访问域名；无请求上下文时使用「后台 → 设置」中的兜底地址或 `.env` 的 `BASE_URL`。
2. 放行 TCP 3000（Windows 防火墙或路由器策略）。
3. Android 客户端「设置」页填写实际访问地址并点「测试连接」。
4. 客户端允许明文 HTTP；如后续切换 HTTPS，把访问地址改为 `https://` 即可，无需改代码。

## 7. 首次发版流程

1. 打开 `/login`（管理员与开发者共用入口），登录后按账号角色自动进入 `/admin/apps` 或 `/developer/apps`。
2. 「新建应用」：填写名称、slug、简介、类型（Android 需包名），保存。
3. 应用详情页上传 APK（流式上传，自动解析版本号/包名/图标并校验大小与类型）。
4. 上传图标与截图（可选）。
5. 在版本列表中「发布」并「设为当前版本」。
6. 前台搜索该应用，确认图标、版本、更新日志与下载按钮正常。
7. 真机点击下载，安装器正常调起即完成首发。

## 8. 备份与恢复

需要备份的内容：

- `data/`：SQLite 数据库
- `storage/`：APK、图标、截图
- `.env`：密钥与配置（单独安全保存）

备份（先停止 `npm start`，避免 SQLite 写入中途复制）：

```bash
tar -czf appstore-backup-$(date +%Y%m%d).tar.gz data storage .env
```

恢复：解压覆盖上述目录 → `npx prisma migrate deploy` → `npm start`。

## 9. 切换 HTTPS（可选）

推荐用 Caddy 反向代理（自动证书）：

```caddyfile
store.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

或 Nginx：

```nginx
server {
    listen 443 ssl;
    server_name store.example.com;
    ssl_certificate     /etc/ssl/store.crt;
    ssl_certificate_key /etc/ssl/store.key;

    client_max_body_size 220m;   # 需大于 MAX_APK_MB

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
    }
}
```

切换后：

1. `.env` 中 `BASE_URL=https://store.example.com`，重启服务。会话 Cookie 会自动切换为 `Secure`，旧 HTTP 会话需重新登录。
2. 客户端「设置」页改为 HTTPS 地址。
3. 如不再需要 HTTP，可关闭 3000 端口的外部访问。

### 9.1 安全配置说明

- 全站已由应用下发 CSP、HSTS、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy、COOP/CORP 等响应头，反向代理无需重复配置。
- 写请求会校验 `Origin` 与当前站点是否一致；未携带 `Origin` 的原生客户端与脚本不受影响。
- 登录限流同时按来源 IP 与账号计数。**反向代理必须覆盖** `X-Real-IP` 与 `X-Forwarded-For`（如上例），否则客户端可伪造来源 IP；账号维度限流仍会生效。
- 站点根地址自动跟随访问域名，OpenAPI、更新检查与下载票据均返回 `no-store`，避免 Host 头缓存投毒。
- 会话 Cookie 为 `HttpOnly; SameSite=Lax`，HTTPS 下自动附加 `Secure`；密钥请使用至少 32 字节随机值。
- 已知限制：CSP 为兼容 Next.js 内联脚本保留 `unsafe-inline`；不存在的应用详情页受 PPR 流式渲染影响返回 200（内容为未找到页面）；限流计数保存在进程内，重启后清空。

## 10. 冒烟脚本说明

| 脚本 | 用法 | 前置条件 |
|---|---|---|
| `scripts/init-admin.ts` | `npm run init-admin` | 已迁移数据库，`.env` 有 `ADMIN_PASSWORD` |
| `scripts/smoke-seed.ts` | `npx tsx scripts/smoke-seed.ts` / `--cleanup` | 本地有示例 APK，路径见脚本内 `APK_SOURCE` |
| `scripts/api-smoke.mjs` | `node scripts/api-smoke.mjs [baseUrl]` | 已执行种子脚本并启动服务 |
| `scripts/admin-smoke.mjs` | `node scripts/admin-smoke.mjs [baseUrl]` | 已初始化管理员；设置 `ADMIN_PASSWORD`，可用 `SMOKE_APK` 覆盖 APK 路径 |
| `scripts/verify-apk.ts` | `npx tsx scripts/verify-apk.ts <apk路径>` | 无，独立校验 APK 元信息与 SHA-256 |

冒烟脚本会创建临时应用（如 `admin-smoke`），结束后会清理自身数据；如中断可手动在后台删除。

## 11. 常见问题

| 现象 | 排查 |
|---|---|
| 上传返回 `FILE_TOO_LARGE` | 调整 `MAX_APK_MB`，反向代理还需同步 `client_max_body_size` |
| 下载返回 410 `LINK_EXPIRED` | 签名链接有效期 10 分钟，客户端需重新获取票据 |
| 客户端连不上 | 检查 `BASE_URL`、手机与主机是否同网段、防火墙 3000 端口 |
| 安装器未弹出 | 检查「安装未知应用」权限是否授予商店客户端 |
| 时间显示偏差 | 服务端统一按 Asia/Shanghai 展示，数据库存 UTC |
| 生产环境样式缺失 | 确认已执行 `npm run build` 后再 `npm start` |

## 12. 升级

```bash
git pull
npm install
npx prisma migrate deploy
npm run build
# 重启 npm start
```

升级前先按第 8 节备份 `data/` 与 `storage/`。
