# 迭代 2 新版 UI 适配状态

更新：2026-09-11。Epic 1、2 已完成新版 UI 适配与本地验收。

## 范围与依据

已同步至 `origin/main` 的 `7feea84`，在最新版前端上适配 Epic 1、2并保留现有界面设计。依据为网盘 v3 US/AC（2026-09-06）及迭代 2 Epics/Pain Points 补充说明（2026-09-07）。Epic 1 共 62 条、Epic 2 共 18 条唯一 AC。AC1.1.8 Your Data 按用户要求暂缓；US1.9 银行电子账单处理不在本轮范围。

用户要求完成本地适配后自行验收，再决定推送。当前未提交、未推送，也未移动看板卡片。

## 完成结果

- 新版引导、Manual / Scan / Import 入口、Quiet months 入口和金额显示规则已接入验收脚本。
- 测试 API 与界面使用一致的访客标识，避免测试数据和界面落入不同访客记录。
- Income pattern 每次打开重新请求服务端计算结果。
- 新增收入编辑、金额格式验证的 AC 映射；Your Data 显式标为暂缓。
- 历史月总额入口按新版 `Per month` 流程验收，默认最近一个已结束月份，当前未结束月份不可选。
- 补充验证了新版 UI 明示但未单列为正式 AC 的小功能：周收入可选择周内任意日期、收入扫描示例可确认保存、支出 CSV 示例可映射保存。
- 迭代补充要求已闭环：重新打开 Income pattern 会读取新增记录；补录被标记的淡季月份后 Coverage 提示会更新。
- 未新增或重排界面。唯一文案修正是移除尚未实现的银行电子账单能力声明；US1.9 仍在范围外。

## 验收证据

- AC 追踪：Epic 1 为 61 条可执行 + AC1.1.8 一条明确暂缓，共 62 条；Epic 2 为 18/18，共 80 条且每条恰好映射一次。
- Playwright：同步 `7feea84` 并解决一处历史月选择逻辑冲突后，Epic 1、2、技术加固及 12 个月综合 CSV 共 24/24 通过（2026-09-11，2.5 分钟）。
- Django finance：90/90 通过。
- TypeScript：`npm run typecheck` 通过。
- 新版主流程截图已刷新到 `output/playwright/epic-1/evidence` 与 `output/playwright/epic-2/evidence`。

## 交付边界

- `Your Data`（AC1.1.8）按用户要求暂缓，不以占位 UI 冒充完成。
- 拟议 US1.9 银行电子账单依赖未确定的处理器，本轮未实现。
- 当前本地工作树未提交、未推送；LeanKit 仅只读核查，未移动或编辑卡片。
- 下一步仅需负责人进行本地体验验收，再决定是否提交和推送。

复验命令：在 frontend 目录执行 `npm run test:e2e:acceptance -- e2e/income-import-comprehensive.spec.ts`。
