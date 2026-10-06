# Epic 5 实现与验收索引

语言：**中文（CN）** | [English](README.md)

- 状态：已实现并有可执行检查覆盖，等待负责人验收
- 范围：5 个 User Story，48 条验收标准：v5 的 36 条，加上 2026-10-05 和 2026-10-06 的团队修订（US5.8 含 AC5.8.9 和 AC5.8.10、AC5.3.8、AC5.3.9）（[基线](../requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)，云盘 `TM16_RuMampu_User_Stories_and_Acceptance_Criteria_v5.docx`）
- 入口：House → **Prepare for a house**，以及 Money → **Cash buffer**
- 不在本索引内：User Story 5.5 到 5.7（Learn 解释页，来自云盘文档 "Added User Stories to Epics for Iteration 3"，为迭代 3 新增）。它们随 v27b3 合并进来，还没有验收检查（见待决事项 6）。
- 决策：[ADR 0004](../adr/0004-backend-authoritative-housing-calculations.cn.md)，见待决事项 3；现金缓冲的计算方法见 [ADR 0005](../adr/0005-cash-buffer-deepest-fall.cn.md)

| User Story | 验收标准 | 证据 |
| --- | ---: | --- |
| US5.1 — 进入购房准备工具 | 5/5 | Prepare 列出 Upfront cash、Cash buffer、Documents & financing；每个入口打开各自页面并能返回 Prepare；House 卡片说明已存了多少 |
| US5.2 — 检查前期现金是否充足 | 17/17 | You have / You need / Gap、水位线图表、按到期时间分组的分项清单、带日期的现金录入、按公布标准算出并写明来源的费用、首套房开关 |
| US5.3 — 按记录中的短缺月份估算现金缓冲 | 9/9 | 服务端计算的缓冲金额（最大跌幅，ADR 0005）、在 12 个月滚动余额图上标出的跌幅月份、零线落在零实际位置、记录区间和 RM 0 的解释 |
| US5.4 — 查看融资准备材料 | 7/7 | 五项清单、带来源和日期的 SJKP 条件、显示“需要复核”而非结论、免责声明 |
| US5.8 — 现金缓冲和首付共用的储蓄只算一次（团队修订） | 10/10 | 罐子先填缓冲；Upfront cash、House、储蓄计划和首页读同一套拆分；Cash buffer 写明已覆盖多少，并能打开储蓄计划 |

## 验收记录

| 验收标准 | 结果 | 检查内容 |
| --- | --- | --- |
| AC5.1.1 Show Upfront cash | 通过 | Prepare 页面可见该入口 |
| AC5.1.2 Show Cash buffer | 通过 | Prepare 页面可见该入口 |
| AC5.1.3 Show Documents & financing | 通过 | Prepare 页面可见该入口 |
| AC5.1.4 Navigate to preparation tools | 通过 | 每个入口打开只有它才有的内容所标识的页面，Back 返回 Prepare |
| AC5.1.5 Show what is set aside so far | 通过 | House 卡片显示 “RM 8,000 of RM 44,125 set aside”，清空现金后显示 “Nothing set aside yet” |
| AC5.2.1 Display cash available | 通过 | 账户里有 RM 8,000 时，*You have* 显示 RM 8,000 |
| AC5.2.2 Identify cash available as user data | 通过 | *You have* 一行带 `YOUR DATA` 标签 |
| AC5.2.3 Display cash required | 通过 | RM 300,000、首付 10% 时 *You need* 显示 RM 44,125，带 `CALCULATED` |
| AC5.2.4 Display upfront gap | 通过 | *Gap* 显示 RM 36,125，带 `CALCULATED` |
| AC5.2.5 Visualise available versus required | 通过 | 图表有无障碍摘要，现金柱高度为绘图区的 8,000 / (44,125 × 1.12) |
| AC5.2.6 Highlight an upfront shortfall | 通过 | 缺口段为 `#F1592A`、现金柱为 `#3C5152`，缺口段高度与缺口一致并叠在现金柱上 |
| AC5.2.7 Display upfront cost components | 通过 | 列出六个分项及金额，带 `OFFICIAL` / `CALCULATED` / `ASSUMPTION` 标签，合计等于 *You need* |
| AC5.2.8 Handle a zero deposit | 通过 | 首付为 0% 时页面说明前期现金仍是费用和安家成本，并仍显示需要 RM 14,650 |
| AC5.2.9 Enter available upfront cash | 通过 | *Cash I already have* 输入框起始为空；输入 RM 12,000 后保存到账户（在 PATCH 响应和账户中核对），*You have* 和 *Gap* 随之变化 |
| AC5.2.10 Record the cash snapshot date | 通过 | 金额旁显示 *Reported on* 今天的日期，账户保存该日期，刷新后两者都还在 |
| AC5.2.11 Group the costs by when they fall due | 通过 | 标题及其下的各行按 To sign、To complete、To move in 的顺序排列 |
| AC5.2.12 Treat the earnest deposit as part of the deposit | 通过 | 定金 RM 5,000 使首付余额从 RM 30,000 变成 RM 25,000，总额不变 |
| AC5.2.13 Work out the legal fees from the published scale | 通过 | RM 3,750 和 RM 3,375，均为 `OFFICIAL`，信息弹层写明 Solicitors' Remuneration Order 2023 |
| AC5.2.14 Work out stamp duty from the published scale | 通过 | RM 5,000 和 RM 1,350，均为 `OFFICIAL`，信息弹层写明 Stamp Act 1949 第 32(a) 和 27(a) 项 |
| AC5.2.15 Apply the first-home exemption as a switch I control | 通过 | RM 300,000 开启后两项印花税为 RM 0 并说明原因；RM 600,000 时显示 RM 12,000 和 RM 2,700，并说明不适用豁免 |
| AC5.2.16 Ask for the figures that have no published scale | 通过 | 定金、按揭保险、水电押金、维护押金、家具起始为空，占位示例为 RM 5,000 / 12,000 / 900 / 1,200 / 6,000，需要现金仍只含有公布标准的项目 |
| AC5.2.17 State the pot once | 通过 | *You have* 只出现一次且等于 pot；其明细显示已有的 RM 1,000、计划存下的一天和转入的 RM 0，合计等于 pot；*Gap* 与首页都用需要金额减 pot。安全缓冲已经占用的部分不计入，并写明金额（TECH-5.4） |
| AC5.3.1 Display cash-buffer amount | 通过 | 页面显示 RM 1,940，与 `/housing/test-result/` 返回的 RM 1,940 一致，跌幅从 2025 年 12 月到 2026 年 2 月（只从 8 月算起会是 RM 680） |
| AC5.3.2 Explain what the buffer represents | 通过 | 金额下方的定义写明“无论从哪个月开始” |
| AC5.3.3 Display running balance by month | 通过 | 12 根带标签的柱子及精确余额；负数 `#F1592A`、正数 `#3C5152`；月份简称在一行内；`CALCULATED` 标签 |
| AC5.3.4 State record basis | 通过 | 信息弹层写明 *From your own record, Aug to Jul* |
| AC5.3.5 State that it is not a general rule | 通过 | 同一弹层写明 *Not a general rule*；页面上没有经验法则式的通用基准 |
| AC5.3.6 Explain the displayed buffer result | 通过 | RM 1,940 旁有解释；结果为 RM 0（每个月都承担得起的 RM 80,000 房子）时有单独说明，不标跌幅 |
| AC5.3.7 Place the zero line where zero falls | 通过 | 分别检查余额全为正、全为负、正负都有三种情况：零线依次在底部、顶部和中间，没有柱子超出绘图区，最极端的柱子顶到边缘 |
| AC5.3.8 Mark where the deepest fall starts and ends | 通过 | *The biggest drop ran from Dec 2025 to Feb 2026* 点出月份，图上只标出 1 月和 2 月 |
| AC5.3.9 Say when the months do not catch up | 通过 | 每月 RM 2,300 时，一年下来少了 RM 4,650，页面用金额说明，不下结论；每月 RM 1,900 时年末多出 RM 150，不显示这句 |
| AC5.4.1 Display document checklist | 通过 | 五项均未勾选 |
| AC5.4.2 Include visible document types | 通过 | 银行流水、电召车收入汇总、收入法定声明、EPF 对账单、现有承诺清单 |
| AC5.4.3 Toggle checklist items | 通过 | 选中某项后 ☐ 变为 ☑，再点击恢复；其他项不受影响 |
| AC5.4.4 Display SJKP published criteria | 通过 | 列出三条条件 |
| AC5.4.5 Display source and date | 通过 | 信息弹层显示 *Source: sjkp.com.my, Aug 2026* |
| AC5.4.6 Avoid displaying unsupported approval status | 通过 | 显示 *65% check: needs review* 及原因；没有 pass、fail、approved 或 eligible 字样 |
| AC5.4.7 Display financing disclaimer | 通过 | 信息弹层说明 RuMampu 不会替用户申请，也无法告诉用户银行是否会批准 |
| AC5.8.1 Hold the buffer first | 通过 | 罐子里有 RM 1,000，保存的 RM 250,000 测试需要 RM 905 缓冲时，*You have* 为 RM 95，差额为所需金额减 RM 95 |
| AC5.8.2 One reading on every screen | 通过 | Upfront cash、House 卡片（"RM 95 of … set aside · RM 905 held as your safety buffer"）和储蓄计划（"Safety buffer RM 905 · Upfront cash RM 95"，罐子 RM 1,000）一致；首页写明两项目标合计还差多少 |
| AC5.8.3 Say what is held | 通过 | 显示 "RM 905 of your pot is held as your safety buffer, so it is not counted here"，罐子明细列出留作缓冲的金额 |
| AC5.8.4 Show how much of the buffer is covered | 通过 | RM 1,000 时 Cash buffer 显示已全部覆盖；RM 500 时显示覆盖 RM 500、还差 RM 404.74 |
| AC5.8.5 Nothing is held without a buffer | 通过 | 还没有保存测试时，*You have* 是全部 RM 1,000，不显示留作缓冲的说明 |
| AC5.8.6 Amounts, not a verdict | 通过 | RM 500 时首页和 Upfront cash 只用金额说明差额，没有 "afford"、"qualify" 一类字样 |
| AC5.8.7 Say when the held amount changes | 通过 | 在 RM 250,000 之后再保存 RM 300,000 的测试，显示缓冲从 RM 905 改成了新金额；罐子仍是 RM 500 |
| AC5.8.8 Go on to the saving plan | 通过 | Cash buffer 上的 "Open the saving plan" 打开储蓄计划，拆分同样是 RM 500 |
| AC5.8.9 Using the buffer takes it off the pot | 通过 | 在 Cash buffer 页点 “I used some of my safety money” 记下 RM 500（超过缓冲里的 RM 905 会被拒绝）；弹出 Epic 10 的温和提示，缓冲仍满，罐子从 RM 10,000 变 RM 9,500，*You have* 从 RM 9,095 变 RM 8,595。入口位置由开发者暂定（v27b4 没有设计），已发群里征求意见 |
| AC5.8.10 Name my safety money | 通过 | Cash buffer 页名字旁的铅笔打开弹窗；起名 “Rainy day fund”（多余空格清掉，最多 30 字）后，Cash buffer、Upfront cash、罐子明细和首页都显示这个名字；名字随计划保存；“Use the default name” 改回 “safety money” |

## 证据索引

- 页面：[`prepare.tsx`](../../frontend/src/rumampu/screens/prepare.tsx)；入口在 [`test.tsx`](../../frontend/src/rumampu/screens/test.tsx) 和 [`money.tsx`](../../frontend/src/rumampu/screens/money.tsx)
- *You have*、House 卡片、首页和储蓄计划共用的 pot，以及其中安全缓冲占用的部分：[`pot.ts`](../../frontend/src/rumampu/pot.ts)
- *You need* 背后的费用标准：[`fees.ts`](../../frontend/src/rumampu/fees.ts)
- 录入的现金及其日期：`UserAppState` 上的 `cash_on_hand` 和 `cash_on_hand_date`（[`models.py`](../../backend/finance/models.py)、[迁移 0018](../../backend/finance/migrations/0018_userappstate_cash_on_hand_date.py)），在 [`auth_views.py`](../../backend/config/auth_views.py) 中校验，[`test_auth.py`](../../backend/config/test_auth.py) 中有测试
- 结束月份转入的钱：`pot_moved_months` 旁边的 `pot_moved`（[迁移 0019](../../backend/finance/migrations/0019_userappstate_pot_moved.py)），本地快照里也保存
- 现金缓冲计算：[`services.py`](../../backend/apps/housing/services.py) 中的 `_starting_liquidity`，取最大跌幅并返回 `fall_start` 和 `fall_end`（[ADR 0005](../adr/0005-cash-buffer-deepest-fall.cn.md)）
- 12 个月固定数据的后端回归（RM 1,940、RM 904.74、RM 0、RM 4,740 四种缓冲，每月余额及跌幅起止月），以及“整份记录的缓冲等于所有按原时间顺序保留的后缀所需起始现金的最大值”的直接检查（不循环换序）：[`tests.py`](../../backend/apps/housing/tests.py) 中的 `GigDriverStartingLiquidityTests` 和 `StartingLiquidityPathTests`
- 真实浏览器验收：[`epic5.spec.ts`](../../frontend/e2e/epic5.spec.ts)（36 条验收标准各登记一次，另有五条工程回归：TECH-5.1 Money 入口、TECH-5.2 修改与需要已满足、TECH-5.3 余额从未跌破零也可能需要缓冲、TECH-5.4 安全缓冲占用的钱不重复计算、TECH-5.5 转入的钱刷新后还在）
- 费用标准和 pot 算术在分档边界上的回归：[`epic5-upfront-fees.spec.ts`](../../frontend/e2e/epic5-upfront-fees.spec.ts)
- 追溯闸门：`npm run test:e2e:traceability` 对照[基线](../requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)检查 Epic 5 为 48/48 条验收标准
- 截图：[`output/playwright/epic-5/evidence/`](../../output/playwright/epic-5/evidence/)，用 `UPDATE_EVIDENCE=1` 刷新
- 运行 Epic 5 检查：在 `frontend/` 下执行 `npm run test:e2e:epic5`

## 待决事项

1. **US5.8 和几条修订需要产品负责人签字。** 2026-10-05 团队没有等决定，先实现了 US5.8（罐子只算一次，先填缓冲）、AC5.3.8 和 AC5.3.9，并修订了 AC5.1.5、AC5.2.9、AC5.2.17 和 AC5.3.2。规则与 v27b 原型一致：罐子先填安全缓冲，剩下的才算首付现金。[需求基线](../requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)逐条标明了这些修订，还需要写进 v5 文档和 LeanKit。Epic 10 储蓄计划也改用同一规则（罐子低于缓冲时处于缓冲阶段），相当于 2026-10-01 批评分析里提议的 AC10.1.3 和 AC10.12.3 修订，需要 Epic 10 负责人确认。
2. **现金缓冲按最大跌幅计算（ADR 0005）。** 修订后的 AC5.3.2 记下了这种理解；数字只会变大（固定数据每月 RM 1,900 时由 RM 680 变为 RM 1,940）。
3. **首付数字在前端计算。** ADR 0004 规定首付差额以 Django 为准，但 *You need* 和 *Gap* 来自 `fees.ts` 里的公开费率引擎。固定值测试锁定了它，把费率移到后端服务是另一个工作包。估价费率在页面上标为 `ASSUMPTION`，因为还没有对照宪报原文核对。
4. **部分必需文字放在 (i) 按钮后面。** 费用和 SJKP 条件的来源（AC5.2.13、AC5.2.14、AC5.4.5）、免责声明（AC5.4.7）和记录依据（AC5.3.4、AC5.3.5）都在信息弹层里，这是按 v24 设计做的，检查会打开弹层。如果团队希望直接印在页面上，只是位置调整。
5. **发布前重新核对公开来源。** SJKP 条件和 *Aug 2026* 参考日期，以及印花税、律师费和估价费率，最后核对日期见各信息弹层。
6. **Learn 解释页（5.5 到 5.7）已经做好（v27b3，2026-10-05 合并），但还没有验收检查。** 阅读进度只存在本机，没有存到账号，所以 AC5.7.5（换设备）没达到；徽章和读完一个主题的庆祝动画照原型做，是对 AC5.7.6 的有意偏离。

## 已批准的边界

- 官方规则只支持清单和信息展示，RuMampu 不显示审批、资格或可负担结论。
- 现金缓冲来自用户自己记录的月份，从不当作通用规则呈现。
- 现金由用户自己填写，RuMampu 不会代填，也不会替没有公布标准的费用补上自己的数字。
- 申请融资、信用评分和购房后监测（Epic 7 预览）不属于 Epic 5。
