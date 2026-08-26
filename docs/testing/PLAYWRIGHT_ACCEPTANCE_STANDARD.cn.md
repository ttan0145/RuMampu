# Playwright 验收测试规范

语言：**中文（CN）** | [English](PLAYWRIGHT_ACCEPTANCE_STANDARD.md)

## 目的

本规范让浏览器验收结果能够从 Epic 追踪到 User Story（US），再追踪到每一条 Acceptance Criterion（AC）。它适用于已经声明完成、准备交给组员交叉测试的工作。

## 强制结构

```text
test.describe("Epic N — name", { tag: "@epicN" })
  test("USN.N — name", { tag: "@usN.N" })
    ac("ACN.N.N", "criterion title", async () => { ... })
```

- 一个 `frontend/e2e/epicN.spec.ts` 只负责一个 Epic。
- 每个正式 US 至少有一个独立命名的 Playwright test。
- 每条 AC 必须以正式编号在 `ac(...)` step 中且只出现一次。
- 关系紧密的多条 AC 可以共享同一条浏览器流程，不要求为每条 AC 单独启动浏览器测试。
- 不属于正式 AC 的工程回归使用 `TECH-EN-NN` 标题和 `@hardening` tag，不得虚构 AC 编号。
- 测试和 step 标题使用英文，因为项目以英文为主交付语言。

HTML 报告因此可以按 `Epic → US → AC` 展开，同时浏览器上下文数量仍与真实用户流程相匹配。

## Playwright 与后端测试的分工

Playwright 验证用户可观察行为和关键前后端集成，包括导航、表单校验、显式确认、可访问图表状态、刷新后持久化、失败恢复，以及基于权威 API 结果的路由。

后端测试继续负责穷举排列、金额舍入、数据库约束、服务层不变量、访客隔离，以及不需要浏览器的验证分支。同一条 AC 可以由两层共同提供证据；如果结果在 UI 可见，Playwright 必须验证该可见结果。

## 稳定测试设计

- 优先使用 role、accessible name、可见标签或 `data-testid`，避免依赖视觉布局的 CSS。
- 通过正式 UI 或版本化 API 契约建立测试记录；仅可对已有文档说明的 fixture 使用开发场景端点。
- 每个 test 使用独立浏览器上下文和 guest session，不依赖前一条测试。
- 本地验收服务器共用 SQLite 时保持单 worker。
- 仅在网络边界模拟失败，并验证 UI 能进入有界、可恢复的状态。
- 复用 helper 放在 `frontend/e2e/support`，静态 fixture 放在 `frontend/e2e/fixtures`。

## 追踪门槛

`npm run test:e2e:traceability` 会把正式需求快照与代码中的 `ac(...)` 注册逐项比较；缺失、未知或重复 AC 都会导致失败。完成的 Epic 在 `frontend/scripts/check-e2e-traceability.mjs` 中登记。

当前基线：

| Epic | US 场景 | 正式 AC 映射 |
| --- | ---: | ---: |
| Epic 1 | 8 | 56/56 |
| Epic 2 | 4 | 18/18 |

其他 Epic spec 仍可作为可执行回归测试，但在正式需求快照和精确映射登记前，不能依据本规范宣称 AC 全部完成。

## 命令

在 `frontend` 目录运行：

```powershell
npm run test:e2e:traceability
npm run test:e2e:epic1
npm run test:e2e:epic2
npm run test:e2e:acceptance
npm run test:e2e
```

`test:e2e:acceptance` 运行已完成的 Epic 1 与 Epic 2；`test:e2e` 先检查追踪关系，再运行仓库中的全部浏览器 spec，CI 使用后者。

## 报告与证据

- 临时 HTML 报告：`output/playwright/report/`
- 失败 trace 与截图：`output/playwright/test-results/`
- 经审核的证据：`output/playwright/epic-N/evidence/`

报告和失败产物不进入 Git。普通测试不会改写已审核截图。只有明确需要刷新证据时才设置 `UPDATE_EVIDENCE=1`，运行对应 Epic、人工检查图片，并在获得批准后提交。

## 完成规则

只有同时满足以下条件，才可称一个 Epic 的 Playwright 验收已完成：

1. 英文需求快照为权威版本，AC 数量已经确定；
2. 每个 US 都有可执行场景，每条 AC 恰好映射一次；
3. traceability、TypeScript 和该 Epic 的 Playwright suite 全部通过；
4. 非视觉业务规则有相应后端测试；
5. 证据和文档已审核，不含失效链接或无依据的完成声明。
