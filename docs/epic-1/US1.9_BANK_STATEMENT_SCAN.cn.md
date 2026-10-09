# US1.9 银行账单收入读取验收记录

日期：2026-10-08  
基线：Epic 1 v7，AC1.9.1–AC1.9.5  
当前实现：Groq 收入图片读取；接受用户上传前的独立披露版本 `groq-statement-scan-2026-10-08-v1`

## 验收状态

| AC | 结果 | 实现与可复核证据 |
|---|---|---|
| AC1.9.1 — Told before upload | 已实现；界面行为待浏览器验收 | 上传图片前弹出独立 Groq 披露，列明发送对象、处理地点范围、留存例外及当前 ZDR 状态，并提供 Groq 官方数据与 DPA 链接。通用 AI 同意不能跳过此披露。`frontend/src/rumampu/assistant.tsx`、`state.tsx`、`persist.ts`、`strings.ts`、`ai-disclosure.ts`。 |
| AC1.9.2 — Transactions only | 已实现；API/后端单测覆盖，浏览器验收未运行 | Groq 输出 schema、规范化器和序列化器限制字段；界面只呈现日期、金额、来源和置信提示。服务层/API 单测覆盖额外模型字段不会进入输出。单次最多保留 20 条收入候选。`backend/finance/receipt_service.py`、`serializers.py`、`frontend/src/rumampu/screens/money.tsx`。 |
| AC1.9.3 — Review before save | 已实现；后端保存边界单测通过，浏览器验收未运行 | 结果先作为未保存草稿。扫描缺失日期不自动改成今天，缺日期/低置信行默认不勾选；需有有效日期、金额、来源且由用户选中并确认后才写入，只保存选中行。 |
| AC1.9.4 — Documented as a processor | 两份计划已补充并人工核对；自动断言未运行 | 代码库补充的 Iteration 2 Security Risk & Privacy Plan 与 Data Management Plan 均记载 Groq、处理/传输地点范围和保留期；安全计划同时记录 Global ZDR 与 Inference APIs ZDR 均关闭。见 [安全计划补充](../privacy/ITERATION_2_SECURITY_RISK_PRIVACY_PLAN.cn.md) 和 [数据管理计划补充](../privacy/ITERATION_2_DATA_MANAGEMENT_PLAN.cn.md)。 |
| AC1.9.5 — Failure is not silent | 已实现；后端失败无入账单测通过，浏览器退路验收未运行 | 读取失败显示错误并明确说明没有保存记录，提供“Enter income manually”手动录入退路；浏览器中的错误提示与手动入口尚未运行验收。 |

## 验收边界

计划中的 Playwright 使用内嵌 1×1 合成 PNG，并由路由返回受控结果或受控错误；本轮没有进入测试阶段。没有向 Groq 上传真实个人财务资料，也没有调用在线模型。后端单测使用受控 Groq 客户端替身。因此，已通过单测验证服务字段白名单、保存边界与失败不入账；它们不验证真实银行账单识别准确率或真实 Groq 端到端服务可用性。

当前功能处理收入／收益行，不声称解析 PDF、分类全部支出或导入所有流水项目。用户确认的是交易日期、金额和来源；不会导入或展示贷款资格、可负担性或信誉评估。真实部署中的 Groq 传输与保留口径以两份计划引用的[官方数据政策](https://console.groq.com/docs/your-data)和[DPA](https://console.groq.com/docs/legal/customer-data-processing-addendum)为准：默认不保留推理输入/输出；排错或滥用调查可保留至多 30 天，法律要求可能更久；如保留客户数据则位于美国 GCP，处理允许在美国及其他运营国家进行。当前账户 ZDR 未开启，故不承诺零保留。

## 验证命令

```powershell
$env:PLAYWRIGHT_BACKEND_PORT = '18767'
$env:PLAYWRIGHT_FRONTEND_PORT = '18768'
npx playwright test e2e/epic1.spec.ts --grep '@us1\.9' --output ..\output\playwright\epic1-supervised\us1.9\final\test-results --reporter=line
```

当前实际证据：`npm run typecheck` 通过；`node scripts/check-e2e-traceability.mjs` 显示 Epic 1 为 72 executable、0 deferred；`backend/.venv/Scripts/python.exe manage.py test finance.test_receipt_scan --verbosity 2` 为 20 项通过。Playwright 仅完成隔离服务启动尝试：后端 health 返回 200，前端服务未就绪，按收敛要求在测试开始前停止，故 US1.9 浏览器验收未运行。日志：[run.log](../../output/playwright/epic1-supervised/us1.9/final/run.log)。最终联合回归由主对话负责人决定，不以映射检查代替运行证据。
