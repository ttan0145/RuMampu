# Iteration 2 安全、风险与隐私计划：Groq 读取补充

更新：2026-10-08。本文件是正式 Iteration 2 安全计划的代码库同步补充，覆盖 US1.9 与共用图片读取服务；原计划中的其他风险、责任和行动继续有效。它与下面的原文共同构成这次的计划更新，未覆盖 Drive 原件。

## 已有计划与本次修订

- [Iteration 2 Security Plan v2](https://docs.google.com/document/d/1pN0kP7t_gWG6oKTS_wYgm5KEQWlBCogQ/edit) 的 8.1、8.2、数据流及 AI 控制已经记录 Groq、留存地点和保留例外，原计划并非只有 Iteration 1。
- [Iteration 3 Security Plan](https://docs.google.com/document/d/1S_GFSsNqYAKLCWz9ujdxl1jKqjCZyAT4/edit) 继续记录相同服务，并记载 2026-10-08 账户检查时 Global ZDR、Inference APIs ZDR 均关闭。本次核查读取了该记录，没有代操作 Groq 控制台或更改设置。
- v7 修订曾提到 Finory；用户于 2026-10-08 明确当前方案使用 Groq。本次按实际 Groq 实现验收，不把取得 Finory 契约作为前提，也不把服务商名字变化解释为扩大读取范围。

## 处理方、传输地点与保留期

| 事项 | 当前计划记录 |
|---|---|
| 外部处理方 | GroqCloud，由 Django 后端用服务端 `GROQ_API_KEY` 调用 chat completions；收入图片与 Epic 6 收据共用 `receipt_service.py`。 |
| 传输与处理地点 | 文件从设备送到 RuMampu 后端，再送 Groq。Groq 的 DPA 8.1 允许在美国及其或分处理商运营的其他国家处理；没有核实某次推理只发生在一个地区。Groq 声明留存的客户数据位于美国 GCP。 |
| 提供方保留 | 普通推理输入／输出默认不保留；排错或疑似滥用调查可暂存至多 30 天，法律要求可能更久。不宣称本项目开启零数据保留。使用量元数据另行保留，不包含输入／输出。 |
| RuMampu 原图与草稿 | 本路径以 JSON base64 请求和内存草稿处理图片，不创建原图文件、图片数据库字段或永久草稿记录。取消或尚未确认的扫描不产生财务交易。设备原有照片不由 RuMampu 删除。 |
| 确认后的记录 | 保存用户确认的日期、金额和收入来源，按账户／访客记录生命周期处理；与原始图片和供应商日志是不同保留边界。 |

提供方依据：[Groq 数据处理说明](https://console.groq.com/docs/your-data)、[Groq DPA](https://console.groq.com/docs/legal/customer-data-processing-addendum)，2026-10-08 查阅。公开政策说明与账户设置记录各有来源，未将默认行为写成绝对不留存，也未将美国留存位置写成美国独占处理。

## 本功能控制与风险

1. 上传前展示 Groq、发送内容、地点和保留说明，并允许取消后改用手动输入。接受读取不等于确认保存交易；用户在接受后选图和发送时已发生外部披露。
2. 银行入账／收益截图可以包含姓名、账号或其他行。界面应提示先裁掉不需要的信息；不得要求银行登录、PIN 或验证码。图片只作收入入账识别，单次最多 20 条收入草稿；收据为另一条单笔支出草稿路径。
3. 模型不是贷款决策方。服务层和 API 只输出允许的交易字段及不确定性标识；可负担性、信誉、资格等附加模型字段不传入财务记录或展示。没有从截图自动推导银行批准结论。
4. 缺少或不确定日期、金额必须在核对界面可见且可修改。勾选与确认之前不写入收入；失败、无法识别、缺配置或不可用时显示原因并提供键入入口。
5. 后端凭证不交给客户端；生产调用使用 SDK 的 HTTPS 端点。验收使用合成图片与受控模型返回值，不上传真实财务资料，不把通过行为测试等同于真实账单识别准确率认证。

已有控制的代码证据：[服务](../../backend/finance/receipt_service.py)、[扫描 API](../../backend/finance/views.py)、[核对页面](../../frontend/src/rumampu/screens/money.tsx)、[统一披露](../../frontend/src/rumampu/state.tsx)、[三语言说明](../../frontend/src/rumampu/strings.ts)。行为结果与最终版本见 [联合验收](../testing/EPIC_1_2_5_JOINT_ACCEPTANCE_2026-10-08.cn.md)，不能只用文件存在或 AC 编号证明完成。

原安全计划中关于生产配置、ZDR、账户安全、备份和其他 Epic 的行动仍按原计划跟进；本补充不将它们宣称全部修复，也不擅改生产设置。
