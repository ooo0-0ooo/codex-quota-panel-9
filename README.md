# Codex Quota Panel

一个按照 Figma「Codex 额度面板 / 9」实现的 Windows 桌面面板。界面使用灰色轻拟态风格，展示每周使用限额、可用额度重置、今日 Token 和累计 Token。

> 本项目不是 OpenAI 官方产品。它通过用户电脑上已登录的 OpenAI Codex 官方 app-server 读取账户用量，不读取其他额度插件，也不上传任何数据。

## 功能

- 560px 宽的无边框轻拟态面板，高度随实际重置卡片数量自动收缩
- 三张重置卡片与两张 Token 卡片等高；超过三张时显示独立滚动条，面板悬停滚轮可滚动重置列表
- 12px 正文/说明文字、14px 正文强调和 22px 标题，遵循 Windows 字体可读性建议
- 直接调用官方 `account/rateLimits/read`，同步每周限额、重置时间和 earned reset 明细
- 逐条汇总本机当日 session 日志中的 `last_token_usage`，实时显示今日 Token
- 直接调用官方 `account/usage/read`，同步账户级累计 Token
- 首次启动跟随 Windows 系统语言，之后可在面板内切换中文和英文并记住选择
- Windows 系统托盘驻留，点击托盘图标显示或隐藏
- 安装包、任务栏和系统托盘统一使用 Figma 导出的沙漏 logo
- 窗口可拖动、默认始终置顶
- 每 60 秒自动刷新，也可按 `F5` 或右键手动刷新
- 官方服务暂不可用时，只读本机 `%USERPROFILE%\.codex\sessions` 作为明确标注的降级数据

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

## 数据来源与边界

- 首选数据源：OpenAI Codex 官方 app-server。
- 每周限额：`account/rateLimits/read` 返回的最长限额窗口。
- 额度重置：`rateLimitResetCredits`；不会再把每周限额窗口重复显示为额度重置。
- 今日 Token：读取 `%USERPROFILE%\.codex\sessions` 中时间戳落在本机当天的 `event_msg/token_count`，逐条累加 `last_token_usage`；会扫描所有会话文件，因为跨日续接的任务仍写入最初创建日期的文件。不包含其他设备、已删除日志或云端未落盘的当天活动。
- 累计 Token：使用 `account/usage/read` 返回的账户级 `summary.lifetimeTokens`，与 Codex 个人资料页使用同一官方口径。
- 若当天没有可验证的本机日志，Token 卡片会显示官方最新日桶并标为“昨日”，不会把延迟数据冒充成今天。
- 应用不会读取或输出 Codex 登录令牌；认证、刷新和官方接口请求均由 Codex app-server 自己完成。

今日 Token 的逐事件统计方式参考了 MIT 开源项目 [1nuYasha-cck/codex-quota-widget](https://github.com/1nuYasha-cck/codex-quota-widget)，并修正了其仅扫描当天目录、会漏掉跨日续接会话的限制。

参考：[OpenAI Codex app-server 协议](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)、[Microsoft Windows 字体规范](https://learn.microsoft.com/windows/apps/design/signature-experiences/typography)。

## 开源协议

[MIT](./LICENSE)
