# Codex Quota Panel

一个按照 Figma「Codex 额度面板」实现的 Windows 桌面面板。界面使用灰色轻拟态风格，显示每周使用限额、可用额度重置、今日 Token 和累计 Token。

> 本项目不是 OpenAI 官方产品。它通过用户电脑上已登录的 OpenAI Codex 官方 app-server 读取账户数据，并读取本机 Codex 会话日志补齐官方尚未生成的当天实时用量；不依赖其他额度插件，也不上传任何数据。

## 功能

- 与设计稿一致的无边框轻拟态面板，面板高度随实际重置卡片数量自动收缩。
- 语言、最小化、关闭三个等尺寸窗口按钮；关闭后驻留系统托盘，最小化后进入任务栏。
- 中文 / 英文切换，首次使用自动跟随 Windows 系统语言。
- 三张重置卡片与两张 Token 卡片等高；超过三张时显示独立滚动条，鼠标悬停面板滚轮可滚动重置列表。
- 只有「使用重置 / Use reset」按钮可触发额度重置；二次确认后调用 Codex 官方重置接口。
- 系统托盘右键菜单支持显示面板、始终置顶、开机自启动和退出。
- 安装包、任务栏和系统托盘统一使用 Figma 导出的 logo。
- 启动时立即更新，之后每 60 秒自动更新；也可按 `F5` 或在面板右键菜单中手动更新。

## 数据来源、取数方式和更新频率

| 面板数据 / 操作 | 数据来源 | 取数与校验方式 | 更新频率 |
| --- | --- | --- | --- |
| 每周使用限额、剩余百分比 | OpenAI Codex 官方 app-server：`account/rateLimits/read` | 从 `rateLimits` 中选择持续时间最长的限额窗口；直接使用官方 `usedPercent`。 | 启动时、每 60 秒、`F5` / 手动刷新、成功使用重置后 |
| 周限额重置日期和时间 | 同上 | 直接读取官方 `resetsAt` Unix 时间戳，并按 Windows 本地时区显示为 `M/D HH:mm`；小时和分钟不是推算值。 | 同上 |
| 使用限额重置卡片 | 同上返回的 `rateLimitResetCredits` | 读取每一项的 `id`、`title`、`status`、`expiresAt`；有几项显示几项，不用周限额窗口补卡片。 | 同上 |
| 使用一次重置 | OpenAI Codex 官方 app-server：`account/rateLimitResetCredit/consume` | 只在具体卡片的按钮点击并通过二次确认后提交该卡片 `creditId`，每次请求附带新的 `idempotencyKey` 防止重复消费；按官方返回的 `reset`、`nothingToReset`、`noCredit` 或 `alreadyRedeemed` 处理。 | 用户确认时调用一次，成功后立即刷新全部数据 |
| 今日 Token | 优先使用官方 `account/usage/read` 的当日 `dailyUsageBuckets`；官方当日桶尚未生成时，使用 `%USERPROFILE%\.codex\sessions\**\*.jsonl` | 官方当日桶存在时直接使用官方账户级数值。否则扫描所有会话目录中时间戳落在本机当天的 `event_msg/token_count`：用同一会话 `total_token_usage` 的正增量计数；会话首条或计数器重置时回退到 `last_token_usage`；重复的累计快照计为 0。扫描所有历史日期目录是为了包含当天继续运行、但仍写入原创建日期文件的跨日会话。 | 启动时、每 60 秒、`F5` / 手动刷新 |
| 累计 Token | OpenAI Codex 官方 app-server：`account/usage/read` | 直接使用账户级 `summary.lifetimeTokens`。 | 同上 |
| 官方每日用量降级 | 同上返回的 `dailyUsageBuckets` | 如果当天既没有官方当日桶，也没有可验证的本机事件，则显示官方最新日桶；若该桶是前一天，界面明确标为「昨日用量」。 | 同上 |

### 今日 Token 的准确性边界

官方当日 `dailyUsageBuckets` 一旦可用，应用优先显示它，因为这是账户级权威值。官方当天尚未出桶时，本机日志值能准确覆盖这台电脑上仍保留日志的 Codex 活动，但不能包含其他设备、已删除日志、云端未落盘任务，也不能可靠区分同一台电脑上先后登录的不同用户。

实时统计思路参考了 MIT 项目 [1nuYasha-cck/codex-quota-widget](https://github.com/1nuYasha-cck/codex-quota-widget/blob/main/src/main/quota-service.js)，并修正了两个会导致结果不同的问题：

1. 参考实现只枚举当天、本地日期相邻的 UTC 日期目录；跨日续接的会话可能继续写入更早的创建日期目录，因此会漏计。
2. 参考实现逐条相加 `last_token_usage`；本项目优先使用累计快照的增量，并忽略未变化的重复快照，避免重复计数。

为了便于核验，返回的今日数据还带有只读诊断字段：扫描会话数、原始事件数、实际计数事件数、重复快照数，以及按会话创建日期拆分的 Token 数。

## 隐私与认证

- 应用不读取或输出 Codex 登录令牌。
- 认证、刷新和官方接口请求由本机 Codex app-server 完成。
- 本机日志只在本机读取和汇总，不上传到本项目或第三方服务。

## 本地运行

需要 Node.js 22 或更高版本，并已安装、登录 OpenAI Codex。

```bash
npm install
npm start
```

## 测试与构建

```bash
npm test
npm run capture
npm run build
```

Windows 安装包和便携版会生成在 `dist/` 目录。

参考：[OpenAI Codex app-server 协议](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)、[Microsoft Windows 字体规范](https://learn.microsoft.com/windows/apps/design/signature-experiences/typography)。

## 开源协议

[MIT](./LICENSE)
