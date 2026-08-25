# 12 个月网约车司机仿真场景

语言：**中文（CN）** | [English](SCENARIO_GIG_DRIVER_12M.md)

- 场景 ID：`my-gig-driver-12m`
- 用途：Epic 1 全链路回归，以及 Epic 2/5 后续算法和页面的稳定输入
- 性质：确定性的产品测试夹具，不是马来西亚司机收入统计、预测或财务建议

## 为什么不让 Playwright 点击 300 次

真实用户会逐笔记录，但端到端测试不需要机械等待每一次输入。场景通过开发专用 API 在同一个访客 session 中一次创建全部事实，再让 Playwright 操作真实页面。这样同时保留：

- 与正式模型、访客隔离和持久化相同的数据路径；
- 可重复的金额和日期，便于发现算法回归；
- 百毫秒级准备速度，而不是数分钟的 UI 重复点击；
- 页面导航、计算、图表和刷新仍由真实浏览器验证。

## 场景数据

场景覆盖 2025-08 至 2026-07：

| 月份 | 情况标签 | 毛收入 | 已记录日常支出 |
|---|---|---:|---:|
| 2025-08 | baseline | RM4,780 | RM1,080 |
| 2025-09 | strong_demand | RM5,260 | RM1,130 |
| 2025-10 | weather_variation | RM4,930 | RM1,100 |
| 2025-11 | demand_recovery | RM5,480 | RM1,170 |
| 2025-12 | holiday_peak | RM6,620 | RM1,430 |
| 2026-01 | post_holiday_slow | RM4,380 | RM1,080 |
| 2026-02 | vehicle_downtime | RM3,910 | RM1,190 |
| 2026-03 | festive_evening_peak | RM5,840 | RM1,290 |
| 2026-04 | festive_cooldown | RM4,690 | RM1,150 |
| 2026-05 | strong_weekends | RM5,560 | RM1,230 |
| 2026-06 | mixed_demand | RM5,010 | RM1,170 |
| 2026-07 | strong_demand | RM5,790 | RM1,320 |

合计创建：

- 12 个财务月份；
- 60 笔收入：每月 4 笔 E-hailing、1 笔 Food delivery；
- 240 笔支出：每月 20 个不同日期，覆盖 Meals、Groceries、Tolls & parking、Family、Other；
- 月工作成本 RM750；
- 月承诺估计 RM2,230，其中 Food 和 Family 是可由完整支出月份替代的日常变量项。

金额有意包含强月、淡月和车辆停工月，让后续算法面对波动而不是一条平线。收入/支出标签只解释测试数据的构造意图，不宣称对应事件一定会产生该金额。

## 开发专用 API

端点默认关闭，并从公开 OpenAPI 排除。启用后只会重置当前访客的 Epic 1 财务数据，不影响其他 session：

```powershell
$env:ENABLE_TEST_SCENARIOS = 'True'
.\backend\.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000 --noreload
```

列出场景：

```http
GET /api/v1/dev/scenarios/
```

装载场景：

```http
POST /api/v1/dev/scenarios/my-gig-driver-12m/load/
Content-Type: application/json

{"confirm_reset": true}
```

必须显式发送 `confirm_reset=true`。重复装载会替换当前测试访客的数据，不会叠加重复记录；生产环境或未启用时返回 404。

## Playwright 回归流

### Flow A：快速装载与档案

1. 打开 Web 应用，让正式 API 建立访客 session。
2. 在当前页面上下文 POST 场景装载端点。
3. 刷新页面，验证 `You have 12 months of income recorded` 和 Aug–Jul 覆盖范围。

本次实测浏览器往返约 114ms，服务器装载约 85.8ms；见[首页截图](../../output/playwright/scenarios/gig-driver-12m/01-home-12-months.png)。

### Flow B：收入波动

1. 进入 Money，核对最近月两个收入来源和支出分类。
2. 进入 Income pattern，验证 12 个柱、平均/中位/最高/最低和淡月可见。

扣除 RM750 工作成本后，Epic 2 权威结果为 average `4437.50`、median `4385.00`、highest `5870.00`、lowest `3160.00`、range `2710.00`、population standard deviation `699.16`，记录最低月为 `2026-02`。参见当前 [Epic 2 收入形态证据](../../output/playwright/epic-2/evidence/01-income-pattern-12m.png)；旧[汇总截图](../../output/playwright/scenarios/gig-driver-12m/02-money-overview.png)继续作为 Epic 1 证据保留。

### Flow C：完整支出月份

1. 进入 Daily expenses，验证 Jul 为 RM1,320、记录 20 天。
2. 进入 Monthly summary，验证 12 个月均为 `fully recorded · used in the test`。

见[12 个月支出截图](../../output/playwright/scenarios/gig-driver-12m/04-expense-months-12m.png)。

### Flow D：住房测试

1. 使用现有 RM250,000、0 首付、4.3%、35 年场景。
2. 运行住房测试，验证全部 12 个月进入计算。
3. 当前确定性结果为 2/12 个月不足，最大缺口 RM742。

见[住房测试截图](../../output/playwright/scenarios/gig-driver-12m/05-housing-result-12m.png)。

### Flow E：为后续 Epic 复用

- Epic 2 使用相同的 12 个月 `condition`、收入范围和 coverage 作为确定性回归基线。
- Epic 5 可复用同一收入/支出/住房状态验证 buffer、upfront 和情景对比，而不重新造数据。

当前 Cash buffer 页面已经能读取 Aug–Jul 全部记录；见[复用截图](../../output/playwright/scenarios/gig-driver-12m/06-epic5-buffer-reuse.png)。Epic 2 已按自己的 US/AC 验收，Epic 5 仍需独立交付。夹具只提供事实，不替产品定义结论。

## 保护与维护规则

- 新场景注册到 `available_scenarios()`，使用新的稳定 ID，不修改已有场景金额。
- 已有场景一旦作为回归基线，金额变化视为测试契约变更，需要同步预期值和证据。
- 场景端点不得进入生产 OpenAPI，也不得绕过 session 隔离。
- 场景数据不得被描述成真实用户、市场均值或收入预测。
