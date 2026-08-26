# Lead Engine → 网站 CRM 已批准客户移交契约 v2

状态：2026-08-27 经所有者确认并投入生产。发送端版本为 `qixin.approved-customer-handoff.v2`，网站 CRM 在滚动发布期间同时接受 v1 与 v2。

## 边界

- 只有通过当前服务器复核、由用户明确批准、数据仍有效且未禁止联系的客户可以移交。
- Campaign 是可选归属和审计信息，不参与评分、准入、人工批准或 CRM 接收闸门；`campaigns` 可以为空数组。
- Lead Engine 不直接访问网站 D1；只调用网站 Worker 的专用接口 `POST /api/integrations/lead-engine/handoffs`。
- 请求同时经过 Sites 私有访问鉴权和独立 `CRM_HANDOFF_SECRET` 鉴权。
- `handoffId` 是幂等键。相同键和相同负载返回 `duplicate`；相同键但不同负载返回 `idempotency_conflict`。
- CRM 按来源公司、官网和公开商务邮箱去重。重复客户只安全补齐范围与结构化归因，不覆盖既有阶段、联系人或业务记录。
- 失败尝试保留在 Lead Engine 的 `crm_handoff_attempts`；失败不得保存人工批准决定，再次点击可以复用原负载重试。

## 请求结构

```json
{
  "contractVersion": "qixin.approved-customer-handoff.v2",
  "handoffId": "00000000-0000-4000-8000-000000000000",
  "sourceSystem": "qixin-lead-engine",
  "sourceLeadId": "lead-id",
  "discovery": {
    "method": "global_discovery_pool",
    "sourceName": "MIDO Exhibitors Map 2026",
    "sourceUrl": "https://example.invalid/official-directory"
  },
  "campaigns": [
    {
      "sourceCampaignId": "campaign-id",
      "name": "Europe · Spain",
      "productTrack": "optical_frames",
      "relationship": "automatic"
    }
  ],
  "company": {
    "sourceCompanyId": "company-id",
    "name": "Example Optics",
    "country": "Spain",
    "website": "https://example.invalid",
    "businessEmail": "sales@example.invalid",
    "customerTypes": ["Distributor"],
    "productInterests": ["Optical frames", "Sunglasses"],
    "estimatedPurchaseVolume": null
  },
  "contact": {
    "fullName": "Example Optics business contact",
    "jobTitle": null,
    "email": "sales@example.invalid"
  },
  "approval": {
    "status": "approved",
    "approver": "private_owner",
    "approvedAt": "2026-08-27T00:00:00.000Z"
  },
  "evidence": {
    "sourceCount": 2,
    "observedClaimCount": 3,
    "lastVerifiedAt": "2026-08-27T00:00:00.000Z"
  },
  "suppression": {
    "doNotContact": false,
    "unsubscribed": false,
    "permanentBounce": false
  },
  "dataFreshness": {
    "status": "current",
    "verifiedAt": "2026-08-27T00:00:00.000Z"
  },
  "notes": "Human-approved in QIXIN Lead Engine."
}
```

`discovery` 保存真实发现方式和公开来源。`campaigns` 只保存当前或需要审计的结构化归属；没有匹配 Campaign 时必须发送空数组，不能把 Campaign 名称伪装成发现来源。`customerTypes` 与 `productInterests` 用于 CRM 客户范围筛选。

## CRM 落库语义

- CRM 的普通来源字段统一写为 `Lead Engine`。
- `discovery` 与 `campaigns` 写入 `crm_handoffs.attribution_json`，保留为结构化审计。
- `company.customerTypes` 写入 `customers.customer_types_json`；产品分类继续写入 `customers.product_interests_json`。
- 新客户初始阶段为 `qualified`。重复客户沿用原阶段、联系人、活动、跟进任务和业务记录。

## 响应

- `201 accepted`：新建 CRM 客户。
- `200 duplicate`：复用已有 CRM 客户，不重复创建，并可安全补齐范围与归因。
- `400/409/422 rejected`：契约、幂等、审核、证据、时效或拒联条件不合格。
- `401 integration_authentication_required`：服务鉴权失败。
- `5xx`：不保存 Lead Engine 的批准决定；审核员可直接重试。

## 兼容策略

- 网站 CRM 在滚动发布期间同时接受精确的 v1 与 v2；Lead Engine 自 v34 起只发送 v2。
- v1 继续按原有 `campaign` 单对象和公司字段解析，不回写成虚构发现来源。
- 新增可选字段不得降低人工批准、服务器核验、拒联、幂等和去重要求；破坏性变更必须发布新版本并保留双版本兼容窗口。

历史 v1 定义见 [`crm-handoff-contract-v1.md`](crm-handoff-contract-v1.md)。
