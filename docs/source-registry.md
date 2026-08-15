# 官方来源注册表

来源注册表在 `lib/source-registry.ts` 中版本化维护。当前包含 The Vision Council、Vision Expo、MIDO、opti、HKTDC、100% Optical、DIOPS、OPTYKA、PSO 和 OXO 等官方协会/展会入口，覆盖全球主要眼镜市场。The Vision Council 页面在 2026-08-15 复核时已不再向未登录页面输出会员行，因此保持禁用；100% Optical 的公开展商详情卡作为当前受控真实来源。

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

## 健康与停用

每次运行写入 `discovery_run_attempts` 和 `source_health`。连续失败、需要登录/付费、robots 禁止、结构改变或持续无候选时，应暂停来源并保留错误说明；修复解析器后提升版本并受控试跑，不能静默把失败来源当作成功。
