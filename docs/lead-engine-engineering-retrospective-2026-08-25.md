# Lead Engine 工程复盘与后续开发基线（2026-08-25）

## 用途与证据状态

本文记录本项目截至 2026-08-24 的可复用工程经验，供后续开发和 Agent 使用。它不是生产状态的替代品；涉及线上版本、引擎运行、Cron、访问策略、来源启停、Secret、付费 provider 或 D1 数据时，必须再次只读核验。

证据优先级遵循 [`EVIDENCE-PRIORITY.md`](../../knowledge/standards/EVIDENCE-PRIORITY.md)。本文区分已确认决策、当前实现证据、历史基线和待确认事项；不把历史日志或文件名当作当前事实。

## 系统职责边界

已确认的长期职责划分：

```text
Lead Engine (Acquisition)
  发现 -> 官网/官方页核验 -> 证据 -> 去重/抑制 -> 评分 -> 人工批准
       | 仅已批准、最小、版本化、幂等的客户包
       v
CRM / 人工工作台 (客户与触达事实源)
       |
       v
Outreach Orchestrator (发送、限速、计划、webhook、退订/退信/回复)
       |
       +-> 抑制反馈回 Lead Engine
```

Lead Engine 保持独立、私有的 D1 与部署边界：不写生产 CRM、不发送邮件、不抓取登录/付费/个人数据、不猜测联系人。客户始终先处于 `needs_review`，只有人工批准后才可导出或联系。

依据：[`决策 0011`](../../knowledge/decisions/0011-customer-development-system-responsibility-split.md)、[`AGENTS.md`](../AGENTS.md)。

## 已证明有效的架构选择

### 1. 共享领域事实源，而非散落关键词

`lib/customer-scope.ts` 集中维护商业角色、产品方向、禁止产品、多语言术语、旧标签兼容和显示/搜索定义。它解决了旧实现把五类客户角色当作唯一准入门槛的架构问题。

- 商业角色和产品类别独立判断；两者都需要可追溯证据。
- 产品范围、评分、发现、重新核验、导入、审核 UI 和 Campaign 路由应调用同一领域定义。
- 禁止产品不得得到匹配分；普通产品与高科技产品混合经营时，普通产品必须有独立证据；语义模糊进入人工审核。

当前范围和准入已由 [`决策 0012`](../../knowledge/decisions/0012-lead-engine-broad-eyewear-product-scope.md) 确认、提交 `429ad5a` 实施。

### 2. 统一准入契约

`qixin-v1.2` 以确定性七维评分为基础，分数至少 60、证据覆盖率至少 55%，且要求官方来源/官网证据、允许产品、可验证 B2B 角色、公开商务联系、去重与拒联检查。

后续新增入口（provider、CSV、API、批量工具或 UI 操作）必须复用 `lead-scoring.ts` 和 `qualification.ts`；不得自行定义较低门槛或把“看起来不错”直接写入 `approved`。

### 3. 外部导入不信任边界

`lib/import-policy.ts` 将外部 `hardGateStatus`、分数、覆盖率和结论保留为审计信息，但当前记录统一写入：

```text
workflowStatus=needs_review
hardGateStatus=needs_review
currentScore=0
evidenceCoverage=0
```

服务器重新核验且人工批准之前，不得导出或联系。这个边界修复了历史导入 40% 与自动发现 55% 覆盖率不一致、且错误信任外部通过状态的问题。

### 4. 可靠运行不是“把批量调大”

当前无上限持续发现（提交 `7b98fd3`）删除每日配额停止条件；每批领取 20 个候选，初始公司级并发为 3，连续健康结果可升到最高 5。403/429/限流降到 1；超时、滚动错误率会降到 2 或 1。技术限流不是业务配额。

`discovery-runner.ts` 的可保留设计：

- 来源乐观领取，避免两个调度请求重复处理同一来源；
- 同一公司键、同一注册域名串行；逐域名限速；
- 每项候选失败隔离；
- 只将游标推进到连续成功完成、已持久化的检查点；
- 中断后从安全游标恢复，已保存项由公司/域名去重拦截；
- 超过阈值的 `running` 运行自动恢复为失败，避免永久阻塞。

后续改变批量、并发、Cron 或解析器时，必须同时测试：重复并发、游标中断、403/429、超时、单候选失败、部分成功与重新运行。

### 5. 调度与 UI 交互分离

历史上“开始引擎”接口先写入 running 又同步等待首批，浏览器请求在约 33–49 秒后取消，造成界面 `Failed to fetch`，但引擎状态已写入。修复后启动接口只持久化状态并立即返回，由独立 15 分钟 Cron 执行批次。

原则：耗时批量动作不能依赖一个浏览器请求活到结束；UI 应报告“请求已接受/可恢复”，而不是把连接中断误报为业务未启动。

### 6. “候选数”不是质量指标

真实运行显示展会目录容量很大，但买家角色和公开联系证据会显著降低产出。应按来源追踪：原始候选、官网核验、有效商务联系、重复、强制门槛失败、合格、失败、运行时长、限流和单位成本。

优先调整来源/角色匹配与核验效率，不要仅靠提高并发或降低门槛。候选发现、官网核验、联系人证据、评分与人工批准也必须分别统计，才能定位损失发生在哪一层。

## 已遇到的故障及修复方法

| 症状 | 根因 | 固化做法 |
| --- | --- | --- |
| UI 显示 `Failed to fetch`，但引擎已运行 | 同步启动接口等待长批次，浏览器先断开 | 状态写入后立即返回；后台 Cron/队列处理长任务 |
| 引擎显示 running 但没有新批次 | 独立 Cron 指向旧 Sites URL，返回 404 | URL 变更后同步 Cron 配置、重新部署，并在下个调度点核对心跳与批次 |
| 来源候选很多但合格很少 | 展商/供应商来源与买家角色不匹配 | 用完整漏斗按来源评估，优先高质量来源而非盲目扩容 |
| 导入记录绕过真实核验 | 历史导入信任外部状态和低覆盖率门槛 | 外部结论降级为审计输入，统一服务器重新核验 |
| 修改规则后不同入口结果不一致 | 准入、导入、批准、重核验和 UI 各有逻辑 | 变更前全局搜索所有入口，抽到共享领域模块和统一准入函数 |
| 发布后以为“验证完成” | 构建、HTTP 探测代替浏览器交互 | 将类型/Lint/测试、构建、部署、真实点击验收分开记录 |

## 测试与发布纪律

代码交付按 [当前AGENTS](../AGENTS.md)选择验证；开发中使用相关检查，同版本已通过结果可复用，文档不运行构建。下列7b98fd3计数及发布步骤为历史经验，不要求每次编辑重新执行。

当前验证、提交与发布流程只维护在 [AGENTS](../AGENTS.md) 和 [运维手册](operations.md)，此处不再复制完成清单。

日常 Git 检查只访问必要远程。Lead Engine 的 `sites` 是私有 Sites 远程，避免 `fetch --all` 触发 Windows Git Credential Manager；本地 `remote.sites.skipFetchAll=true` 只是 checkout 级设置，重新克隆后需要重设。

## 文档债与待确认项

1. [`../../knowledge/lessons/2026-08-24-lead-engine-external-agent-research-contract.md`](../../knowledge/lessons/2026-08-24-lead-engine-external-agent-research-contract.md) 的“当前实现证据”部分仍描述 v24 前的导入信任和 40% 门槛，和当前提交 `429ad5a` 后的实现冲突；它只能作为**历史审计基线**阅读。后续应单独修正该文档的证据状态，不能据此回退当前安全边界。
2. 无上限模式的生产并发参数仍需依据真实来源的单批耗时、403/429/超时分布和 D1 写入压力持续观察；这不是恢复每日数量配额的理由。
3. 完整历史重抓/重评分只能先做只读 dry-run；任何批量改写公司、证据、评分、Campaign 或审核历史必须单独授权、备份、分批和可审计。
4. 付费或登录 provider、OpenAI API、平台 API、生产 CRM 写入、自动邮件与自动批准都未因本项目当前实现而获得授权。
5. 业务身份、产品资料、价格、认证、公开联系方式等跨系统业务事实仍以原始证据或负责人确认为准，不能由代码字段或旧文案推断。

## 后续开发入口

按 [项目AGENTS](../AGENTS.md)与当前任务执行。上文技术经验按问题检索，不要求新任务先完成全仓地图、四栏分类或七步合同。

## 相关入口

- 领域范围：[`lib/customer-scope.ts`](../lib/customer-scope.ts)
- 评分与准入：[`lib/lead-scoring.ts`](../lib/lead-scoring.ts)、[`lib/qualification.ts`](../lib/qualification.ts)
- 导入安全边界：[`lib/import-policy.ts`](../lib/import-policy.ts)
- 发现、并发、游标：[`lib/discovery-runner.ts`](../lib/discovery-runner.ts)
- 运行手册：[`operations.md`](operations.md)
- 项目档案：[`../../knowledge/projects/qixin-lead-engine.md`](../../knowledge/projects/qixin-lead-engine.md)
- 已确认决策：[`0011`](../../knowledge/decisions/0011-customer-development-system-responsibility-split.md)、[`0012`](../../knowledge/decisions/0012-lead-engine-broad-eyewear-product-scope.md)、[`0013`](../../knowledge/decisions/0013-lead-engine-unbounded-continuous-discovery.md)
