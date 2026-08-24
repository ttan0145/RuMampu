# RuMampu 前端

Expo + React Native + TypeScript 客户端，支持 English、Bahasa Melayu 和中文。页面来自早期设计原型，但项目已经开始逐领域接入正式 Django API。

## 启动

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

`EXPO_PUBLIC_API_URL` 应指向版本化 API，例如：

```text
http://localhost:8000/api/v1
```

Expo Web 与 Django 应使用相同主机名，以便 `credentials: include` 能正确保存访客 session Cookie。若未设置 API URL，客户端进入仅用于演示的内存原型模式。

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
- 金额响应为小数字符串，进入计算前显式转换为 `Number`。
- 保存请求进行中必须禁用重复提交；API 幂等协议尚未实现。
- 提交前运行 `npm run typecheck`。

历史收入导入通过 `expo-document-picker` 选择 UTF-8 CSV，并严格经过预览与确认两阶段。完整接口规则见 [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md)。收据 OCR、部分计算和 Epic 5 页面目前仍是原型行为。
