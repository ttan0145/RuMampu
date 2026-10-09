# RuMampu 前端

语言：**中文（CN）** | [English](README.md)

Expo + React Native + TypeScript 客户端，支持 English、Bahasa Melayu 和中文。页面来自早期设计原型，但项目已经开始逐领域接入正式 Django API。

## 启动

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

正式开发默认进入后端 API 连接模式。`EXPO_PUBLIC_APP_MODE` 应保持为 `api`，`EXPO_PUBLIC_API_URL` 应指向版本化 API，例如：

```text
EXPO_PUBLIC_APP_MODE=api
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Expo Web 与 Django 应使用相同主机名，以便 `credentials: include` 能正确保存访客 session Cookie。未设置 API URL 时会使用本地 API 默认地址，因此后端不可用会明确报错。只有显式设置 `EXPO_PUBLIC_APP_MODE=prototype` 才进入内存原型模式；Epic 2 在该模式下不会生成客户端替代分析。

## 结构

```text
app/                         Expo Router 入口
src/rumampu/
  api.ts                     版本化 API 客户端和统一错误解析
  state.tsx                  应用状态、导航及 API 同步边界
  mock.ts                    尚未接通领域的原型数据
  calc.ts                    纯计算函数
  strings.ts                 三语文案
  theme.ts / ui.tsx          设计令牌和 UI 原语
  charts.tsx / svgs.tsx      图表和图形
  overlays.tsx               弹层、引导和全局反馈
  screens/                   各业务页面
```

## 开发规则

- 已接通领域以 API 数据为事实来源，不得同时由 mock 覆盖。
- 页面组件不直接拼接 URL；所有请求通过 `api.ts`。
- 流程判断使用 API 错误 `code`，不要依赖英文 `message`。
- 金额响应为小数字符串；展示格式化时保持字符串，只有纯展示性的图表比例可以转换为数值。
- 保存请求进行中必须禁用重复提交；API 幂等协议尚未实现。
- 提交前运行 `npm run typecheck`。
- 运行 `npm run test:e2e:epic2` 执行接入后端的 Epic 2 浏览器验收；配置会自动应用 migration 并启动本地 Django 与 Expo Web。

历史收入导入通过 `expo-document-picker` 选择 UTF-8 CSV，并严格经过预览与确认两阶段。收入形态与 coverage 使用 typed 后端权威响应，并包含明确的重试和确认状态。完整接口规则见 [`../docs/API_CONTRACT.cn.md`](../docs/API_CONTRACT.cn.md)。收据 OCR 与 Epic 5 页面目前仍是原型行为。

## Expo SDK 57 期间本地怎么跑 e2e

Metro 开发包会弹出挡住点击的 React ARIA 警告，所以用生产导出来跑：

1. 导出（PowerShell）：`$env:EXPO_PUBLIC_E2E='1'; $env:EXPO_PUBLIC_PLAYWRIGHT_API_URL='http://localhost:8004/api/v1'; $env:EXPO_NO_DOTENV='1'; $env:CI='1'; npx expo export --platform web --output-dir dist --clear`（API 端口要和下面的 `PLAYWRIGHT_BACKEND_PORT` 一致）。
2. 运行：`$env:PLAYWRIGHT_BACKEND_PORT='8004'; $env:PLAYWRIGHT_FRONTEND_PORT='8085'; $env:PLAYWRIGHT_STATIC_DIR='dist'; npm run test:e2e:static -- e2e/epic5-upfront-fees.spec.ts`。`playwright.static.config.ts` 复用 `playwright.config.ts` 的后端服务，并用 `http.server` 托管导出目录。默认端口 8000/8081，目录 `dist`。
3. 可选开关：`PLAYWRIGHT_REUSE=1` 复用已按配置命令手动起好的前后端（连跑不用重启）；`PLAYWRIGHT_TRACE=1` 本地保留失败 trace（默认关，CI 始终开）；`PLAYWRIGHT_SKIP_PRICE_MODEL=1` 数据库里已有生效价格模型时跳过 `load_price_model`；`PLAYWRIGHT_WORKERS=N` 设置并行数（默认 1，每个 worker 需要独立数据库/端口）。
4. 数据库：`PLAYWRIGHT_BACKEND_PORT` 不是 8000 时，后端使用自己的 `backend/db-e2e-<port>.sqlite3`，不同端口的并行运行互不共用数据库。
