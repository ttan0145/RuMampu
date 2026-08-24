# US1.7 验收记录：以收据作为支出起点

验收日期：2026-08-25  
状态：完成（10/10 AC）  
需求来源：[US1.7 - Use a receipt as the starting point for an expense](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us17---use-a-receipt-as-the-starting-point-for-an-expense)

## 验收矩阵

| Acceptance Criterion | 状态 | 实现与验收证据 |
|---|---|---|
| AC1.7.1 Select a receipt image | 通过 | Scan a receipt 页面分别提供 `Take a photo` 与 `Choose a photo`，另有稳定验收用的示例收据入口；见[选择页截图](../../output/playwright/us1.7/receipt-selection.png)。 |
| AC1.7.2 Show receipt-reading state | 通过 | 选择示例收据后显示 Shimmer 和 `Reading the receipt…`；Playwright 在 1.4 秒读取阶段捕获到可见状态与[读取截图](../../output/playwright/us1.7/receipt-reading.png)。 |
| AC1.7.3 Present values for confirmation | 通过 | 读取完成后显示商家、日期、总额和分类，并明确提示保存前检查。 |
| AC1.7.4 Display receipt-derived merchant | 通过 | Shop 标签旁显示 `FROM RECEIPT`，初始商家为 `Kedai Runcit Maju`。 |
| AC1.7.5 Display receipt-derived date | 通过 | Date 标签旁显示 `FROM RECEIPT`，并显示可编辑日期。 |
| AC1.7.6 Display receipt-derived total | 通过 | Total (RM) 标签旁显示 `FROM RECEIPT`，并显示可编辑金额。 |
| AC1.7.7 Choose an expense category | 通过 | 确认页显示全部 API 分类；验收从默认 Groceries 改选为 Meals。 |
| AC1.7.8 Edit before saving | 通过 | 商家改为 `Kedai Maju edited`、日期改为 2026-08-25、总额改为 RM35.20；见[编辑后的确认页截图](../../output/playwright/us1.7/receipt-review-edited.png)。 |
| AC1.7.9 Retake receipt | 通过 | 选择 Retake 后返回包含拍照/选图的选择阶段；此时 API 支出数仍为 0。 |
| AC1.7.10 Save the confirmed expense | 通过 | 选择 Add 后保存为 `entry_method=receipt`、`merchant=Kedai Maju edited`、`user_confirmed=true`；刷新后显示 25 Aug · Meals · RM35.20，见[记录页截图](../../output/playwright/us1.7/confirmed-receipt-after-reload.png)。 |

## 自动化与浏览器验收

- 后端 `finance` 测试：42 项通过；新增覆盖已确认收据元数据入库与未确认收据拒绝且不产生记录。
- 前端 TypeScript 类型检查通过。
- Playwright 真实浏览器依次验证选择、读取、确认、编辑、分类、Retake、未确认不入库、确认保存和刷新持久化。
- 最终 API 记录精确返回 RM35.20、2026-08-25、Meals 分类、`receipt` 来源、编辑后商家与人工确认状态。
- 最终浏览器控制台没有产品错误；仅有 Expo Web 关于原生动画驱动不可用的开发环境提示。
- 验收结束后清理本地浏览器验收数据和遗留开发服务器进程。

## 原型与隐私边界

- 正式 AC 明确描述的是 prototype。本实现保留可见读取状态和示例解析结果，不宣称接入了生产级 OCR。
- 拍摄或选择的图片只用于当前客户端预览，本包不上传或长期保存原始收据图片，避免在缺少保留/删除政策时扩大敏感数据范围。
- 读取结果在用户选择 Add 前不会创建财务事实；后端也要求 `confirm_receipt=true`，不能通过未确认请求绕过。
- 保存的是用户核对后的值，同时以 `entry_method=receipt` 和 `user_confirmed=true` 保留来源边界。
