# Codex Quota Panel 9

一个按照 Figma「Codex 额度面板 / 9」实现的 Windows 桌面小组件。它使用灰色轻拟态界面展示每周额度、重置日期、今日 Token 与累计 Token。

> 说明：本项目不是 OpenAI 官方产品。它只读解析 Codex 自己保存在本机的会话日志，不使用第三方额度插件、不读取聊天正文，也不上传任何数据。

## 功能

- 300 × 312 像素的无边框轻拟态面板
- Windows 系统托盘驻留，点击托盘图标显示或隐藏
- 窗口可拖动、默认始终置顶
- 自动聚合本机 Codex 会话的今日与累计 Token
- 读取 Codex 写入的真实 rate-limit 使用率和重置时间
- 每 30 秒自动刷新，也可按 `F5` 或右键手动刷新
- 右键菜单可编辑数据、切换置顶或退出
- 完全离线运行，不上传配额数据

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm start
```

## 测试与构建

```bash
npm test
npm run build
```

Windows 安装包和便携版会生成在 `dist/` 目录。

## 数据来源与边界

- 数据目录：`%USERPROFILE%\.codex\sessions`（可通过 `CODEX_HOME` 覆盖）。
- Token：按每个会话的 `token_count` 累计值计算增量，避免重复计算同一会话快照。
- 限额：读取 Codex 写入会话日志的最新 `rate_limits` 快照，因此 Codex 活跃时会随日志更新。
- 费用：个人 Codex 日志没有提供真实账单金额，所以界面改为展示真实输入/输出 Token，不把模型价目表估算冒充真实费用。
- 若 Codex 未提供某个限额窗口，卡片会明确显示“未提供”，不会填入示例日期。

## 开源协议

[MIT](./LICENSE)
