# 项目开发日志

语言：**中文（CN）** | [English](CHANGELOG.md)

## 2026-10-05 — 修复独立核验发现的输入、缓冲撤销和测试时序问题

状态：已修复并完成本地复测（未提交）

- 把 Upfront cash 的内部行、输入框和分组组件提升到模块作用域，避免每输入一个字符就重建输入框并失焦。AC5.2.9 使用逐字键入，仍核对到账户的金额、日期、差额和刷新结果。
- `saving_plan.buffered` 记录打卡时进入缓冲还是村庄；撤销按原分配处理，跨阶段和刷新后也一致。前后端接受可选的布尔/null 数组，保留旧计划兼容；旧记录无法推回每笔分配，撤销时限制缓冲保留额不超过仍声明存下的金额。4 条回归在旧实现全部失败，修复后通过；账户往返与非法输入原子拒绝由后端测试覆盖。
- Ask Ruma 首次布局时放在右下方，贷款编辑测试保持它可见，移除隐藏按钮的 CSS。
- 收据识别等待类别记录加载完成后匹配类别；增加故意延迟类别响应的浏览器回归。
- 访客测试通过正常点击走当前入口，等待标签可操作。Epic 5 账户 fixture 等登录 POST 成功、登录页关闭后才返回；原 TECH-5.5 会在登录未结束时刷新并中断登录，现已跑到转入、服务器金额和刷新断言。
- Epic 3 改用正式 US3.1 验收编号：融资金额真正对应 AC3.1.3（仍延期），AC3.1.6 验证月供，AC3.1.7 验证已知月付。追溯门只新增 US3.1 切片（6 可执行 + 1 延期 / 7），不宣称整个 Epic 3 完成。
- 纠正缓冲测试与双语文档中“任意循环换序金额都相同”的说法：按原时间顺序的每个后缀独立核对，最大所需现金等于整份记录的最大跌幅，算法及四组固定金额不变。

### 验证

- 本地隔离 SQLite：Django check 无问题，迁移无漂移，178/178 后端测试通过。
- 两项 TypeScript 检查和追溯门通过；OpenAPI 验证退出 0、内容与文档一致（既有 4 warning / 77 error 诊断不变）。
- 定向浏览器复测 12/12 通过；完整 Playwright 一次运行 98/98 通过（13 文件，15.3 分钟，0 skipped，0 retries）。测试使用仓库外的 SQLite 和产物目录，测试后删除。

## 2026-10-03 — 验收测试与应用重新对齐；储蓄只算一次；缓冲更稳；转入的钱不再丢

状态：已在本地实现并检查，等待负责人验收（未提交）

- **浏览器验收测试。** CI 的 “Run browser acceptance” 一步从 2026-09-04 起每次推送到 main 都失败。现在测试已与当前 main（`aa90231`，已在本地合并）以及 v24/v25 页面对齐：
  - 共用的 `openApp()` 会走完访客入口的 “Continue as a guest?” 确认框，并保留测试预先写入的 client id，所以通过 API 预置数据的测试在引导之后仍能看到这些数据。
  - Epic 1 到 4、导入回归和住房集成测试已按当前页面改写：收入只问一个金额加日期选择器；过去月份从 “Add a month I did not record” 补录；工作成本在日常支出里打开 “This was for work” 记录；收据标签；最低月份那一行和即点即存的覆盖提示；房屋表单的贷款弹层；结果页上的收入下降。原来写死日期或选未来日期的步骤，改为在上个月里选日，每月哪一天跑都能过。
  - 当前页面已不满足的标准记为明确延期并写明原因，不算通过：AC1.3.7（编辑工作成本）、AC1.4.3 和 AC1.4.4（账单页的储蓄）、AC3.1.3（融资金额）、AC4.4.4（自定义降幅）、AC4.4.8 和 AC4.4.9（把降幅标为假设）。追溯闸门只允许其中 Epic 1 的这几条。
  - 补回 v24 移植丢掉的两处：日常支出工作成本模式下的 “+ Your own cost”（AC1.3.4），以及收入规律页 (i) 后面的最低月份规则（AC2.3.2）。覆盖检查的月份格子现在会向辅助技术暴露勾选状态。
  - 删除 `work-costs-hardening.spec.ts`：其中 8 个检查针对旧的工作成本页，v24 起已没有任何入口。另删去两句过时断言（收入规律图的横向滚动提示、修改过的导入行下方的原始文字）。
  - 三个可能偶发失败的测试改稳：Epic 8 的访客转移流程现在等登录界面关闭后才点标签栏（负载高时失败过一次）；Epic 10 的月末检查把时钟固定在本月倒数第二天，而不是 29 号（平年的 2 月没有 29 号）；Epic 10 的村庄合并在第一步已经合并时不再走第二步（没有合并的一步会清空提示语）。
- **储蓄只算一次。** Epic 10 安全缓冲已占用的钱不再计入 *You have*、House 卡片和首页的差额，Upfront cash 页和 pot 明细会写明占用了多少（`pot.ts` 中的 `potHeld` 和 `potForUpfront`）。已有现金仍不会填进缓冲；这条规则（提议的 US5.8）等产品负责人和 Epic 10 负责人决定。
- **现金缓冲改按最大跌幅计算**（[ADR 0005](adr/0005-cash-buffer-deepest-fall.cn.md)）：不论从记录里哪个月开始，都能撑到记录结束所需的最小起始金额。`starting_liquidity` 新增 `fall_start` 和 `fall_end`，Cash buffer 页写明并标出这段月份。固定数据上 RM 680 变为 RM 1,940，RM 0 变为 RM 904.74，RM 4,740 不变。
- **结束月份转入的钱不再丢。** `pot_moved` 保存在账户里（迁移 0019，校验方式与 `cash_on_hand` 相同），本地快照也保存。旧快照里标为已转入、却没有金额的月份会重新出现，可以再转入一次。
- 重新生成 `docs/openapi.yaml`。

### 验证

- 后端：`check` 与 `makemigrations --check` 无问题；176 个测试通过；`spectacular --validate` 的输出与 `docs/openapi.yaml` 完全一致。
- 前端：`npm run typecheck`；追溯闸门（Epic 1 58 条可执行 + 4 条延期 / 62，Epic 2 18/18，Epic 5 36/36）；2026-10-03 分批完整跑完 Playwright（93 个测试）：Epic 1 和 2 22/22；Epic 3、4、住房集成、注册登录和导入 12/12；Epic 4 支出和 Epic 5 25/25；Epic 6 和 8 28/29，访客转移测试因超时失败一次，加上等待后重跑三次都通过；Epic 10 5/5。三个测试修好后，Epic 8 和 10 一起跑了一遍（29 个通过；村庄测试因地砖位置失败一次，据此做了修复），Epic 10 又重复跑了两遍（见下）。
- 本地没有运行：PostgreSQL 任务（本机没有 PostgreSQL；迁移 0019 只是新增一个字段），以及像 CI 那样在 Linux 上一次跑完全部测试。

## 2026-10-01 — OpenAPI 契约刷新

- 根据后端重新生成了 `docs/openapi.yaml`。已提交的文件落后于代码：缺少 6 个接口（`auth/export`、`auth/guest-transfer`、`auth/record`、`expenses/{entry_id}/coverage`、`housing/saved-tests/{test_id}`、`income/scan`）和 3 个 schema，还保留着旧的支出录入方式枚举。CI 里把已提交文件与最新 `spectacular` 输出做对比的那一步因此无法通过。
- 按 CI 的方式检查过：`spectacular --validate` 成功，输出与已提交文件完全一致。

## 2026-10-01 — Epic 5 购房准备工具（v5）

状态：已实现；验收检查在本地通过，等待负责人验收

- 把 Epic 5 重新对齐到 v5 需求（云盘迭代 3：`TM16_RuMampu_User_Stories_and_Acceptance_Criteria_v5.docx`）：共 36 条验收标准，而之前仓库里的快照只有 25 条。v5 原文在 [`EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md`](requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)，追溯闸门按它检查 Epic 5。User Story 5.5 到 5.7（迭代 3 新增的 Learn 解释页）尚未开发。
- 重新开放 House → Prepare for a house 入口和 Money → Cash buffer 快捷入口，它们自 2026-09-15 起一直指向“Coming soon”占位页。占位页及其路由继续保留。
- 补上缺失或一直没显示的内容：Prepare 的 Cash buffer 入口（AC5.1.2）、Upfront cash 的零首付说明（AC5.2.8）、Documents & financing 的“65% check: needs review”提示（AC5.4.6）。这些文案早已在字符串表里。
- v5 新增：Upfront cash 页的“Cash I already have”录入，连同登记日期一起保存（AC5.2.9、AC5.2.10）。账户状态新增 `cash_on_hand_date`（迁移 0018，服务端校验），本地快照也保存它。
- “You have” 现在是一个 pot（已有现金 + 计划已存 + 结束月份转入）。Upfront cash、House 卡片（AC5.1.5）、首页和储蓄计划显示同一个合计，“How this adds up”弹层列出全部三部分（AC5.2.17）。
- 现金缓冲图的零线落在零实际所在的位置（AC5.3.7），月份简称也不再折成两行。
- 给前期现金图和滚动余额图加上无障碍标签和稳定的测试 id，使数值可以被断言；首套房开关现在向辅助技术暴露开关状态。
- 新增 `epic5.spec.ts`（36 条验收标准各登记一次，另有两条工程回归）以及前期费用标准和 pot 的算术测试，`npm run test:e2e:epic5` 运行这两个文件。
- 新增 12 个月固定数据上的现金缓冲后端测试（RM 680、RM 0、RM 4,740，并包含每月余额）和现金日期的后端测试。
- 把 US8.4 的导航检查改回期望看到 Prepare 页面，而不是占位页。
- 在 [Epic 5 索引](epic-5/README.cn.md) 中记录验收情况和五个待决事项：pot 的读法是未经确认的理解且储蓄计划仍只扣除录入的现金、前期费用在前端计算（而 ADR 0004 规定以 Django 为权威）、部分必需文字放在 (i) 按钮后面、公开来源需要重新核验、Learn 故事尚未开发。

### 验证

- 后端测试：172 个通过，包含 3 个现金缓冲回归和 2 个现金日期测试；Django 检查和迁移漂移检查均无问题。新字段不属于任何 OpenAPI schema，因为账户状态接口没有声明 schema。
- `npm run typecheck`、追溯闸门（Epic 5 为 36/36）和 `npm run test:e2e:epic5`（16 个测试）通过。Epic 6、8、10（34 个测试）在 pot 改动后仍通过。
- 每条新增标准在行为被故意破坏时对应的检查都会失败（现金日期、pot 合计、零线、分组顺序、占位示例、定金、豁免上限、House 卡片），之前的三处缺口、错误的图表比例和折行的月份标签也是如此。
- 完整 Playwright 共 98 个测试：59 个通过、39 个失败，失败项都不在 Epic 5。这 39 个是 Epic 1、2、3、4、导入、工作成本和 `housing-integration` 的 spec，它们在未改动的提交 `707e2c0` 上本来就失败（其中覆盖各种失败类型的 8 个在那里重跑过）。多数是旧的 `openApp()` 辅助函数留下“Continue as a guest?”对话框挡住了第一次点击；两个在等 v22 首页已不再显示的文案。一个依赖日期的 Epic 10 测试在月初通过，但在每月最后一天会失败。本次没有修复这些。

## 2026-09-11 — 已确认导入收入支持编辑

- 已确认的 CSV 收入现在可以使用现有收入编辑流程，并继续保留 `CSV` 来源标签。
- 收入记录更新 API 现在可以修改导入记录的金额、日期与来源，同时不改变 `entry_method` 和导入行的原始审计快照。
- 增加后端与 Playwright 加固回归，不新增或伪造正式验收标准。

## 2026-09-04 — 收入删除与工作成本回归保护

- 清理由收入删除提交带回的工作成本旧提示和重复行级来源标记，并恢复窄屏记录行布局。
- 移除 Commitments 可编辑项目中重复的 `YOUR DATA`，同时保留汇总结果的 `CALCULATED`。
- 为手机端 Commitments 金额启用小数键盘，并确保小数值保存后不会被截断。
- 统一新增收入、手工支出和自定义收入冲击比例的手机端小数输入。
- 新增删除月内最后一笔收入的端到端回归，确认带日期工作成本保留，且该月重新计算为无收入。
- 增加访客隔离、重复删除、空月份清理、同月其他收入与工作成本保留的 API 测试，并重新生成包含 DELETE 操作的 OpenAPI。

## 2026-08-28 — I1 住房计算后端权威化

状态：已完成并通过 main 交付前验证

### 已交付

- 正式住房流程改为创建或更新访客归属 scenario、独立请求住房前置检查，再按 scenario ID 运行历史测试。
- 付款比较和收入下降通过非持久化覆盖值复用 `/housing/test-result/`；正式前端不再调用无状态 `/housing/test/`，也不再提交客户端计算的财务月份。
- 从 `calc.ts` 和 `state.tsx` 移除前端住房公式及 `preHousingOk()` 导航判断。
- 增加后端权威的前期资金缺口和起始缓冲金路径，并让首页与准备页展示保留的服务端响应。
- 增加 serializer、service 与 API 测试覆盖，重新生成 OpenAPI，并以 ADR 0004 记录决策。

### 验证

- 完整后端测试 98 项通过，其中住房测试 18 项。
- TypeScript、OpenAPI 校验、Django 系统检查及 migration drift 检查通过。
- 完整 Playwright 套件 28/28 通过；traceability gate 确认 Epic 1 为 56/56 AC、Epic 2 为 18/18 AC。
- 修复收入明细请求作为 session 首个请求时的 profile 初始化，避免历史月总额先创建 profile 后缺失默认收入来源、工作成本、固定开支和支出分类。

## 2026-08-26 — Playwright 验收测试标准化

状态：已在本地实施；尚未提交或推送

### 交付

- 将浏览器验收统一为 `Epic → US → AC`，正式 AC 作为报告中的具名 step，非需求回归独立标为 `TECH-*` hardening 测试。
- 新增可执行 Epic 1 suite：8 个 US 场景、56/56 AC 精确映射；将 Epic 2 重组为 4 个 US 场景、18/18 AC 精确映射，并保留失败、竞态和边界回归。
- 增加静态追踪门槛，在浏览器执行前拒绝缺失、未知或重复的 AC。
- 增加共享 app、evidence 和 acceptance helper；普通回归测试不再改写已审核的证据截图。
- 将共享 Playwright 报告与失败产物移出 Epic 2 证据目录，并记录英文主版本、中文镜像的规则与命令。

### 验证

- 追踪门槛：Epic 1 `56/56`；Epic 2 `18/18`。
- TypeScript 通过。
- 仓库全部 27 条 Playwright 场景均在内置 Chromium 通过，覆盖 Epic 1、Epic 2、Epic 3、Epic 4、Epic 8 与 housing integration。
- 验收测试发现并修复了首屏 guest session 竞态：coverage 现在会等待 income bootstrap 建立会话后再请求。

## 2026-08-25 — Epic 3 / Neon 集成兼容

状态：集成已加固；不代表全部 Epic 3 已完成

### 交付

- 将匿名 `HousingScenario` 绑定到财务数据使用的同一个 session `GuestProfile`，并增加“必须且只能有一个归属方”的数据库约束。
- 增加保留式数据迁移：既有无归属场景进入不可访问的 legacy profile，不会暴露给当前访客。
- 住房前置检查改为读取后端记录并复用 Epic 2 的月份/工作成本计算；旧客户端财务字段仍可接收，但不能覆盖持久化事实。
- 住房计算改用 `Decimal`，增加 half-up 响应舍入、重复成本分类校验和嵌套成本事务更新。
- 住房请求增加 credentials，使 finance 与 housing API 客户端保持同一个访客 session。
- 将 `PGHOST` 设为 PostgreSQL 显式开关，增加启动配置校验，并为 Neon 默认启用 TLS `require`。
- 在 SQLite 之外增加 PostgreSQL 16 CI 作业，且不保存托管 Neon 凭据。
- 用 ADR 0003 记录兼容边界，并同步架构、API 契约、OpenAPI 及英文/中文文档。

### 测试

- Django 全量 94 项本地通过，其中新增住房/数据库兼容测试 14 项，并覆盖保留式迁移。
- Playwright 7 条全部通过，包含真实浏览器住房/session 集成；SQLite 验收服务使用串行 browser worker。
- Django checks、migration drift、OpenAPI 校验及 TypeScript 检查通过。

## 2026-08-25 — Epic 2 后端权威收入形态

状态：完成并已加固；已获准交付 main

### 交付

- 完成 US2.1–US2.4 和 18/18 条验收标准。
- 新增版本化 `GET /api/v1/income-pattern/` 与 `GET/PUT /api/v1/income-coverage/`，不增加 legacy alias。
- 将月度聚合、当前工作成本扣减、描述统计、记录最低月识别和 coverage 评估移入应用服务。
- 新增按访客隔离的一对一 coverage 持久化，派生分析继续实时计算。
- 删除前端无来源阈值，改用 typed 权威响应、明确的 empty/limited/loading/saving/error/retry 状态和可横向滚动的可访问图表。
- 建立英文主版本与 `.cn.md` 镜像：需求快照、ADR 0002、API Contract、逐 US 验收记录、实施矩阵与索引。
- 删除 Epic 2 客户端 fallback 算法，将 API 模式设为正式默认，并让下游 coverage 提示直接使用权威响应。
- 增加过期响应拒绝与请求去重；coverage 保存失败时保留上一次确认结果及用户可重试草稿。
- 增加 model/service coverage 不变量、异常旧数据安全读取、支持大额聚合的金额响应字段、可访问选择状态与仓库 CI 门槛。
- 已 rebase 到组员的 US3.1–US3.3 与 Neon 改动，保留 housing 流程，恢复有文档说明的本地 SQLite fallback，并补全 housing OpenAPI 响应 schema，确保合并后的 main 仍可测试。

### 测试与验收

- 后端 `finance` 全套 80 项通过，其中 22 项为 Epic 2 专项。
- 12 个月场景固定验证 average `4437.50`、median `4385.00`、highest `5870.00`、lowest `3160.00`、range `2710.00`、population standard deviation `699.16`、最低月 `2026-02`。
- TypeScript、migration drift、Django system check、OpenAPI 生成/校验及 6 条可执行 Playwright Epic 2 流程全部通过。

### 边界

- 当前有效月度工作成本应用于全部记录月，并明确标识为 current-snapshot basis；不暗示历史成本版本。
- API 只返回描述事实，不返回预测、稳定分类、风险带、住房 shortfall reason 或无来源阈值。
- Coverage 持久化属于当前访客会话，不是账户级永久声明。

## 2026-08-25 — Epic 1 正式闭环

状态：完成；已交付 main

### 交付

- 建立 Django REST Framework 模块化后端、`/api/v1`、统一错误结构、OpenAPI、Swagger/ReDoc 和 8 个数据库迁移。
- 完成 Epic 1 的 8 个 User Story、56/56 条 Acceptance Criteria：
  - 多来源收入、异常值确认与访客持久化；
  - 历史月收入及月份口径约束；
  - 工作成本与三类固定财务承诺；
  - 手动支出、支出回顾和月度汇总；
  - 收据起点、人工核对与确认保存；
  - 历史收入 CSV 预览、错误行和确认导入。
- Expo 前端已接入收入、成本、承诺、支出和导入 API，保留 English、Bahasa Melayu、中文三语。
- 提取并归档完整 8 Epic/35 US/219 AC，以及 Epic 1 的 8 US/56 AC Markdown 快照。
- 项目默认文档统一为英文；中文资料以 `.cn.md` 明确标识并与英文版本互相链接。

### 测试与验收

- 后端 `finance` 自动化测试：58 项通过。
- 前端 TypeScript 检查通过。
- 数据库迁移检查无漂移，OpenAPI 生成与校验通过，`git diff --check` 通过。
- US1.1–US1.8 均留有真实 Playwright 浏览器验收截图。
- 新增默认关闭的 `my-gig-driver-12m` 测试场景：约 114ms 创建 12 个月、60 笔收入和 240 笔支出；已验证收入形态、完整支出月份、住房测试和 Epic 5 页面复用。

### 重要修正

- 修复前端启动阶段的 session 初始化竞态，避免多个首批请求建立不同访客档案。
- 收入来源与支出分类采用可阻止单独误删、同时允许访客整体级联清理的关系策略。
- 收入导入和收据保存均要求显式确认，未确认数据不会成为财务事实。

### 当前边界

- 收据读取仍是 prototype 起点，不宣称生产级 OCR，也不上传或长期保存原图。
- CSV 是当前唯一历史导入格式；XLSX、PDF、银行连接和自动列映射尚未实现。
- 用户账户、跨设备同步、生产数据保留/删除政策属于后续工作。
- Epic 2/5 可复用现有财务模型和确定性测试场景，但各自业务规则仍须按正式 US/AC 推进。
