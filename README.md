# Codex Quota Panel

一个按照 Figma「Codex 额度面板 / 9」实现的 Windows 桌面面板。界面使用灰色轻拟态风格，展示官方账户的每周使用限额、可用额度重置、今日 Token 和累计 Token。

> 本项目不是 OpenAI 官方产品。它通过用户电脑上已登录的 OpenAI Codex 官方 app-server 读取账户用量，不读取其他额度插件，也不上传任何数据。

## 功能

- 560px 宽的无边框轻拟态面板，高度随实际重置卡片数量自动收缩
- 12px 正文/说明文字、14px 正文强调和 22px 标题，遵循 Windows 字体可读性建议
- 直接调用官方 `account/rateLimits/read`，同步每周限额、重置时间和 earned reset 明细
- 直接调用官方 `account/usage/read`，同步账户级今日 Token 与累计 Token
- Windows 系统托盘驻留，点击托盘图标显示或隐藏
- 安装包、任务栏和系统托盘统一使用 Figma 导出的蓝底灯塔 logo
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
- Token：`account/usage/read` 返回的账户级 `dailyUsageBuckets` 与 `summary.lifetimeTokens`，与 Codex 个人资料页使用同一官方口径。
- 降级数据源：`%USERPROFILE%\.codex\sessions`，仅在官方 app-server 暂不可用时启用，并在界面标为“本机”。
- 应用不会读取或输出 Codex 登录令牌；认证、刷新和官方接口请求均由 Codex app-server 自己完成。

参考：[OpenAI Codex app-server 协议](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)、[Microsoft Windows 字体规范](https://learn.microsoft.com/windows/apps/design/signature-experiences/typography)。

## 开源协议

[MIT](./LICENSE)
