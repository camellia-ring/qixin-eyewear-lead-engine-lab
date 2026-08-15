# 迁移、备份与恢复

## 已恢复的源码

正式源码目录是 `E:\aQiXin\qixin-lead-engine`。它从已确认归属的私有 Sites 项目精确恢复，并保留完整 Git 元数据。历史交付包保持原样，没有移动、删除或覆盖。

## 部署前备份

部署或应用迁移前，必须从目标 D1 导出全量快照，并记录项目 ID、版本、提交、表数、关键表行数、文件大小和 SHA-256。备份必须位于 Lead Engine 专用备份目录，不得包含生产 CRM 数据。

当前重构前快照：`E:\aQiXin\backups\qixin-lead-engine\2026-08-14-pre-refactor-sites-v8.json`。

## 前向迁移规则

`drizzle/0003_automatic_daily_engine.sql` 与 `drizzle/0004_lush_amphibian.sql` 都是纯前向迁移：

- 允许 `ALTER TABLE ... ADD COLUMN`、`CREATE TABLE`、`CREATE INDEX` 和为新增字段补默认值。
- 禁止 `DROP`、`DELETE`、`TRUNCATE`、旧表重建或列重命名。
- 旧记录保留，新增字段使用兼容默认值。
- `tests/migration-forward-only.test.mjs` 同时做静态危险语句检查和旧数据保留的行为验证。

## 部署后核验

1. 核对迁移版本和新增表/列。
2. 对比部署前后的全部表行数；因迁移本身不应减少任何旧表行数。
3. 依次应用 `0003_automatic_daily_engine.sql`、`0004_lush_amphibian.sql`；后者只新增区域策略、多标签、主 Campaign 和匹配状态字段，并回填旧记录。
4. 确认原有 Campaign、公司、Lead、证据、审核和导出记录仍可读取。
5. 确认 `engine_state` 初始为停止或当前明确状态，付费 provider 关闭。
6. 运行只读受控真实来源试跑；若要写入 D1，必须使用工作台的明确“立即运行小批次”动作并复核新增记录。

## 恢复顺序

若部署后出现数据或应用问题：

1. 先暂停/停止引擎和 Cron，保留错误现场与日志。
2. 回滚应用版本，不直接修改或删除 D1 数据。
3. 使用部署前快照和 Cloudflare D1 Time Travel 恢复到新数据库或经过核验的目标点。
4. 比对表结构和关键行数后，再重新绑定私有应用。
5. 记录根因、恢复点和验证结果。未经负责人确认，不覆盖唯一的现有数据库。
