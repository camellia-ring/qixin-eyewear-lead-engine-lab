# Lead Engine → 网站 CRM 已批准客户移交契约 v1

状态：2026-08-26 经所有者确认并投入生产；自 2026-08-27 起只作为滚动发布兼容输入。当前发送端使用 [`qixin.approved-customer-handoff.v2`](crm-handoff-contract-v2.md)。

## 边界

- 只有通过当前服务器复核、人工批准、未禁止联系的客户可以移交。
- Lead Engine 不直接访问网站 D1；只调用网站 Worker 的专用接口 `POST /api/integrations/lead-engine/handoffs`。
- 请求同时经过 Sites 私有访问鉴权和独立 `CRM_HANDOFF_SECRET` 鉴权。
- `handoffId` 是幂等键。相同键和相同负载返回 `duplicate`；相同键但不同负载返回 `idempotency_conflict`。
- CRM 按来源公司、官网和公开商务邮箱去重。失败尝试保留在 Lead Engine 的 `crm_handoff_attempts`，再次点击审核通过会复用原负载重试。

## 最小请求

```json
{
  "contractVersion": "qixin.approved-customer-handoff.v1",
  "handoffId": "00000000-0000-4000-8000-000000000000",
  "sourceSystem": "qixin-lead-engine",
  "sourceLeadId": "lead-id",
  "campaign": {
    "sourceCampaignId": "campaign-id",
    "name": "Germany optical buyers",
    "productTrack": "optical_frames"
  },
  "company": {
    "sourceCompanyId": "company-id",
    "name": "Example Optics",
    "country": "DE",
    "website": "https://example.invalid",
    "businessEmail": "sales@example.invalid",
    "productInterests": ["Optical frames"],
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
    "approvedAt": "2026-08-26T00:00:00.000Z"
  },
  "evidence": {
    "sourceCount": 2,
    "observedClaimCount": 3,
    "lastVerifiedAt": "2026-08-26T00:00:00.000Z"
  },
  "suppression": {
    "doNotContact": false,
    "unsubscribed": false,
    "permanentBounce": false
  },
  "dataFreshness": {
    "status": "current",
    "verifiedAt": "2026-08-26T00:00:00.000Z"
  },
  "notes": "Human-approved in QIXIN Lead Engine."
}
```

## 响应

- `201 accepted`：新建 CRM 客户。
- `200 duplicate`：复用已有 CRM 客户，不重复创建。
- `400/409/422 rejected`：契约、幂等、审核、证据、时效或拒联条件不合格。
- `401 integration_authentication_required`：服务鉴权失败。
- `5xx`：不保存 Lead Engine 的批准决定；审核员可直接重试。

## 兼容策略

接收端在滚动发布期间同时接受精确的 v1 与 v2；Lead Engine 自 Sites v34 起只发送 v2。v1 的审核、拒联、幂等和去重语义保持不变；Campaign 必填只属于 v1 负载形状，不再构成当前人工批准或 CRM 接收闸门。破坏性变更必须发布新契约版本并保留双版本兼容窗口。
