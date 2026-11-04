# Changelog

## 0.4.0 — 2026-11-05

- **浏览器登录（一次登录，凭证全自动）**：新增 oauth 型登录方式——插件弹专属 profile 的 Chrome（CDP 管道驱动 `--remote-debugging-pipe`，无端口、不碰系统浏览器），在窗口里完成移动云短信登录后，插件自动收割 `authorization` Cookie（= `pc:` 票，30 天期）。
- **`/api/llm/apikey/get` v1 集成（key+倍率一步拿）**：Basic 票（`mobile:`/`pc:` 均可，实测）POST `{"channelId":"102001"}` 一次返回真正的 llm chat key + 9 模型倍率表。浏览器登录零手动粘贴；手动粘贴方式下倍率也改走此接口（config/get 降为兜底——它只认 App 渠道票）。
- **自动续期**：oauth 账号到期前 3 天（refreshLead）宿主调 refresh 钩子，插件 headless 复开 profile，网页应用自己刷新会话后重新收割票（票变了顺手刷新 metadata.apiKey）。
- llm key 自动获取失败时可手动填（浏览器登录方式里的可选项）；chat 仍只认 na- key（pc 票不能直连 chat，网页聊天走另一套中继协议不可复用）。
- 新文件 browser.mjs（CDP 客户端，移植自 gcp-ai 的管道客户端，MIT）；profile 默认 `~/.config/magpie/mclaw-browser-profile`，`MCLAW_CHROME_PATH` / `MCLAW_BROWSER_PROFILE` 可覆盖。

## 0.3.0 — 2026-11-04

- openclawId 完全自动发现（agent/list 免 userId，agentType=mclaw 的 agentId），仓库与代码不再含实例 ID。
- 修复模型倍率（rate）在 magpie 里显示为 0 的问题：宿主传给 provider.models 钩子的 provider 是归一化对象（自定义字段被剥、config 模型的 rate 也不带），插件改为只用闭包值并保证钩子成功返回。
- 模型目录改为 agent/list（账号实际可用，新增 huoshan_deepseek_v4_1_flash）× config/get（倍率）合并。
## 0.2.0 — 2026-11-04

- 凭证生命周期管理：用量里显示 App Basic 凭证到期日（「凭证至 M/D」）；vip Cookie 失效时自动尝试 SSO 换票链（Basic → querySpecTokenV2 → ssoLogin，10 分钟冷却），换不到则「重置于」按月周期（每月 11 日 15:20:47）推算并标注。
- 登录时自动校验 App 凭证并设置账号显示名（掩码手机号，走 metadata.email）。

## 0.1.2 — 2026-11-04

- 供应商图标换成 yun.139.com 站点 LOGO（移动云蓝色「云」标）。

## 0.1.1 — 2026-11-04

- api 登录方法增加 authorize：校验凭证 + 自动取名。
- 用量窗口支持 resetsAt（「重置于」，来自明细 endTime）。

## 0.1.0 — 2026-11-04

- 首个版本：MClaw（ai.yun.139.com）接入 magpie/OpenCode。OpenAI 兼容 chat（/api/llm/102001）、模型目录（/api/openclaw/config/get，含 9 模型与积分倍率）、aitokens 用量（RHR135 池）、可选 vip Cookie 逐条消耗明细。
