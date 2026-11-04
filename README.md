# MClaw（@magpie-community/opencode-mclaw-auth）

把中国移动云 **MClaw**（移动云盘 App 内的智能体，`ai.yun.139.com`）作为一个 OpenAI 兼容供应商接进 [magpie](https://usemagpie.ai) 与 OpenCode。装好后所有 agent（Claude Code、Codex、openclaw 等）都能通过 magpie 用 `mclaw/<model>` 访问 MClaw 的模型，并享受 magpie 的用量统计与故障切换。

接口协议 2026-11-04 从移动云盘 App 13.2.5 抓包逆向，Mac 直连全部实测通过。认证模式参照 [kasisama/magpie-joycode](https://github.com/kasisama/magpie-joycode)（`@magpie-community/opencode-joycode-auth` 同源做法）：登录信息存 magpie 的 `plugin-auth.json`（600），插件目录不落任何凭证。

## 安装

```bash
git clone https://github.com/joey-41/opencode-mclaw-auth.git MClaw
magpie plugin add ./MClaw
magpie plugin login mclaw
```

如要进官方插件市场（[magpie-community/plugins](https://github.com/magpie-community/plugins)），把本包放入 `packages/mclaw/` 并在 `registry.json` 登记条目：

```json
{ "package": "@magpie-community/opencode-mclaw-auth", "name": "MClaw", "providers": ["mclaw"], "community": true,
  "summary": { "en": "Unofficial MClaw provider: China Mobile Cloud's MClaw agent (ai.yun.139.com) with an OpenAI-compatible endpoint, live model catalogue with token multipliers, aitokens pool usage and optional per-request consumption details.", "zh": "非官方 MClaw 插件：中国移动云 MClaw 智能体（ai.yun.139.com），OpenAI 兼容接口，动态模型目录与积分倍率、aitokens 池用量及可选逐条消耗明细。" } }
```

## 登录需要什么

`magpie plugin login mclaw` 会依次要（App 凭证 / Cookie 在前，API Key 最后且输入不回显）：

| 项 | 必填 | 用途 | 从哪来 |
|---|---|---|---|
| **App Basic 凭证** | 可选 | 模型目录 + token 用量 | 移动云 App 任意 `ai.yun.139.com` 请求的 `Authorization` 头整段（`Basic bW9iaWxlOj…`）。抓包工具（ProxyPin 等）取一次即可，凭证文本里内嵌到期时间 |
| **vip Cookie** | 可选 | 用量里附带最近逐条消耗明细与重置时间 | 登录 `vip.yun.139.com/vip/consumptionDetail?sourceid=503016` 后的会话 Cookie（`mc_at=…` 等） |
| **API Key** | ✅ | chat（llm 开放接口） | MClaw 开放接口 key（`na-…`）。本机参考：us-3 new-api 渠道 10（CMCC_CLAW）的 key 即是 |

登录时插件会自动：校验 App 凭证有效性（失败会拦下登录）、给账号取显示名——优先 vip 会话的昵称接口（`/m4c/userDetail/queryUserBaseInfo`），否则从 Basic 凭证里解手机号掩码（`131****9239`，与 App 内显示一致）。

两套凭证互不通用（实测对照）：API key 只管 chat；App 凭证只管 models/usage。只填 API Key 也能聊天，用静态模型目录、无用量显示、账号名退化为「API key …后4位」。

## 模型（2026-11-04 快照，rate=App 的 tokenRatio 积分倍率）

登录后模型目录与倍率**自动发现**（agent/list + config/get，无需任何硬编码 ID）；下表是未登录时的静态目录。

| 模型 ID（`mclaw/…`） | 名称 | 倍率 | 备注 |
|---|---|---|---|
| `blian_qwen38_flash` | Qwen3.8-Flash | 0.18 | 推理；并行工具调用实测 8/8 |
| `blian_qwen38_max` | Qwen3.8-Max | 1.5 | 推理 |
| `huoshan_glm_5_3` | GLM-5.3 | 3.5 | 推理 |
| `blian_qwen37_plus` | Qwen3.7-Plus | 1.5 | 推理 |
| `blian_qwen36_plus` | Qwen3.6-Plus | 1.0 | |
| `blian_qwen35_plus` | Qwen3.5-Plus | 0.6 | 多模态 |
| `blian_deepseek_v4_pro` | DeepSeek-V4-Pro | 2.5 | 推理 |
| `vlm_huoshan_2_0_lite_thinking_vision` | Seed-2.0-Lite | 1.0 | 推理+视觉 |
| `vlm_huoshan_2_0_mini_thinking_vision` | Seed-2.0-Mini | 0.3 | 推理+视觉 |
| `huoshan_deepseek_v4_1_flash` | DeepSeek-V4.1-Flash | 未知 | 计费表未列出 |

## 插件调用的接口（均已实测）

| 用途 | 接口 | 认证 |
|---|---|---|
| chat | `POST https://ai.yun.139.com/api/llm/102001/v1/chat/completions` | `Bearer <API key>` |
| 实例发现+可用模型 | `POST https://ai.yun.139.com/api/adapter/assistant/agent/list`，body `{"sourceChannel":"101","sceneType":"homePage"}`（免 userId），`agentList` 里 `agentType=mclaw` 的 `agentId` 即 openclawId | `Basic <App 凭证>` + `x-yun-app-channel: 101` 等头 |
| 模型倍率 | `POST https://ai.yun.139.com/api/openclaw/config/get`，body `{"sourceChannel":"101","openclawId":"<自动发现>"}` | 同上 |
| token 余额 | `POST https://ypqy.mcloud.139.com/isbo2/openApi/queryAvailableBenefitV2`，body `{"account":{"userDomainId":""}}`（空账号即可，无需 userId） | `Basic <App 凭证>` |
| 逐条明细 | `POST https://vip.yun.139.com/m4c/benefit/getAiTokenConsumptionRecords`，body `{"pageNum":1,"pageSize":3,"action":["1","4"]}` | vip Cookie |
| SSO 票（备用） | `POST https://user-njs.yun.139.com/user/querySpecTokenV2`，body `{"toSourceId":"001003"}` → `YZsid…` | `Basic <App 凭证>` |

已知的其它接口（插件未用）：分组汇总 `vip.yun.139.com/m4c/benefit/getAiTokenUsageSumByGroup`（Cookie）；月度消耗 `ypqy.mcloud.139.com/isbo2/openApi/queryMonthlyTokenConsumption`（Basic + userId，`accountName` 传手机号会报「解密失败」）。网关 `GET /v1/models` 不存在（返回 01000005 资源不存在），所以模型列表只能走 config/get。

## 凭证生命周期与自动刷新（v0.2.0）

| 凭证 | 有效期 | 自动刷新 |
|---|---|---|
| llm API key | 未观察到有效期 | 无需 |
| App Basic 凭证 | ~30 天（到期时间内嵌在凭证文本 `\|RCS\|<ms>\|` 段，2026-12-03 签发批次） | ❌ 无续期接口（由 App 登录协议签发）。用量里会显示「凭证至 M/D」，过期后 magpie 标记需要重新登录，重新抓一次 Authorization 头再 login 即可 |
| vip Cookie | 会话级（实测 >15h） | ⚙️ 懒自动刷新：Cookie 失效时插件自动跑 SSO 链（Basic → `user-njs.yun.139.com/user/querySpecTokenV2` 出 YZsid 票 → `vip.yun.139.com/m4c/login/ssoLogin` 换会话，10 分钟冷却）。**2026-11-04 实测该链被 USER_DOMAIN 拒票**（200050409「统一通信证临时票据验证失败」——远程出的票与 App 出票上下文绑定），链路保留在代码里，上游放开即自动生效。换不到票时功能优雅降级 |

Cookie 拿不到时（或还没配）的降级策略：用量窗口照常（Basic 凭证驱动），「重置于」按月周期推算（锚点=每月 11 日 15:20:47 北京时间，来自 `[3000万 tokens/月]` 合同周期，与明细 endTime 观测一致），只少最近明细一行。

## 已知限制

- 上游会以 HTTP 200 返回裸 JSON 错误（如 `{"error":{"code":"01000002","message":"无效的ApiKey"}}`），插件已把这种响应转成明确的失败（01000002 → 401 登录失效）。
- App Basic 凭证有到期时间（凭证文本 `|RCS|<到期ms>|` 段），到期后用量/模型目录报失效，重新抓一次即可；llm key 未观察到有效期。
- 用量窗口的「重置于」优先取明细记录的 `endTime`（当前周期权威值，需 vip Cookie 有效）；拿不到时按月周期推算（每月 11 日 15:20:47），显示会标注「（按月周期推算）」。
- 上下文/输出上限 App 未暴露，插件按 200k/32k 声明，仅作调度参考，以上游实际判定为准。
- `rate` 是 App 计费倍率（如 flash 0.18×），不是美元价格。
- 供应商图标取自 yun.139.com 网站自己的 LOGO（`https://yun.139.com/w/static/img/LOGO.png`，移动云蓝色「云」标，index.html 的 apple-touch-icon 引用）；账号显示名是掩码手机号（App 昵称接口返回的也是掩码手机号）。改名后用量聚合里旧账号条目会作为历史留存，新调用计入新名字。

## Options

```bash
magpie plugin options mclaw '{"base": "https://ai.yun.139.com/api/llm/102001"}'
```

这是非官方适配插件，与中国移动或 magpie 官方无隶属关系。
