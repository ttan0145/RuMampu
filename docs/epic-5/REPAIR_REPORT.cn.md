# Epic 5 修复与验收报告（2026-10-08）

**本轮审计指出的实现和验收缺口已修复。** 当前本地代码覆盖 8 个 US、68 条正式 AC，全部精确映射并执行通过。最终验证时间：2026-10-08 17:20 SGT。这份报告更新的是本地实现与运行证据；线上迁移、团队签核及 LeanKit 泳道仍按实际交付流程处理。

## 修复结果

| 审计项 | 完成的修复 | 验证 |
| --- | --- | --- |
| AC5.7.5 跨设备进度 | 新增账号 `learning_progress`；PATCH 保存、登录恢复、空对象重置、有界校验与账号隔离 | 后端保存/隔离/拒绝无效输入；UI 刷新与另一浏览器登录恢复 |
| AC5.7.6 奖励冲突 | 移除阅读徽章与庆祝弹层；只保留普通已读状态，其他功能始终可用 | 未阅读时使用工具；完成主题后无奖励、streak 或庆祝 |
| AC5.5.3 来源缺失 | 19 篇说明全部配置可打开的来源与核对日期，删除未经支持的结论与草稿状态 | 全部 19 篇最后页的来源、日期与免责声明；[来源清单](LEARN_SOURCES.md) |
| AC5.5.1、AC5.7.4 入口/总数 | Prepare 增加 Learn 入口和已读文章总数；保留主题进度、续读与重读 | 实际入口与主题/Prepare 数字，跨设备一致 |
| AC5.5.4 机构链接 | SJKP 链接直接打开参与机构目录 `/en/fi-partners` | 点击后的真实外链目标 |
| AC5.5.9 页尺寸 | 阅读页减少装饰；个人金额页以金额替代重复插图；保留正常字号的正文和来源 | 两种手机尺寸下 112 次实测均无需滚动；来源与免责声明无遮挡 |
| Learn 20 条无验收 | 新增 `epic5-learn.spec.ts`，US5.5–5.7 各 AC 使用正式编号/英文标题登记一次 | Epic 5 追溯从 48 条补齐为 68/68，0 条延期 |
| 过时说明 | 基线、索引、实现矩阵、API 契约和日志统一到迭代 3 的实际范围 | 逐条基线与看板编号/标题一致；当前文档不再称 Learn 仅本地保存或没有测试 |
| 本地 House costs 500 | 数据未加载或表缺失时返回明确的 HTTP 503；savepoint 防止失败查询污染后续事务 | 4 项后端回归；本轮全量日志中不再出现缺表 traceback |

## 最新验证

| 检查 | 结果 |
| --- | --- |
| 前端和 E2E TypeScript | 通过 |
| Epic 5 正式 AC 追溯 | 68/68，全部登记一次、0 条延期 |
| 完整 Playwright suite | 111/111，通过；耗时 16.4m，包含 Epic 5 的 30 项测试 |
| 完整 Django suite | 215/215，通过；独立 SQLite 测试库 |
| 模型/迁移一致性 | `makemigrations --check --dry-run`：No changes detected |
| Learn 页尺寸 | 19 篇、51 页 × 两种尺寸 + 五处个人金额 × 两种尺寸 = 112 次；均无纵向溢出 |
| API 文档 | `learning_progress` 和 House costs 503 已记录；OpenAPI 重新生成与原文件一致 |

OpenAPI 生成器仍有既有的 serializer 推断和 operationId 冲突诊断，未将该结果称为无警告。前期费用仍来自前端 `fees.ts`，与 ADR 0004 的后端化方向存在已记录的架构边界；本轮没有把这项改成已经完成。

小屏幕证据：

![个人费用、来源与免责声明完整可见](C:/Users/86283/Desktop/FIT5120/RuMampu/output/playwright/epic-5/evidence/ac5.5.6_ac5.5.9__personal-fees-small-phone.png)

## 需求与看板依据

- [LeanKit 看板](https://monashie.leankit.com/board/2494615425)，依据 2026-10-08 15:40 SGT 的只读审计快照，筛选 MAIN PROJECT 的 RuMampu 卡片。
- [v5 用户故事](https://docs.google.com/document/d/1otRZncPCXhfn5hjv_WrL7usLKMiP2R-N/edit)与 [迭代 3 新增故事](https://docs.google.com/document/d/1szV8OCtENI9qgB-RUIekVrl3YvjSah057hqbcmUlYHQ/edit)合并成 [68 条基线](../requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)。
- 修复前审计快照中，Epic 和 8 张 US 卡均在 Doing；AC 为 67 张 Doing、1 张 TO DO THIS ITERATION。本轮未写入 LeanKit，未声称团队签核已经完成。
- 修复前核对报告和原始材料保留于工作区；[修复前审计报告](C:/Users/86283/Desktop/FIT5120/RuMampu_Epic5_完成情况核对_2026-10-08.md)是历史快照。

## 部署与复验

更新后端时先执行 `backend/.venv/Scripts/python.exe backend/manage.py migrate --noinput`，确保 `finance.0022_userappstate_learning_progress` 已应用，再发布前端。生产 PostgreSQL 迁移与线上验收本轮尚未执行。真实房价交易数据未加载时，House costs 明确不可用，不会填入占位价格。

本轮在本地验证完修复后，可以按团队流程复核账号换设备、Learn 来源与 Prepare 进度，再处理签核和对应看板状态。

## 逐条 AC 执行结果

下表均来自本轮完整套件，通过状态以实际执行为依据。

| AC | 正式标题 | 对应测试/步骤 | 结果与实现缺口 |
| --- | --- | --- | --- |
| AC5.1.1 | Show Upfront cash | [epic5.spec.ts:267](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:267) — `ac(AC5.1.1)` | 本轮执行通过 |
| AC5.1.2 | Show Cash buffer | [epic5.spec.ts:271](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:271) — `ac(AC5.1.2)` | 本轮执行通过 |
| AC5.1.3 | Show Documents & financing | [epic5.spec.ts:275](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:275) — `ac(AC5.1.3)` | 本轮执行通过 |
| AC5.1.4 | Navigate to preparation tools | [epic5.spec.ts:280](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:280) — `ac(AC5.1.4)` | 本轮执行通过 |
| AC5.1.5 | Show what is set aside so far | [epic5.spec.ts:302](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:302) — `ac(AC5.1.5)` | 本轮执行通过 |
| AC5.2.1 | Display cash available | [epic5.spec.ts:325](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:325) — `ac(AC5.2.1)` | 本轮执行通过 |
| AC5.2.2 | Identify cash available as user data | [epic5.spec.ts:329](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:329) — `ac(AC5.2.2)` | 本轮执行通过 |
| AC5.2.3 | Display cash required | [epic5.spec.ts:333](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:333) — `ac(AC5.2.3)` | 本轮执行通过 |
| AC5.2.4 | Display upfront gap | [epic5.spec.ts:338](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:338) — `ac(AC5.2.4)` | 本轮执行通过 |
| AC5.2.5 | Visualise available versus required | [epic5.spec.ts:343](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:343) — `ac(AC5.2.5)` | 本轮执行通过 |
| AC5.2.6 | Highlight an upfront shortfall | [epic5.spec.ts:351](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:351) — `ac(AC5.2.6)` | 本轮执行通过 |
| AC5.2.7 | Display upfront cost components | [epic5.spec.ts:363](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:363) — `ac(AC5.2.7)` | 本轮执行通过 |
| AC5.2.8 | Handle a zero deposit | [epic5.spec.ts:385](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:385) — `ac(AC5.2.8)` | 本轮执行通过 |
| AC5.2.9 | Enter available upfront cash | [epic5.spec.ts:408](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:408) — `ac(AC5.2.9)` | 本轮执行通过 |
| AC5.2.10 | Record the cash snapshot date | [epic5.spec.ts:430](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:430) — `ac(AC5.2.10)` | 本轮执行通过 |
| AC5.2.11 | Group the costs by when they fall due | [epic5.spec.ts:450](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:450) — `ac(AC5.2.11)` | 本轮执行通过 |
| AC5.2.12 | Treat the earnest deposit as part of the deposit | [epic5.spec.ts:480](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:480) — `ac(AC5.2.12)` | 本轮执行通过 |
| AC5.2.13 | Work out the legal fees from the published scale | [epic5.spec.ts:489](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:489) — `ac(AC5.2.13)` | 本轮执行通过 |
| AC5.2.14 | Work out stamp duty from the published scale | [epic5.spec.ts:501](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:501) — `ac(AC5.2.14)` | 本轮执行通过 |
| AC5.2.15 | Apply the first-home exemption as a switch I control | [epic5.spec.ts:511](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:511) — `ac(AC5.2.15)` | 本轮执行通过 |
| AC5.2.16 | Ask for the figures that have no published scale | [epic5.spec.ts:463](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:463) — `ac(AC5.2.16)` | 本轮执行通过 |
| AC5.2.17 | State the pot once | [epic5.spec.ts:547](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:547) — `ac(AC5.2.17)` | 本轮执行通过 |
| AC5.3.1 | Display cash-buffer amount | [epic5.spec.ts:620](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:620) — `ac(AC5.3.1)` | 本轮执行通过 |
| AC5.3.2 | Explain what the buffer represents | [epic5.spec.ts:635](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:635) — `ac(AC5.3.2)` | 本轮执行通过 |
| AC5.3.3 | Display running balance by month | [epic5.spec.ts:657](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:657) — `ac(AC5.3.3)` | 本轮执行通过 |
| AC5.3.4 | State record basis | [epic5.spec.ts:673](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:673) — `ac(AC5.3.4)` | 本轮执行通过 |
| AC5.3.5 | State that it is not a general rule | [epic5.spec.ts:679](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:679) — `ac(AC5.3.5)` | 本轮执行通过 |
| AC5.3.6 | Explain the displayed buffer result | [epic5.spec.ts:687](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:687) — `ac(AC5.3.6)` | 本轮执行通过 |
| AC5.3.7 | Place the zero line where zero falls | [epic5.spec.ts:705](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:705) — `ac(AC5.3.7)` | 本轮执行通过 |
| AC5.3.8 | Mark where the deepest fall starts and ends | [epic5.spec.ts:642](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:642) — `ac(AC5.3.8)` | 本轮执行通过 |
| AC5.3.9 | Say when the months do not catch up | [epic5.spec.ts:725](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:725) — `ac(AC5.3.9)` | 本轮执行通过 |
| AC5.4.1 | Display document checklist | [epic5.spec.ts:751](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:751) — `ac(AC5.4.1)` | 本轮执行通过 |
| AC5.4.2 | Include visible document types | [epic5.spec.ts:755](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:755) — `ac(AC5.4.2)` | 本轮执行通过 |
| AC5.4.3 | Toggle checklist items | [epic5.spec.ts:761](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:761) — `ac(AC5.4.3)` | 本轮执行通过 |
| AC5.4.4 | Display SJKP published criteria | [epic5.spec.ts:772](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:772) — `ac(AC5.4.4)` | 本轮执行通过 |
| AC5.4.5 | Display source and date | [epic5.spec.ts:783](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:783) — `ac(AC5.4.5)` | 本轮执行通过 |
| AC5.4.6 | Avoid displaying unsupported approval status | [epic5.spec.ts:789](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:789) — `ac(AC5.4.6)` | 本轮执行通过 |
| AC5.4.7 | Display financing disclaimer | [epic5.spec.ts:800](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:800) — `ac(AC5.4.7)` | 本轮执行通过 |
| AC5.5.1 | Open the explanations from Prepare | [epic5-learn.spec.ts:88](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:88) — `ac(AC5.5.1)` | 缺口已修复；本轮执行通过 |
| AC5.5.2 | Sections shown as tabs | [epic5-learn.spec.ts:94](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:94) — `ac(AC5.5.2)` | 本轮执行通过 |
| AC5.5.3 | Every explanation names its source and date | [epic5-learn.spec.ts:102](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:102) — `ac(AC5.5.3)` | 缺口已修复；本轮执行通过 |
| AC5.5.4 | Government sources only | [epic5-learn.spec.ts:133](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:133) — `ac(AC5.5.4)` | 缺口已修复；本轮执行通过 |
| AC5.5.5 | Reach the right tab from each tool | [epic5-learn.spec.ts:170](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:170) — `ac(AC5.5.5)` | 本轮执行通过 |
| AC5.5.6 | Show my own figure where one exists | [epic5-learn.spec.ts:180](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:180) — `ac(AC5.5.6)` | 本轮执行通过 |
| AC5.5.7 | Explain terms where they appear | [epic5-learn.spec.ts:163](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:163) — `ac(AC5.5.7)` | 本轮执行通过 |
| AC5.5.8 | Not advice | [epic5-learn.spec.ts:128](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:128) — `ac(AC5.5.8)` | 本轮执行通过 |
| AC5.5.9 | One idea per page | [epic5-learn.spec.ts:212](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:212) — `ac(AC5.5.9)` | 缺口已修复；本轮执行通过 |
| AC5.5.10 | Move between pages with buttons | [epic5-learn.spec.ts:154](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:154) — `ac(AC5.5.10)` | 本轮执行通过 |
| AC5.5.11 | Refer EPF out rather than explain it | [epic5-learn.spec.ts:235](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:235) — `ac(AC5.5.11)` | 本轮执行通过 |
| AC5.6.1 | A tab for irregular income | [epic5-learn.spec.ts:245](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:245) — `ac(AC5.6.1)` | 本轮执行通过 |
| AC5.6.2 | Explain the financing guarantee and its limits | [epic5-learn.spec.ts:250](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:250) — `ac(AC5.6.2)` | 本轮执行通过 |
| AC5.6.3 | Link documents to the checklist | [epic5-learn.spec.ts:261](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:261) — `ac(AC5.6.3)` | 本轮执行通过 |
| AC5.7.1 | Show progress on each explanation | [epic5-learn.spec.ts:282](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:282) — `ac(AC5.7.1)` | 本轮执行通过 |
| AC5.7.2 | Grey out what I've finished | [epic5-learn.spec.ts:293](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:293) — `ac(AC5.7.2)` | 本轮执行通过 |
| AC5.7.3 | Resume where I stopped | [epic5-learn.spec.ts:288](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:288) — `ac(AC5.7.3)` | 本轮执行通过 |
| AC5.7.4 | Show progress for each section and overall | [epic5-learn.spec.ts:302](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:302) — `ac(AC5.7.4)` | 缺口已修复；本轮执行通过 |
| AC5.7.5 | Keep progress between sessions | [epic5-learn.spec.ts:307](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:307) — `ac(AC5.7.5)` | 缺口已修复；本轮执行通过 |
| AC5.7.6 | Nothing is locked behind reading | [epic5-learn.spec.ts:322](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5-learn.spec.ts:322) — `ac(AC5.7.6)` | 缺口已修复；本轮执行通过 |
| AC5.8.1 | Hold the buffer first | [epic5.spec.ts:939](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:939) — `ac(AC5.8.1)` | 本轮执行通过 |
| AC5.8.2 | One reading on every screen | [epic5.spec.ts:955](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:955) — `ac(AC5.8.2)` | 本轮执行通过 |
| AC5.8.3 | Say what is held | [epic5.spec.ts:945](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:945) — `ac(AC5.8.3)` | 本轮执行通过 |
| AC5.8.4 | Show how much of the buffer is covered | [epic5.spec.ts:970](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:970) — `ac(AC5.8.4)` | 本轮执行通过 |
| AC5.8.5 | Nothing is held without a buffer | [epic5.spec.ts:929](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:929) — `ac(AC5.8.5)` | 本轮执行通过 |
| AC5.8.6 | Amounts, not a verdict | [epic5.spec.ts:990](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:990) — `ac(AC5.8.6)` | 本轮执行通过 |
| AC5.8.7 | Say when the held amount changes | [epic5.spec.ts:1000](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:1000) — `ac(AC5.8.7)` | 本轮执行通过 |
| AC5.8.8 | Go on to the saving plan | [epic5.spec.ts:984](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:984) — `ac(AC5.8.8)` | 本轮执行通过 |
| AC5.8.9 | Using the buffer takes it off the pot | [epic5.spec.ts:821](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:821) — `ac(AC5.8.9)` | 本轮执行通过 |
| AC5.8.10 | Name my safety money | [epic5.spec.ts:856](C:/Users/86283/Desktop/FIT5120/RuMampu/frontend/e2e/epic5.spec.ts:856) — `ac(AC5.8.10)` | 本轮执行通过 |
