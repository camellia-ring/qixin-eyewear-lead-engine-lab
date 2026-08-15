# QIXIN 眼镜客户开发引擎

这是一个独立、私有、可持续运行的眼镜 B2B 潜客发现与核验系统。它从维护过的官方协会/展会来源获取候选，核验企业官网和公开商务联系方式，完成去重、证据归档、可解释评分和目标客户过滤，并把合格线索留在人工审核队列。

## 核心边界

- 全球不限国家，但只接收任务定义中的五类目标客户和指定产品方向。
- 搜索结果、目录名称或模型输出都只是线索，不能单独计入每日合格数。
- 每日目标默认 20 家，按 `Asia/Shanghai` 日期记账；不足时如实显示缺口并告警，绝不填充假数据。
- 自动发现的合格线索仍为 `needs_review`，没有人工批准就不能导出。
- 不采集个人联系人，不猜邮箱，不自动写入生产 CRM，不生成或发送开发信。
- 付费、登录、验证码或消耗搜索额度的 provider 默认关闭，必须由负责人另行明确批准。

## 自动工作流

1. “开始引擎”持久化运行状态，初始化官方来源注册表，并执行一个受控小批次。
2. 独立 Worker 的 Cron 每 15 分钟触发一个最多 5 个候选的小批次；停止、暂停和恢复状态不会因页面关闭而丢失。
3. 来源解析器支持直接官网链接、展商卡片/详情页、纯文本、配置化公开 JSON 动态目录和官方 PDF。
4. 企业官网最多跟随 3 个相关内部页，提取眼镜业务、B2B、产品和公开通用商务联系证据。
5. 以域名、规范公司名、品牌和身份键去重；强制门槛失败、重复和失败项分别记账。
6. 只有官网已核验、属于目标客户、产品匹配、存在有效公开商务联系、证据覆盖率达标且总分达到 60 的公司，才计入 `qualified_count`。
7. 中文工作台展示今日漏斗、来源健康、告警、筛选审核、证据明细和手工重新核验；CSV 导出仍需人工批准。

## 数据与迁移

Drizzle 迁移 `0003_automatic_daily_engine.sql` 只新增列、表和索引，不删除、重命名或重建历史表。新增的核心表包括：

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

Sites 承载私有应用和独立 D1。当前后台 Cron 使用 `wrangler.cron.jsonc` 单独部署，通过 Sites 的受保护 API 触发原应用批次，因此不会复制或迁移 D1；机器访问令牌必须以 `SITES_BYPASS_TOKEN` secret 保存。`wrangler.cron.example.jsonc` 仅保留为未来能够核验实际 D1 ID 时的直接绑定备选。不要把生产 CRM、官网 D1/R2 或任何生产写凭据绑定到本项目。

详细说明见 `docs/operations.md`、`docs/migration-and-recovery.md` 和 `docs/source-registry.md`。
