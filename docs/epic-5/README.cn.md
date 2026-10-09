# Epic 5 实现与验收索引

语言：**中文（CN）** | [English](README.md)

- 状态：已实现并有可执行检查覆盖，等待负责人验收
- 范围：11 个 User Story，88 条验收标准：v5 的 36 条、迭代 3 Learn 的 20 条、2026-10-05 和 2026-10-06 的团队修订（US5.8 含 AC5.8.9 和 AC5.8.10、AC5.3.8、AC5.3.9），以及 V9 新增的 US5.9–5.11 共 20 条（[基线](../requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)，云盘 `US and AC V9.docx`）
- 入口：House → **Prepare for a house**，以及 Money → **Cash buffer**
- 决策：[ADR 0004](../adr/0004-backend-authoritative-housing-calculations.cn.md)，见实现边界 3；现金缓冲的计算方法见 [ADR 0005](../adr/0005-cash-buffer-deepest-fall.cn.md)

| User Story | 验收标准 | 证据 |
| --- | ---: | --- |
| US5.1 — 进入购房准备工具 | 5/5 | Prepare 列出 Upfront cash、Cash buffer、Documents & financing；每个入口打开各自页面并能返回 Prepare；House 卡片说明已存了多少 |
| US5.2 — 检查前期现金是否充足 | 17/17 | You have / You need / Gap、水位线图表、按到期时间分组的分项清单、带日期的现金录入、按公布标准算出并写明来源的费用、首套房开关 |
| US5.3 — 按记录中的短缺月份估算现金缓冲 | 9/9 | 服务端计算的缓冲金额（最大跌幅，ADR 0005）、在 12 个月滚动余额图上标出的跌幅月份、零线落在零实际位置、记录区间和 RM 0 的解释 |
| US5.4 — 查看融资准备材料 | 7/7 | 五项清单、带来源和日期的 SJKP 条件、显示“需要复核”而非结论、免责声明 |
| US5.5 — 买房知识解释 | 11/11 | Prepare 入口、五个主题、19 篇带来源日期的说明、术语与个人金额；逐页尺寸检查 |
| US5.6 — 无固定工资者的信息 | 3/3 | No payslip、SJKP 担保上限与材料清单入口 |
| US5.7 — 阅读进度 | 6/6 | 已读数、续读、Prepare 总进度、账号跨设备保存；无阅读奖励 |
| US5.8 — 现金缓冲和首付共用的储蓄只算一次（团队修订） | 10/10 | 罐子先填缓冲；Upfront cash、House、储蓄计划和首页读同一套拆分；Cash buffer 写明已覆盖多少，并能打开储蓄计划 |
| US5.9 — 一步步为一套房做准备（V9） | 6/7，1 项延期 | 每一步围绕同一套房、选择或填写房源表单、四步均不锁定、月供、现金与文件三步的勾选、全部完成时不下结论的提示、PDF 页面。延期：AC5.9.7（访客重新打开页面会走一遍游客入口，入口会新建一份空记录；等负责人决定）。测试：`epic5-prepare-path.spec.ts` |
| US5.10 — 看看每月还款是什么感觉（V9） | 9/9 | 六个引导屏和总结页；占典型月份的比例用数字和文字写出（Comfortable / Tight / Heavy 一词按负责人 2026-10-09 的决定保留）；每一屏都有来源标签，70 岁规则写明来源。测试：`epic5-prepare-path.spec.ts` |
| US5.11 — 了解我这类房子怎么买（V9） | 4/4 | 二手房与新盘时间线、选择被保留、Schedule H 折叠表，以及每个时间点和比例的状态、来源与核对日期（或“未经核实”标注）。测试：`epic5-prepare-path.spec.ts` |

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
| AC5.4.5 Display source and date | 通过 | 信息弹层显示 *Source: sjkp.com.my/en/hcgs/eligibility, checked 8 Oct 2026* |
| AC5.4.6 Avoid displaying unsupported approval status | 通过 | 显示 *65% check: needs review* 及原因；没有 pass、fail、approved 或 eligible 字样 |
| AC5.4.7 Display financing disclaimer | 通过 | 信息弹层说明 RuMampu 不会替用户申请，也无法告诉用户银行是否会批准 |
| AC5.5.1 Open the explanations from Prepare | 通过 | Prepare 的 Learn 入口可打开解释 |
| AC5.5.2 Sections shown as tabs | 通过 | 五个主题按要求排列为标签 |
| AC5.5.3 Every explanation names its source and date | 通过 | 19 篇解释的最后页显示可点击来源与核对日期 |
| AC5.5.4 Government sources only | 通过 | 政府方案与 SJKP 参与机构清单直达链接 |
| AC5.5.5 Reach the right tab from each tool | 通过 | Upfront 与 Documents 分别打开相关主题 |
| AC5.5.6 Show my own figure where one exists | 通过 | 已测试房屋的费用带 CALCULATED 金额 |
| AC5.5.7 Explain terms where they appear | 通过 | 点击正文术语显示解释并留在当前页 |
| AC5.5.8 Not advice | 通过 | 每篇最后页显示非建议与非审批说明 |
| AC5.5.9 One idea per page | 通过 | 51 页分别在 390×844、360×740 检查实际内容高度 |
| AC5.5.10 Move between pages with buttons | 通过 | Back、Next、Finish 与页码一致 |
| AC5.5.11 Refer EPF out rather than explain it | 通过 | EPF 边界说明与 KWSP 外链 |
| AC5.6.1 A tab for irregular income | 通过 | No payslip 标签及材料解释 |
| AC5.6.2 Explain the financing guarantee and its limits | 通过 | SJKP 两类方案的上限，符合条件不代表审批 |
| AC5.6.3 Link documents to the checklist | 通过 | 材料解释直接打开清单 |
| AC5.7.1 Show progress on each explanation | 通过 | 每篇显示已读页数/总页数 |
| AC5.7.2 Grey out what I've finished | 通过 | 已读行淡化为 0.66，仍可重新打开 |
| AC5.7.3 Resume where I stopped | 通过 | 未完成文章从上次页码继续 |
| AC5.7.4 Show progress for each section and overall | 通过 | 主题已读数与 Prepare 总已读数 |
| AC5.7.5 Keep progress between sessions | 通过 | PATCH 保存、刷新及另一浏览器登录同账号恢复 |
| AC5.7.6 Nothing is locked behind reading | 通过 | 其他功能可直接使用，阅读无奖励或庆祝 |
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
| AC5.9.1 One home for every step | 通过 | 横幅写明房名、价格和二手/新盘；Change home 列出两条已保存测试和 “Test a new house first”；选一条后整条路径改为该房（`epic5-prepare-path.spec.ts`） |
| AC5.9.2 Choose or type a home first | 通过 | 没有测试时只显示 “Which home are you preparing for?” 和填写表单，不显示路径；点 “Use this home” 后出现横幅和各步骤 |
| AC5.9.3 Four steps, none locked | 通过 | 四步按顺序出现且各带数字；可以先打开文件这一步 |
| AC5.9.4 What counts as done | 通过 | 五份文件全勾后文件步骤打勾、月供检查保存后月供步骤打勾、手头现金填到 RM 100,000 覆盖所需后现金步骤打勾（在 AC5.9.5 里走到）、钥匙一步不带进度 |
| AC5.9.5 Say what is left without a verdict | 通过 | 完成两步时写 “1 thing left before you buy. You have 0% of the cash. RM … to go.”；三步全完成时写 “All three steps are done. Save your plan for your own reference.”，不出现 ready 或 approved（文案 2026-10-09 改） |
| AC5.9.6 Keep a copy of my plan | 通过 | 打印页标题为 “RuMampu buying plan, for my own reference”，列出价格、贷款、前期现金、现金缓冲、已备文件和免责声明；手机分享面板未测 |
| AC5.9.7 Kept on this device | 延期 | App 保持打开时保留。路径在网页和手机 App 上都已写进本地存储，但访客重新打开页面会走一遍游客入口，入口会新建一份空记录（和游客入口文案一致）；登录账号不经过这一步，刷新后路径仍在（已在 `epic5-prepare-path.spec.ts` 测过）。负责人在三个方案里选：访客也保留在本机、只对登录账号承诺、或把路径同步到账号（2026-10-09） |
| AC5.10.1 The monthly payment first | 通过 | 月供、“90% loan at 4.30%, over 35 years” 和 “Your typical month” |
| AC5.10.2 Compare with my month, without a rating | 通过（负责人决定） | “Comfortable — the instalment is RM 1,245, about 31% of your typical month.” 用数字和文字写出占比；旁边的 Comfortable / Tight / Heavy 一词按负责人 2026-10-09 的决定保留，不删 |
| AC5.10.3 Where the payment goes | 通过 | 第 1 年、中间一年和最后一年的利息占比与图例 |
| AC5.10.4 Pick how long and how much the bank lends | 通过 | 25、30、35 年各带月供和总利息；80%/90% 与 “You put down … The bank lends …” |
| AC5.10.5 If rates go up | 通过 | Now、+1%、+2% 的利率与月供，问题，回答不改变其他数字 |
| AC5.10.6 My full monthly bill | 通过 | 公寓：月供、地租与门牌税、火险和维护费，起始金额均标 “Our guess”，改动后去掉，并显示每月总额 |
| AC5.10.7 A cushion from my own months | 通过 | 缓冲、“Your pot covers …”、逐月累计余额、最大跌幅，点 Add RM x 打开储蓄计划 |
| AC5.10.8 Three numbers to keep | 通过 | 月供、利率升 1% 的月供、缓冲、贷款摘要、免责声明，Save 后该步骤打勾 |
| AC5.10.9 Say where every figure comes from | 通过 | 每一屏都带产品统一的来源标签：月供、利息拆分、年限对比、备用金和总结页三个数字为 `CALCULATED`；贷款比例、利率、年限来自测试或本次选择时为 `YOUR DATA`，用到 RuMampu 起点值时为 `ASSUMPTION`；+1%、+2% 为 `ASSUMPTION`；改过的月费为 `YOUR DATA`，没改的仍是 “Our guess”；首屏 (i) 打开 “Where these figures come from”；70 岁规则注明来源 CIMB 房贷页，核对于 2026-10-09 |
| AC5.11.1 Subsale or project | 通过 | 时间线随选择切换，离开 Prepare 再回来选择仍在 |
| AC5.11.2 A subsale in five steps | 通过 | 五个步骤，“You pay” 四次、“Bank pays” 一次 |
| AC5.11.3 A project as it is built | 通过 | 签约、建造期（只付利息的说明）、钥匙、产权与保留金，以及 Schedule H 折叠表 |
| AC5.11.4 Timings and shares name their source | 通过 | 二手房：定金 2–3%、14 天、3–4 个月各写 “Common practice, not a legal rule.”，来源为中介与律师指南，核对于 2026-10-09；首期供款时间标为未经核实。新盘：各阶段比例注明 1989 年房屋发展（管制与执照）条例附表 H（附表 G 自 2015 年起比例相同），标明尚未对照宪报原文、二手来源 2026-10-09 查阅，时间线下方和完整表格下各一次。每个金额带 `ASSUMPTION`（2% 定金估算）、`YOUR DATA`（自己填的定金）或 `CALCULATED` |

## 证据索引

- 页面：[`prepare.tsx`](../../frontend/src/rumampu/screens/prepare.tsx)；入口在 [`test.tsx`](../../frontend/src/rumampu/screens/test.tsx) 和 [`money.tsx`](../../frontend/src/rumampu/screens/money.tsx)
- *You have*、House 卡片、首页和储蓄计划共用的 pot，以及其中安全缓冲占用的部分：[`pot.ts`](../../frontend/src/rumampu/pot.ts)
- *You need* 背后的费用标准：[`fees.ts`](../../frontend/src/rumampu/fees.ts)
- 录入的现金及其日期：`UserAppState` 上的 `cash_on_hand` 和 `cash_on_hand_date`（[`models.py`](../../backend/finance/models.py)、[迁移 0018](../../backend/finance/migrations/0018_userappstate_cash_on_hand_date.py)），在 [`auth_views.py`](../../backend/config/auth_views.py) 中校验，[`test_auth.py`](../../backend/config/test_auth.py) 中有测试
- 结束月份转入的钱：`pot_moved_months` 旁边的 `pot_moved`（[迁移 0019](../../backend/finance/migrations/0019_userappstate_pot_moved.py)），本地快照里也保存
- 现金缓冲计算：[`services.py`](../../backend/apps/housing/services.py) 中的 `_starting_liquidity`，取最大跌幅并返回 `fall_start` 和 `fall_end`（[ADR 0005](../adr/0005-cash-buffer-deepest-fall.cn.md)）
- 12 个月固定数据的后端回归（RM 1,940、RM 904.74、RM 0、RM 4,740 四种缓冲，每月余额及跌幅起止月），以及“整份记录的缓冲等于所有按原时间顺序保留的后缀所需起始现金的最大值”的直接检查（不循环换序）：[`tests.py`](../../backend/apps/housing/tests.py) 中的 `GigDriverStartingLiquidityTests` 和 `StartingLiquidityPathTests`
- 真实浏览器验收：[`epic5.spec.ts`](../../frontend/e2e/epic5.spec.ts)（核心 48 条验收标准各登记一次，另有工程回归：TECH-5.1 Money 入口、TECH-5.2 修改与需要已满足、TECH-5.3 余额从未跌破零也可能需要缓冲、TECH-5.4 安全缓冲占用的钱不重复计算、TECH-5.5 转入的钱刷新后还在）
- Learn 浏览器验收：[`epic5-learn.spec.ts`](../../frontend/e2e/epic5-learn.spec.ts)，覆盖 US5.5–5.7 的 20 条 AC、全部 51 页与跨设备阅读进度。
- 费用标准和 pot 算术在分档边界上的回归：[`epic5-upfront-fees.spec.ts`](../../frontend/e2e/epic5-upfront-fees.spec.ts)
- Prepare 路径、月供检查与 How buying works（US5.9–5.11）：[`epic5-prepare-path.spec.ts`](../../frontend/e2e/epic5-prepare-path.spec.ts)；时间点、比例和 70 岁规则的来源：[`buying-facts.ts`](../../frontend/src/rumampu/buying-facts.ts)，Schedule H 的加总在 [`unit/buying-facts.test.ts`](../../frontend/unit/buying-facts.test.ts) 中检查
- 追溯闸门：`npm run test:e2e:traceability` 对照[基线](../requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)检查 Epic 5 的 88 条验收标准：87 条可执行，AC5.9.7 明确延期
- 截图：[`output/playwright/epic-5/evidence/`](../../output/playwright/epic-5/evidence/)，用 `UPDATE_EVIDENCE=1` 刷新
- 运行 Epic 5 检查：在 `frontend/` 下执行 `npm run test:e2e:epic5`

## 实现边界与验收流程

1. **当前需求与 LeanKit 已对齐。** 2026-10-08 核对的迭代 3 文件和 LeanKit 都包含 8 个 US、68 条 AC，包括 US5.8、AC5.3.8/.9 与四条修订；本轮已更新本地基线。代码验证与负责人的签核、卡片泳道是不同证据，本轮未移动卡片或宣称外部签核完成。
2. **现金缓冲按最大跌幅计算（ADR 0005）。** 当前 AC5.3.2 已记录该规则；固定数据每月 RM 1,900 的缓冲为 RM 1,940。
3. **首付数字在前端计算。** ADR 0004 规定首付差额以 Django 为准，但 You need 与 Gap 仍来自 `fees.ts`。本轮保留固定值回归；移到后端是独立的架构工作。估价费率继续标为 ASSUMPTION。
4. **部分必需文字在信息弹层中。** 费用、SJKP 的来源与免责声明、现金缓冲的记录依据均通过 (i) 打开，验收会检查弹层内容。
5. **公开来源有明确核对日期。** SJKP 条件已于 2026-10-08 与官方页核对；19 篇 Learn 的依据与更正见 [LEARN_SOURCES.md](LEARN_SOURCES.md)。印花税标准保留此前核对日期，不把未完整复查的费率标成新核对。

## 已批准的边界

- 官方规则只支持清单和信息展示，RuMampu 不显示审批、资格或可负担结论。
- 现金缓冲来自用户自己记录的月份，从不当作通用规则呈现。
- 现金由用户自己填写，RuMampu 不会代填，也不会替没有公布标准的费用补上自己的数字。
- 申请融资、信用评分和购房后监测（Epic 7 预览）不属于 Epic 5。

## 2026-10-08：迭代 3 的 Learn 修复

US5.5–5.7 已纳入索引与正式基线；`epic5-learn.spec.ts` 将 20 条 AC 各登记一次，通过实际界面核对全部 51 页在两种手机尺寸下的布局、来源与日期、术语解释、个人金额、材料导航、已读数、续读、刷新和另一浏览器中相同账号的恢复。

| User Story | AC 数 | 行为 |
| --- | ---: | --- |
| US5.5 — 提交购房决定前了解买房流程 | 11 | Prepare 的 Learn 入口、按顺序排列的五个标签、带来源日期的解释、政府方案与 SJKP 机构清单、个人金额、术语、分页、免责声明与 KWSP 链接 |
| US5.6 — 查找无工资单者的信息 | 3 | No payslip 标签、SJKP 担保上限和材料清单入口 |
| US5.7 — 看已读内容 | 6 | 已读页数、淡化已读行、续读、主题与 Prepare 总数、账号跨设备进度；阅读可选且无奖励 |

部署前执行 `finance.0022_userappstate_learning_progress` 迁移。访客在本机保存；账号登录时以账号进度为准，空进度会清除其他账号遗留的本机历史。无效进度会拒绝整次 PATCH。

AC5.7.6 按现行文字实现，阅读徽章与庆祝已移除；完成文章仅显示已读状态。

内容依据及更正见 [LEARN_SOURCES.md](LEARN_SOURCES.md)。

## 本轮最终验证（2026-10-08 17:20 SGT）

- `npm run typecheck`：前端与 E2E TypeScript 均通过。
- `npm run test:e2e:traceability`：Epic 5 为 68/68，每条登记一次，0 条延期。
- 完整 `npm run test:e2e`：111 项全部通过，耗时 16.4m；其中 Epic 5 的 30 项测试覆盖 68 条正式 AC 与额外回归。
- 布局：19 篇、51 页在两种手机尺寸下共 102 次检查，加上五处个人金额在两种尺寸下的 10 次检查，共 112 次，均无需滚动；来源区无遮挡。
- 独立 SQLite 测试库中的完整 Django suite：215 项全部通过；`makemigrations --check --dry-run` 无漂移。
- House costs 缺少原始交易数据时返回明确的 503，而不是 500；缺表、部分数据、空数据、正常统计响应及事务恢复均有回归。
- OpenAPI 重新生成后与已提交文件一致。生成器仍输出既有的未声明 serializer 和 operationId 冲突信息，不把这项说成无警告。

逐条 AC、部署步骤与证据见 [修复报告](REPAIR_REPORT.cn.md)。

## 迭代 3 收尾（2026-10-09）

- US5.9–5.11（V9 的 20 条，2026-10-08 构建的 Prepare 路径）纳入基线，Epic 5 增至 88 条。
- V9 构建说明点名的四条于 10 月 9 日关闭：AC5.9.5（全部完成的提示不再说 “ready to buy”）、AC5.10.2（负责人按现状接受：占比用数字和文字写出，评级词保留）、AC5.10.9（月供检查每一屏加来源标签，70 岁规则注明来源）、AC5.11.4（How buying works 每个时间点和比例写明状态、来源与核对日期或标未经核实，每个金额带来源标签）。AC5.9.7 等负责人对访客的决定。
- Expo SDK 57 升级后，开发包会把 React 的 `ariaHidden` 警告显示成盖住整页的浮层，所以本次收尾的浏览器检查改用生产网页导出运行（`frontend/playwright.static.config.ts`）；开发服务器的配置没有改。
