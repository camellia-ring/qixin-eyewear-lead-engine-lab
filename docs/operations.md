# 运行与故障处理

## 日常操作

1. 打开私有工作台，在“自动发现”页确认 Campaign、时区、每日目标和已启用来源。
2. 点击“开始引擎”。开始操作会持久化状态并立即运行一个小批次；关闭浏览器不会改变状态。
3. 使用“暂停”临时停止调度，使用“恢复”继续，使用“停止”结束当前自动目标。已写入的运行、候选和证据不会被删除。
4. 今日漏斗从原始发现、解析、官网核验、有效联系、重复、强制门槛失败、合格和失败分别计数。只有“合格”计入每日 20 家目标。
5. 在审核列表用国家、客户类型、产品、联系状态、来源、重复/拒联状态和评分筛选。必要时在详情中执行“重新核验”。
6. 只有人工批准的合格线索可以导出 CSV；导出不会写生产 CRM，也不会发送消息。

## 后台 Cron

后台每次只运行一个小批次，计划频率为每 15 分钟。Sites 应用部署和 Cron 启用是两件事。当前正式配置 `wrangler.cron.jsonc` 使用独立 Worker 经 Sites 的受保护 API 触发批次，继续由 Sites 应用读写原有私有 D1；`SITES_BYPASS_TOKEN` 只作为 Cloudflare Worker secret 保存，不写入源码。`wrangler.cron.example.jsonc` 保留为未来能够核验实际 D1 ID 时的直接绑定备选方案。

当前上线核验：

- Cron 目标 URL 是当前 owner-only Lead Engine Sites 项目；机器令牌以 `secret_text` 保存，没有出现在源码或日志中。
- 正式 Trigger 为 `*/15 * * * *`；Worker 的 `workers.dev` 和 Preview URL 均关闭。
- `ENABLE_PAID_PROVIDERS=false`，没有生产 CRM、官网 D1/R2 或发信凭据。
- 2026-08-15 首个真实 Cron 获得 HTTP 200；停止态下 `last_run_at` 不推进。负责人启动引擎后，应继续核验 `last_heartbeat_at` 推进和完整运行日漏斗。

## 来源与解析器

- `vision_council_members`：协会会员表。
- `exhibitor_cards`：直接官网链接或同域展商详情页，再从详情页解析企业官网。
- `exhibitor_text`：纯文本名称。没有官网时只能交给明确批准并配置的 provider；默认不会合格。
- `dynamic_directory`：仅用于已确认的公开 JSON endpoint；配置 `itemsPath`、`nameField`、`websiteField`、`detailField`。
- `pdf_directory`：公开官方 PDF；最大 6 MB、100 页，抽取结果仍只是名称线索。
- `generic_links`：公开页面上的直接外部企业链接。

所有解析器都有持久化 `offset` 游标。到达末尾后游标归零，记录完整扫描时间，并把该来源延后 7 天，避免反复请求同一批候选。

## 告警与恢复

- 来源超时、非 HTML/JSON/PDF、robots 禁止、登录/付费要求或解析失败：记录 attempt、来源健康和错误摘要，然后切换其他到期来源。
- 30 分钟以上仍为 `running` 的运行会被恢复为失败，避免调度永久卡死。
- 所有到期来源耗尽但今日仍不足 20 家：产生缺口告警，不补造数据。
- 动态来源没有公开 endpoint：保持禁用；确认 endpoint 后通过来源 API 写入配置并启用。
- 联系方式失效或官网变化：执行手工重新核验；旧证据不删除，新证据和新评分追加留痕。

## 安全限制

请求只允许公共 HTTP/HTTPS、标准端口，限制重定向、超时、内容大小和速率，并阻止本地、内网、保留地址与常见社交/电商聚合域名。系统尊重明确的 robots `Disallow`，不绕登录、验证码或付费墙。
