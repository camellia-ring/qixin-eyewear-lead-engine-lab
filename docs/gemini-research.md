# Gemini 官方联网研究

当前实现、验证与待办见 [项目交接](CODEX_HANDOFF.md)。

本功能位于“高级工具 → Google 联网研究”，仅由用户单次提交公开问题。Lead Engine 服务端直接调用 Gemini Developer API，默认 `gemini-2.5-flash`，请求明确启用 `google_search`。不依赖 Codex、ChatGPT 会话或 CLI 调度。

## 配置与免费资格

所有配置仅在服务端提供。密钥不得使用 `VITE_` 等公开前缀，不写入源码、终端输出或日志。模型查询成功只证明元数据可访问，不证明生成、搜索增强权限或费用。

| 环境变量 | 含义 |
| --- | --- |
| `GEMINI_API_KEY` | Gemini Developer API 密钥 |
| `GEMINI_RESEARCH_MODEL` | 默认 `gemini-2.5-flash` |
| `GEMINI_RESEARCH_FREE_TIER_CONFIRMED` | 核验完成后才设置 `true`；缺省关闭真实请求 |
| `GEMINI_RESEARCH_VERIFIED_MODEL` | 已核验免费的模型 ID，必须与当前模型相同 |
| `GEMINI_RESEARCH_PROJECT_ID` | 已核验的密钥所属项目 ID |
| `GEMINI_RESEARCH_KEY_SHA256` | 已核验密钥的 SHA-256；密钥变化后旧确认失效 |
| `GEMINI_RESEARCH_MAX_REQUESTS` | 单个研究服务实例的试验请求上限，默认 2，允许 1–20；本轮执行总预算仍最多 2 次 |

这些字段是操作员核验记录，不是 Google 返回的计费证明。项目 ID 非空或指纹匹配不能证明项目免费；不得为了通过门禁填写虚构项目、复用其他密钥的免费确认或仅凭公开价格表开启。改动 Billing、模型或密钥后先关闭确认标志再复核。

先检查 [AI Studio Projects](https://aistudio.google.com/projects) 中密钥对应项目的 Billing Tier，再检查 [Usage](https://aistudio.google.com/usage) 的模型 RPM/TPM/RPD、当前使用量及 Search Grounding 配额。关联 Billing 的项目还需单独确认输入、输出与思考 Token 是否收费。Google AI Pro、AI Studio 网页免费试用、模型免费额度、搜索增强免费额度分别判断。预算提醒和搜索免费额度都不保证整次调用零费用。

本地开发使用已有 Cloudflare Vite 的环境变量加载方式：服务端专用、Git 忽略的 `.env.local`，或运行环境注入的 Worker secrets。不要将本机 Windows 用户环境存在密钥误报为 Worker 已载入。启动开发服务使用 `npm run dev -- --host 127.0.0.1 --port 3041`，不创建隧道、不公开本机端口。部署时仍需 owner-only Sites 与服务端 secrets；本次没有配置线上 secrets、部署或启用生产能力。

首次核验最多两次生成请求，包含失败和重试，逐次人工发起。没有费用确认时完成模拟测试即可，不启用 Billing、充值、升级套餐或更换收费服务。

### 2026-09-17 用户提供的控制台记录

以下来源是用户提供的 AI Studio 项目截图与配额页面文字，**不是程序独立核验本地密钥归属或实时剩余额度**。

- 项目名称：`lead engine`；Project ID：`gen-lang-client-0574929071`。
- Billing Tier：Free Tier；页面操作提示“设置结算信息”；密钥数量：1。
- 本次预期使用该项目的 `GEMINI_API_KEY`，只在进程环境读取。密钥内容不落盘、不打印。

| 控制台项目 | RPM（峰值 / 限额） | TPM（峰值 / 限额） | RPD（峰值 / 限额） |
| --- | --- | --- | --- |
| Gemini 2.5 Flash | 0 / 5 | 0 / 250K | 0 / 20 |
| Gemini 2.5 Flash Lite | 0 / 10 | 0 / 250K | 0 / 20 |
| Gemini 2.5 搜索接地 | — | — | 0 / 1.5K |
| Gemini 2.5 Flash 地图接地 | — | — | 0 / 500 |
| Gemini 3 搜索接地 | — | — | 0 / 0 |

页面说明为“过去 28 天的峰值用量与用量限额”。前面的 0 不表示已独立确认的实时余量。本次使用 Flash 的 5 RPM、250,000 TPM、20 RPD 作为模型限额；工具的 1,500 RPD 不突破模型的 20 RPD，也不证明 1,500 次全部免费。

独立记录公开政策：本次检索的 Google 定价页列出 Gemini 2.5 Flash/Flash-Lite 共享的搜索免费层额度为 500 RPD。它与上述控制台工具限额不同；不猜测差异原因，不将工具配额等同免费计费权益。Gemini 3 搜索接地显示 0，不切换到该系列。项目免费档及账号状态以用户提供的记录为本次小规模验证依据，不声称通过 API 独立验证。

Google 官方说明限额按项目而非密钥计算，RPD 在太平洋时间午夜重置。本模块的本地限额统计不涵盖其他客户端或其他 Worker 实例，也不读取 Google 实时余量。

本地守卫以项目＋模型统计 60 秒滚动窗最多 5 次、250,000 Token 预留，以及 Pacific 自然日最多 20 次。试验总次数独立于项目/模型，换密钥不重置同一项目的统计；错误、限流和超时仍占尝试次数。Token 采用请求 UTF-8 字节数加输出上限的保守预留，响应中实际用量更高时只上调，不声称该估算等于 Google 的真实计数。计数不跨实例或重启持久化，不能用它代替账号全局配额或借重启扩大本轮授权。

## 结果及运行状态

- `GET /api/research/gemini` 只返回就绪状态、模型和安全原因，不发起生成。
- `POST /api/research/gemini` 仅接受同源 JSON `{ "query": "公开问题" }`；浏览器不能设置模型、工具、密钥或 endpoint。
- 每次请求只调用一次官方 `generateContent`，无自动重试或 Provider 回退。单实例防重复执行不是全局额度限制。
- 回答全部按纯文本展示，依据官方支持区间插入引用。中文与 emoji 使用 UTF-8 字节到浏览器字符索引转换，核对原文，不搜索猜测引用位置。
- 只有有效查询、来源和支持区间全部通过校验才显示“搜索依据已验证”。没有依据显示“未验证联网结果”，不是搜索成功。
- Google 搜索建议独立进行展示校验：保留安全的 HTML/CSS/原链接，在隔离的 Shadow DOM 中展示，不执行脚本、不自动访问引用、不跟踪点击；缺失或不安全时显示“展示要求未通过”。
- 页面关闭、切换或清除后结果释放。接口设置 `private, no-store`，不存入 D1、浏览器存储、候选库或默认日志。
- 日志仅保存状态、模型、耗时、用量、HTTP 状态和安全错误码。用量未提供时为 `null`，不推断零用量或零费用；默认不保存问题、回答、来源 URL、搜索建议或第三方原始错误。

## 使用限制与后续边界

依据 [Gemini API 附加条款](https://ai.google.dev/gemini-api/terms)，Grounding 结果、链接和搜索建议面向提交问题的用户组合展示。不能将 API 调用成功视为自动收集链接、建立索引、继续抓取、转交其他模型分析或建立 CRM 数据库的许可。有限的文本保存例外不等于客户数据入库许可。

本模块不接入自动发现注册表，不调用 Website Analyzer、DeepSeek、OpenAI、CRM 或 Cron，不提供批量链接导出/客户导入，不改动其他来源与现有分析能力。后续抓取、分析、长期保存及 CRM 入库分别需要核实用途许可，其他合规来源可独立继续开发。

官方依据：[REST 与元数据](https://ai.google.dev/gemini-api/docs/generate-content/google-search)、[定价](https://ai.google.dev/gemini-api/docs/pricing)、[配额](https://ai.google.dev/gemini-api/docs/rate-limits)、[附加条款](https://ai.google.dev/gemini-api/terms)。以使用时现行说明和具体账号为准。

## 验证

`node --import tsx --test tests/gemini-research.test.mjs` 通过注入模拟 fetch 验证费用门禁、请求工具、鉴权/限流/超时、响应结构、来源关联、Unicode、无持久化及脱敏日志，不发送真实 Google 请求。完整交付运行 `npm run check`。

真实验收从本应用面板提交一个公开眼镜行业问题，检查实际请求模型、工具开关、查询/来源/support 元数据、搜索建议展示、耗时、用量和错误。不把生成接口 200、普通模型回答或元数据查询成功当作 Grounding 通过。仅保存脱敏运行统计；真实回答和链接留在当前用户页面展示。

### 本轮真实尝试结果（2026-09-17）

使用本项目真实 Worker 服务端与研究面板，模型固定为 `gemini-2.5-flash`，请求体实际包含 `google_search`。其他 CRM/来源界面数据使用隔离模拟，不接触生产客户数据。密钥从 Windows User 环境临时注入最小白名单子进程环境，服务端配置 GET 返回 `ready:true`；这不证明密钥所属项目已由 API 独立核实。

| 尝试 | 上游 HTTP | 本地 HTTP / 错误码 | 耗时 | Token / grounding |
| --- | --- | --- | --- | --- |
| 1 | 未取得响应 | 502 / `gemini_network_failed` | 18 ms | 未提供 / 未取得 |
| 2 | 404 | 502 / `gemini_model_not_found` | 1587 ms | 未提供 / 未取得 |

第一次由真实 workerd 无网络构造探针定位为不支持 `redirect: "error"`；该尝试仍计入本轮两次预算。已修复为 `manual` 并明确拒绝任何 3xx，不向重定向目标转发密钥；302/307 模拟测试覆盖。

第二次收到配置模型生成端点的上游 404。同期使用相同环境密钥的只读模型元数据 GET 仍成功。元数据可读与生成权限是不同事实；没有保存第三方原始错误正文，不能进一步断言404具体属于模型权限、标识还是服务端可用性问题。

本轮两次尝试预算已耗尽，没有第三次生成，没有自动重试或换模型。服务和浏览器已关闭，未配置线上 secrets或计费。真实 Google Search 执行、真实引用及搜索建议展示仍未通过验证，不能宣称自动获客验收完成。下一步处理该模型在此 Developer API 项目上的生成端点可用性；可先用只读模型/官方说明核查，需要再次生成验证时另行限定新的请求预算，不重复向用户索取本页已记录的控制台字段。
