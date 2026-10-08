# Iteration 2 数据管理计划：Groq 读取补充

更新：2026-10-08。本文件是正式 Iteration 2 数据管理计划的代码库同步补充，补齐 US1.9 所需的处理方、传输地点、保留期与确认边界。与原计划共同使用，其他数据集、公式和治理规则保留原文；未覆盖 Drive 原件。

## 正式资料与修订原因

[Iteration 2 Data Management Plan v5](https://docs.google.com/document/d/139zwkIkl7m5Q2fUEp84aG4FScjW4zlC8/edit) 已记录收入页和收据图片读取、草稿确认及不保存原图，但将外部提供方条款列为待评估。[Iteration 3 Data Management Plan v1](https://docs.google.com/document/d/1gBXG_RU4FF8mtCcdjKWIADUB4RZ83gNL/edit) 已明确 Groq 及这些数据流，仍未给出具体推理保留期限。本次补入查证的提供方事实，撤回先前“只有 Iteration 1 计划”的判断。

用户于 2026-10-08 明确以 Groq 作为当前图片读取方案，替代 v7 历史修订中的 Finory 服务商表述；US1.9 五条 AC 的上传披露、交易输出、确认保存、计划记录与失败退路保持有效。

## 处理方、传输地点与保留期

| 数据阶段 | 处理、地点与保留 |
|---|---|
| 设备输入 | 用户自选银行收入／收益图片或收据图片。图片可能包含交易外的个人信息，上传前告知整张选定图片会发送，并提示先裁剪。手动和 CSV 录入仍可使用。 |
| RuMampu 请求 | 前端图片经 JSON base64 传给 Django。服务用 GroqCloud chat completions 提取草稿；这条路径不创建原图的持久副本。CSV 由 Django 解析，不通过这个模型接口发送。 |
| Groq 处理与传输 | Groq 是处理方。DPA 8.1 允许在美国及 Groq／分处理商运营的其他国家处理；若保留客户数据，地点为美国 GCP。未声称每次推理地区固定。 |
| Groq 保留 | 普通推理输入／输出默认不保留，排错或疑似滥用调查可保留至多 30 天，法律要求可能更久；不包含输入／输出的使用量元数据另行保留。正式安全计划记载 ZDR 关闭，因此不承诺零保留。 |
| 未确认提取 | 收入日期、金额、不确定性与选择状态仅作当前界面的草稿；退出／取消不写入收入事实。识别或取得草稿已经发生外部传输，保存确认不会撤回这次传输。 |
| 确认交易 | 只保存用户确认的交易字段和选定来源。属于其账户／访客档案，可以编辑、导出和删除；按下述记录生命周期保留。不会保存银行资格、信誉或可负担性评估。 |

提供方依据：[Groq 数据处理说明](https://console.groq.com/docs/your-data)、[Groq DPA](https://console.groq.com/docs/legal/customer-data-processing-addendum)，2026-10-08 查阅。与 [安全计划补充](ITERATION_2_SECURITY_RISK_PRIVACY_PLAN.cn.md) 使用同一处理方与保留口径。

## 数据范围和质量

- 收入扫描支持银行收入入账／平台收益的照片或截图，返回最多 20 条收入草稿；不是整份流水的所有收支自动分类或 PDF 解析承诺。Epic 6 的收据扫描返回另一种单笔支出草稿。
- 模型输出通过服务层及 API 的字段白名单。日期、金额和不确定性用于核对，不引入贷款方对资格、信誉或可负担性的输出。
- 用户可以修正草稿、取消选择、指定来源；只有确认的有效条目进入财务记录。缺日期或无法读取必须可见并允许键入，不用沉默或未经提示的默认值替代用户事实。
- 接口限制文件编码、图片类型和请求大小；有服务端扫描限流。读取失败、无收入或服务不可用时不新增财务数据，并给出手动录入退路。
- 本轮行为验收使用合成资料及受控响应。真实银行版式与识别准确率仍需在获准使用资料时评估；此限制不等同于缺少已有扫描链路。

## 记录、删除和副本边界

当前代码已实现档案使用时间更新与 `process_record_retention`：访客六个月不活跃删除；账户五个月提醒，六个月时只删除已记载提醒送达的账户。正常使用更新活动时间；用户也可主动删除。命令实际调度与生产执行情况属于运营证据，本次 Git 验收未代执行生产删除。

删除主记录不等于供应商日志或备份立刻消失。Iteration 3 数据计划记载美国 Backblaze B2 每日及迁移前数据库备份约 28 天的生命周期；它们保存数据库内容，不包含这条读取路径未持久化的原始图片。本补充引用该运营记录，不声称本轮亲自验证备份桶设置。供应商侧临时日志另按上述 Groq 策略处理。

代码依据：[扫描服务](../../backend/finance/receipt_service.py)、[接口与确认端点](../../backend/finance/views.py)、[输入校验](../../backend/finance/serializers.py)、[核对界面](../../frontend/src/rumampu/screens/money.tsx)、[活动与保留命令](../../backend/finance/management/commands/process_record_retention.py)。最终逐 AC 行为证据见 [联合验收](../testing/EPIC_1_2_5_JOINT_ACCEPTANCE_2026-10-08.cn.md)。
