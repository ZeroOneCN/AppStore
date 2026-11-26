# 交付总结

日期：2026-11-25

## 1. 目标与范围

自建个人应用商店：Next.js Web 前台 + 管理后台 + Flutter Android 客户端，支持 Android APK 与网页作品，公开浏览、单管理员维护、签名短链下载、商店全局更新检测与标准更新接口。部署目标为本机/内网，所有密钥走环境变量。

## 2. 技术栈

| 层 | 选型 |
|---|---|
| Web | Next.js 16 App Router（PPR）、React 19、TypeScript、Tailwind 4 |
| 数据 | Prisma 6 + SQLite；文件落盘 `storage/` |
| 安全 | `jose` HS256 会话、HMAC 下载短链（10 分钟）、Zod 校验、登录限流 |
| 客户端 | Flutter 3.47（Android）、dio、path_provider、crypto、package_info_plus |
| 测试 | Vitest（服务端 47 例）、flutter_test（5 例）、HTTP 冒烟脚本 |

## 3. 交付物

- 前台：应用墙（搜索/筛选/排序）、应用详情、截图灯箱、下载。
- 后台：登录、应用 CRUD、APK 流式上传与自动解析、版本发布/设为当前/归档、图标与截图管理、危险操作确认。
- 接口：公开列表/详情/历史版本/下载票据、`/api/update/check`、管理 API、签名下载与资源访问。
- 客户端：应用墙、详情、下载安装（续传 + SHA-256 校验）、安装权限引导、更新页、启动自更新、基地址设置。
- 脚本：初始化管理员、APK 校验、API/后台冒烟、示例数据。
- 文档：对齐/共识/设计/任务/验收/部署/接入/总结/待办。

## 4. 验收结果

F1–F12 全部有对应实现与证据，其中 F11（商店自更新）最终安装步骤受 MIUI 云端扫描影响未在验收时间内完成，其余通过。真机（Xiaomi 23127PN0CC）已验证浏览、详情、100 MB 下载、安装与更新检测；1.3 倍字体与 360dp 窄屏无溢出。

关键数据：服务端 47/47 单测、api-smoke 18/18、flutter 5/5、`npm run build` 与 `flutter build apk --release`（51.6 MB）成功。详见 [ACCEPTANCE_AppStore.md](file:///c:/Code/AppStore/docs/AppStore/ACCEPTANCE_AppStore.md)。

## 5. 关键设计决策

1. 单一管理员 + 无公开注册，降低个人部署的运维面。
2. APK 元信息、图标、SHA-256 全部由上传文件解析，避免手工录入不一致。
3. 下载使用 HMAC 短链，链接 10 分钟过期；支持 Range 以配合客户端续传。
4. 更新检测同时服务两类场景：商店客户端批量检测已安装应用，以及单个 App 通过标准接口自接入。
5. 客户端不引入安装插件，通过 MethodChannel 调系统安装器，权限与 FileProvider 配置可控。
6. 内网部署允许明文 HTTP，`BASE_URL` 与密钥全部环境变量化，切换 HTTPS 只改配置。

## 6. 已知限制

见 [TODO_AppStore.md](file:///c:/Code/AppStore/docs/AppStore/TODO_AppStore.md)，主要包括：MIUI 下自更新最终安装待复测、冒烟脚本在干净数据环境执行、真机人为断网续传未实测、HTTPS 与备份自动化尚未落地。

## 7. 运维入口

- 部署与升级：[DEPLOY_AppStore.md](file:///c:/Code/AppStore/docs/AppStore/DEPLOY_AppStore.md)
- 接入示例：[INTEGRATION_AppStore.md](file:///c:/Code/AppStore/docs/AppStore/INTEGRATION_AppStore.md)
- 统一登录入口：`/login`（管理员与开发者共用，登录后按角色进入控制台）
- 初始化/重置管理员：`npm run init-admin`
