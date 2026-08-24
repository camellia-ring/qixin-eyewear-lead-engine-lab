# 官方来源注册表

来源注册表在 `lib/source-registry.ts` 中版本化维护。当前包含 The Vision Council、Vision Expo、MIDO、opti、HKTDC、100% Optical、Neo Tokyo、DIOPS、OPTYKA、PSO 和 OXO 等官方协会/展会入口，覆盖全球主要眼镜市场。

2026-08-23 的无 API 容量复核启用了三个可公开核验的真实来源：MIDO 2026 服务端展商地图、100% Optical 展商详情和 Neo Tokyo 2026 公开 JSON 目录。现场解析得到 713、230 和 72 个候选，共 1,015 个；这是进入逐家官网核验的候选容量，不是“今日已完成”数量。DIOPS、OPTYKA、PSO 和 OXO 的当前页面只解析出展会导航或服务商链接，已停用并保留原因。

全球目录只挂载在优先级最高的一个运行中 Campaign 上，避免按 Campaign 重复扫描；逐家核验完成后仍按国家、客户类型和产品证据路由到全部匹配的运行中 Campaign。

## 来源等级

- A：协会会员目录或主要国际展会的官方展商目录，优先运行。
- B：区域性官方展会或纯文本名单，需要更强的官网二次核验。
- C：负责人后来添加、尚在观察的官方来源；默认低优先级。

动态目录在没有确认公开 endpoint 前默认关闭。文件名、页面标题或搜索摘要不能单独证明来源可用；启用前必须实际验证公开访问、响应格式、robots、分页和详情页结构。

## 新增来源

新增来源时必须记录官方名称、公开 URL、来源类型、覆盖区域和等级；解析器键与版本、结构化配置、优先级、速率限制和运行周期；是否需要登录、是否付费、访问限制和验证日期；至少一个不写数据库的解析测试，以及失败时不会把名称线索计为合格客户的门槛测试。

公开动态 JSON 的解析配置示例：

```json
{
  "endpoint": "https://official-fair.example/api/exhibitors",
  "itemsPath": "data.exhibitors",
  "nameField": "company.name",
  "websiteField": "company.website",
  "detailField": "profileUrl"
}
```

该配置只描述目录结构。JSON 返回的名称和网址仍必须经过企业官网核验、目标客户分类、公开商务联系方式验证、去重和评分。

已确认容量较大的来源在 `parserConfigJson` 中设置 `repeatDuringDay: true`。它们每批最多处理 20 家，在一个运行日内按持久化 `offset` 每 15 分钟继续下一批；普通 daily 来源仍然每天最多运行一次。公司级并发由共享运行策略在 1–5 之间自动调节，逐域名限速不变。到达目录末尾后统一归零游标并延后 7 天。

## 健康与停用

每次运行写入 `discovery_run_attempts` 和 `source_health`。连续失败、需要登录/付费、robots 禁止、结构改变或持续无候选时，应暂停来源并保留错误说明；修复解析器后提升版本并受控试跑，不能静默把失败来源当作成功。
