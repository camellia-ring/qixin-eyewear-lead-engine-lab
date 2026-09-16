# Lead Engine 当前交接

更新日期：2026-09-17。任务分支：`codex/gemini-grounded-research`。本次在 `ea9b770` 基线上增量加入 Gemini Developer API 人工联网研究，不替换其他数据源或 CRM 的 DeepSeek 能力。当前 Lead Engine 工作树原本没有 DeepSeek 实现；前一轮广泛升级仍属规划。

## 已完成

- 高级工具研究面板、同源服务端 REST 接口、明确 `google_search` 工具配置、模型可配置、凭据及免费资格对应门禁。
- 完整文本与引用、Google 搜索建议安全展示、验证状态、Token/耗时及安全错误；不保存研究正文或链接，不接入采集、评分、CRM 或 Cron。
- 有界流读取、超时取消、单次请求无重试/无 Provider 回退；仅单实例并发防重复，不宣称分布式额度控制。
- 修复两项原有测试中的旧 AGENTS 原句断言；现行人工批准、外部授权及数据隔离检查仍保留，未修改业务规则。
- `npm run check` 通过：类型、Lint、构建、19 项结构/集成检查及 55 项 unit/migration 测试，其中 Gemini 专项 10 项。
- Playwright 真浏览器、模拟 API：完整回答及引用、Google 建议、等待禁用、未验证状态、危险 HTML/CSS/SVG 拒绝、429 提示、无浏览器存储通过；1440px 桌面与 390px 手机布局无横向溢出。浏览器记录中的 429 是刻意模拟。
- 本地真实接口 GET 返回 `ready:false`、`private,no-store`；同源 POST 在免费资格未配置时返回 503，未发起 Gemini 生成。
- 待提交文件扫描未发现本机实际 Gemini 密钥。

模拟测试日志与截图为本机辅助证据，不提交：`E:/aQiXin/qixin-lead-engine/outputs/gemini-check.log`、`gemini-desktop.png`、`gemini-mobile.png`；浏览器操作脚本为同目录 `gemini-browser-setup.txt` 和 `gemini-browser-check.txt`。截图明确为模拟研究，不是真实联网结果。

## 未完成及边界

- 用户已确认模型与搜索增强有免费额度；仍缺当前密钥对应的项目 ID、Billing Tier 及实际剩余配额资料。已询问，不重复索取授权，也不凭公开价格表开启。
- Windows User 环境已有 `GEMINI_API_KEY`，当前进程未继承；没有把密钥写入仓库、上传 Sites secret 或启用运行环境免费确认。
- 前一轮元数据 GET 已返回 `models/gemini-2.5-flash`、版本 `001`、支持 `generateContent`。这不是生成权限或 Google Search 实际执行验证。
- 本次真实 Gemini 生成请求数为 0；真实 Grounding 与真实 Google 搜索建议格式仍待验证。
- 没有部署、生产客户数据操作、发邮件或启用自动采集/DeepSeek 转交/CRM 入库。新旧 CRM 切换不属于本次。
- 本地开发服务使用回环端口 3041，未启用 Cron；浏览器演示使用合成数据。恢复时核对进程，不假定仍在运行。

## 下一动作

取得当前密钥对应项目与配额信息后，按 [配置及用途说明](gemini-research.md) 核实本次请求整体免费，在本地服务端注入该密钥和对应确认记录。先从应用面板发起一次公开行业研究；必要时总计最多两次。检查请求模型、真实 grounding 查询/来源/supports、原样建议展示、耗时和用量。无法确认免费或返回无依据时如实记录，不自动重试或升级收费。

原 Lead Engine 多来源升级及合规来源工作可独立继续，本 Gemini 研究结果不能作为批量获客数据库授权。
