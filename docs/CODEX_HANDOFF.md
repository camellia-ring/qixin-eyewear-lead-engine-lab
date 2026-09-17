# Lead Engine 当前交接

更新日期：2026-09-17。任务分支：`codex/gemini-grounded-research`。初版提交 `dc777be`；本轮继续补充用户控制台记录、限额与真实验证，不替换其他数据源或 CRM 的 DeepSeek 能力。当前 Lead Engine 工作树原本没有 DeepSeek 实现；前一轮广泛升级仍属规划。

## 已完成

- 高级工具研究面板、同源服务端 REST 接口、明确 `google_search` 工具配置、模型可配置、凭据及免费资格对应门禁。
- 完整文本与引用、Google 搜索建议安全展示、验证状态、Token/耗时及安全错误；不保存研究正文或链接，不接入采集、评分、CRM 或 Cron。
- 有界流读取、超时取消、单次请求无重试/无 Provider 回退；增加5 RPM、250k TPM保守预留、20/Pacific日与默认2次试验上限。失败占次数、同项目换key不清零；本地计数不跨实例/重启，不宣称全局额度控制。
- 修复两项原有测试中的旧 AGENTS 原句断言；现行人工批准、外部授权及数据隔离检查仍保留，未修改业务规则。
- 本轮 `npm run check` 通过：类型、Lint、构建、19 项结构/集成检查及 62 项 unit/migration 测试，共81项，其中 Gemini 专项17项。
- Playwright 真浏览器、模拟 API：完整回答及引用、Google 建议、等待禁用、未验证状态、危险 HTML/CSS/SVG 拒绝、429 提示、无浏览器存储通过；1440px 桌面与 390px 手机布局无横向溢出。浏览器记录中的 429 是刻意模拟。
- 未配置环境的503门禁验收保留；本轮根据用户提供的信息临时注入进程配置，真实Worker GET返回`ready:true`，完成2次有预算的生成尝试。首次18ms本地构造失败，第二次1587ms得到上游404，无Token/grounding响应。详见[结果](gemini-research.md)。
- 修复真实workerd不支持`redirect:error`的问题：使用manual并拒绝任何3xx；302/307不follow、不转发key的测试通过。
- 待提交文件扫描未发现本机实际 Gemini 密钥。

模拟测试日志与截图为本机辅助证据，不提交：`E:/aQiXin/qixin-lead-engine/outputs/gemini-live-check.log`、`gemini-desktop.png`、`gemini-mobile.png`；浏览器操作脚本为同目录 `gemini-browser-setup.txt` 和 `gemini-browser-check.txt`。截图明确为模拟研究，不是真实联网结果。本轮真实尝试在 `E:/AQiXinRuntime/temp/gemini-live-20260917/` 有两个不含密钥/正文的attempt预留文件；不得以重启服务或清空账本扩大已用完的本轮2次预算。

## 未完成及边界

- 用户已提供项目 `lead engine` / `gen-lang-client-0574929071`、Free Tier、“设置结算信息”、1个key及完整配额表，见配置文档；不要再次要求相同字段。它们不是程序独立验证密钥归属，28天峰值中的0不是实时剩余。
- Windows User `GEMINI_API_KEY`可读，已在本轮真实Worker进程注入成功；没有把密钥写入代码、文档、日志或Git，没有上传Sites secret。实际调用环境已关闭，不保留运行授权为开启状态。
- 本轮同密钥元数据GET继续成功返回`models/gemini-2.5-flash`，但generateContent上游404。这不证明生成权限或搜索实际执行；具体404原因尚未独立确认。
- 本轮生成尝试2次（含首次未发出的本地构造失败），预算耗尽；Google搜索增强、真实引用与搜索建议格式未验证，不存在可交付的真实研究回答。
- 没有部署、生产客户数据操作、发邮件或启用自动采集/DeepSeek 转交/CRM 入库。新旧 CRM 切换不属于本次。
- 本轮真实服务使用回环端口3042（已关闭）；旧3041服务也已关闭。研究POST未mock，其他来源/客户界面使用隔离合成数据。未启动Cron。

## 下一动作

处理`gemini-2.5-flash:generateContent`的上游404与元数据GET成功之间的差异。先做只读的同API版本模型能力/官方支持核查；再生成需要新的明确请求预算，不能偷偷发第3次、切Gemini3或启用Billing。用户已有控制台字段不重复询问；仍明确区分用户提供的免费档信息和程序未独立验证的密钥归属、实时余量与账单。

原 Lead Engine 多来源升级及合规来源工作可独立继续，本 Gemini 研究结果不能作为批量获客数据库授权。
