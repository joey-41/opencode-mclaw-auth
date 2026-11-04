# Changelog

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
