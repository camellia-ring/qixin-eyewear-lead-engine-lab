# QIXIN 眼镜客户开发引擎

这是一个独立、私有、可持续运行的眼镜 B2B 潜客发现与核验系统。它从维护过的官方协会/展会来源获取候选，核验企业官网和公开商务联系方式，完成去重、证据归档、可解释评分和目标客户过滤，再按地区、产品赛道与客户类型自动归入区域 Campaign。

## 核心边界

- Campaign 是区域 AI 开发策略，只保留地区/国家、产品赛道、客户类型和优先级；公司规模、MOQ、产品定位等属于客户证据标签，不再作为建 Campaign 的必填项。
- 同一家公司可以有多个产品和客户类型标签，也可以同时属于多个 Campaign；统一客户库通过主 Campaign 去重，只显示一次。
- 搜索结果、目录名称或模型输出都只是线索，不能单独计入“今日已完成”。
- 自动发现不设置每日数量目标或上限；`Asia/Shanghai` 日期只用于统计分桶，引擎运行且来源可用时持续发现。
- 自动发现的合格线索仍为 `needs_review`，没有人工批准就不能导出。
- 不采集个人联系人，不猜邮箱，不自动写入生产 CRM。当前版本不生成或发送开发信；外联配置保持 `outreachMode=disabled`，等待发件身份、发送频率、退订与停止条件另行确认。
- 付费、登录、验证码或消耗搜索额度的 provider 默认关闭，必须由负责人另行明确批准。

## 自动工作流

1. 创建简化区域 Campaign 并设为“运行中”；运行中表示 AI 会按该区域策略分配公开来源、检索配额和客户归类，暂停不会删除已有客户。
2. “开始引擎”持久化全局运行状态并初始化所有运行中 Campaign 的官方来源注册表；首批由后台 Cron 执行。
3. 独立 Worker 的 Cron 每 15 分钟触发一批最多 20 个候选。公司级并发从 3 开始，稳定时逐级升到 5；出现 403/429、超时或滚动错误率升高时降到 2 或 1。
4. 来源解析器支持直接官网链接、展商卡片/详情页、纯文本、配置化公开 JSON 动态目录和官方 PDF。
5. 企业官网最多跟随 3 个相关内部页，提取眼镜业务、B2B、产品和公开通用商务联系证据。
6. 以域名、规范公司名、品牌和身份键去重；强制门槛失败、重复和失败项分别记账。
7. 只有官网已核验、属于目标客户、产品匹配、存在有效公开商务联系、证据覆盖率达标且总分达到 60 的公司，才计入 `qualified_count`。
8. 合格公司按全部可信标签匹配 0/1/N 个运行中 Campaign，最高优先级匹配成为主 Campaign；没有可靠匹配的进入待分配。Campaign 改动会重新匹配，旧归属只标记为历史，不删除。
9. 中文工作台的主进度区只展示“今日已完成”，定义为当天通过筛选、去重并保存的合格客户数；完整漏斗、来源健康和失败明细留在审计区域。客户证据在打开详情时按需读取。

手机端使用底部五项主导航，客户列表改为可点按卡片，筛选面板、审核详情和主要操作均按触控尺寸布局；审核详情以全屏方式打开，不需要横向滚动表格。

## 数据与迁移

Drizzle 迁移 `0003_automatic_daily_engine.sql` 和 `0004_lush_amphibian.sql` 只新增列、表、索引与兼容回填，不删除、重命名或重建历史表。`0004` 为 Campaign、公司和 Campaign 归属新增区域策略、多标签、主 Campaign 与匹配状态字段。

- `engine_state`、`daily_discovery_targets`
- `discovery_run_attempts`、`source_health`、`discovery_alerts`
- `parser_versions`、`contact_verification`

旧版 V0/V1 表和历史记录保留。迁移行为测试会先写入代表性旧数据，再应用新迁移并验证旧数据仍在。

## 本地验证

需要 Node.js 22.13 或更高版本：

```bash
npm ci
npm run check
```

受控真实来源试跑（只读公开网页、不写数据库、不联系客户、不调用付费 provider）：

```bash
npm run build
node --import tsx scripts/controlled-real-source-run.ts
```

## 部署

Sites 承载私有应用和独立 D1。当前后台 Cron 只使用 `worker/cron-proxy.ts` 与 `wrangler.cron.jsonc` 单独部署，通过 Sites 的受保护 API 触发原应用批次，因此不会复制或迁移 D1；机器访问令牌必须以 `SITES_BYPASS_TOKEN` secret 保存。Sites 应用自身不包含第二套 `scheduled()` 入口。不要把生产 CRM、官网 D1/R2 或任何生产写凭据绑定到本项目。

详细说明见 `docs/operations.md`、`docs/migration-and-recovery.md` 和 `docs/source-registry.md`。
