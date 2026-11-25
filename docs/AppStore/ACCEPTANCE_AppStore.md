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

### 待补测（B1 遗留）

| 项 | 原因 | 计划 |
|---|---|---|
| 真实 APK 的包名、versionCode、图标、签名指纹解析 | 当前环境无 APK 样例，不以伪造文件代替 | B5 产出商店 APK 后回灌验证，或用户提供任一 APK |
| `app-info-parser` 在真实 APK 上的字段形态（icon 为 data URI / base64） | 同上 | 同上 |

## B2–B6

尚未开始。
