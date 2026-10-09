# ADR 0006：前期费用与 pot 分配由客户端计算

语言：**中文（CN）** | [English](0006-client-side-upfront-fees-and-pot-allocation.md)

- 状态：已接受（Epic 5 负责人决定，2026-10-09）
- 日期：2026-10-09
- 修订：仅就前期费用修订 [ADR 0004](0004-backend-authoritative-housing-calculations.cn.md)

## 背景

AC5.2.13–5.2.16 要求应用按公布费率计算律师费、印花税与首套房豁免；AC5.2.17 和 US5.8（AC5.8.1–5.8.9）要求只有一个用户自己的 pot，只计算一次，并优先持有现金缓冲。这些规则于 2026-10-05、2026-10-06 落在客户端（提交 `0b69b98`、`34dd6aa`）：

- `frontend/src/rumampu/fees.ts` 保存各项费率表与 `upfrontNeed`。
- `frontend/src/rumampu/pot.ts` 保存 pot 运算（`potParts`、`potSum`、`potHeld`、`potForUpfront`）。
- 后端存储 `UserAppState.buffer_state` 和 `pot_moved`，只检查类型与范围（`config/auth_views.py`）。
- `/housing/test-result/` 把首付与客户端传来的 `upfront_costs` 求和并返回缺口（`apps/housing/services.py`），从不计算任何费用。
- 起始现金缓冲（最深跌幅）仍由后端计算，依据 [ADR 0005](0005-cash-buffer-deepest-fall.cn.md)。

ADR 0004 把“前期资金缺口与起始缓冲金”列为后端权威。就费用金额和 pot 规则而言，这与现有代码不符；迁到后端会增加迭代 3 的工作量，用户看不到任何变化。

## 决策

1. `fees.ts` 的费用公式和 `pot.ts` 的 pot 规则是教育性估算，以客户端为权威。后端只存储结果并做范围校验，不重算、不校验公式。
2. `fees.ts` 采用的公布费率来源：
   - 转让印花税：Stamp Act 1949（Act 378）第一附表第 32(a) 项。
   - 贷款印花税：Stamp Act 1949 第 27(a) 项。
   - 律师费：Solicitors' Remuneration Order 2023，P.U.(A) 207/2023。
   - 估价费：Board of Valuers，Rule 48 第 3 项。
   - 首套房豁免：Stamp Duty (Exemption) Orders P.U.(A) 53/2021 和 54/2021（含修订）。
3. 任何费率变更只改 `fees.ts`，并在函数上方注释与更新日志里写明来源和核对日期。
4. `fees.ts` 和 `pot.ts` 必须保留单元测试（`frontend/unit/`，CI 中由 `npm run test:unit` 运行），覆盖每个档位边界以及 AC5.8.5、AC5.8.9 的示例。
5. 起始现金缓冲仍由后端按 ADR 0005 计算。
6. 将来若要让前期费用或 pot 以后端为权威，另写新的 ADR 取代本条。

## 影响

- 迭代 3 不需要为这些规则新增接口、迁移或后端测试，每张费率表在代码中只有一个出处。
- 如果客户端代码不同，不同设备或应用版本上的数字可能不一致，规则变化时后端也无法纠正。
- 费率变更需要发布新版本；服务器端没有这些数字的测试，前端单元测试是唯一的保护。
- ADR 0004 对融资、月供、房屋总成本、历史测试、短缺和价格换算继续有效；前期资金缺口的范围改为“对客户端提供的成本项求和并计算缺口”，见其 2026-10-09 修订。
