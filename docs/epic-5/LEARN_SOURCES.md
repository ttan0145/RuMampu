# Epic 5 Learn：内容来源与更正（2026-10-08）

本轮逐项查阅政府、法定机构与方案发布者的官方页面。表中的日期是内容核对日期，不是法规生效日期。来源在每篇说明的最后一页直接显示并可打开。SJKP 机构目录和材料页通过官方网页直接 GET 验证返回 HTTP 200；云盘原型中的未核对草稿不再作为正式内容。

| 来源 | 官方页面 | 核对日期 |
| --- | --- | --- |
| SJKP: MADANI | [页面](https://www.sjkp.com.my/en/hcgs/hcgs-madani) | 8 October 2026 |
| SJKP: HCGS | [页面](https://www.sjkp.com.my/en/hcgs/scheme-features) | 8 October 2026 |
| SJKP: Eligibility | [页面](https://www.sjkp.com.my/en/hcgs/eligibility) | 8 October 2026 |
| SJKP: Documents to FIs | [页面](https://www.sjkp.com.my/en/hcgs/documents-to-fis) | 8 October 2026 |
| Malaysian Bar: SRO 2023 | [页面](https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20258-2023.pdf) | 8 October 2026 |
| LHDN: Stamp Act 1949 | [页面](https://www.hasil.gov.my/media/hwdf2s3g/20240101-stamp-act-1949-act-378.pdf) | 10 September 2026 |
| Malaysian Bar: First-home exemption | [页面](https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20128-2026.pdf) | 8 October 2026 |
| BNM: CCRIS FAQ | [页面](https://www.bnm.gov.my/faq/ccris) | 8 October 2026 |
| KPKT: Homebuyer FAQ | [页面](https://ehome.kpkt.gov.my/index.php/pages/view/220) | 8 October 2026 |
| JPPH: Valuation FAQ | [页面](https://www.jpph.gov.my/v3/?page_id=8647&lang=en) | 8 October 2026 |
| PR1MA: Eligibility | [页面](https://www.pr1ma.my/eligibility-home) | 8 October 2026 |
| PR1MA: FAQ | [页面](https://www.pr1ma.my/faq) | 8 October 2026 |
| MyGovernment: RMR | [页面](https://www.malaysia.gov.my/en/categories/aid-welfare-and-assistance/housing-aid/rumah-mesra-rakyat-rmr-programme) | 8 October 2026 |

| 说明 | 使用的来源 |
| --- | --- |
| How SJKP helps if you don’t have a payslip | SJKP: MADANI, SJKP: HCGS, SJKP: Eligibility |
| What to bring instead of a payslip | SJKP: Documents to FIs |
| What the RM360,000 limit reaches | SJKP: MADANI |
| The three times you’ll need cash | KPKT: Homebuyer FAQ, Malaysian Bar: SRO 2023 |
| The deposit, and why it can end up higher | SJKP: HCGS |
| Legal fees, stamp duty and valuation | Malaysian Bar: SRO 2023, LHDN: Stamp Act 1949 |
| The first-home stamp duty exemption | Malaysian Bar: First-home exemption |
| Moving-in costs nobody mentions | KPKT: Homebuyer FAQ |
| What a bank looks at before saying yes | SJKP: Eligibility |
| DSR, and why banks work it out differently | SJKP: Eligibility |
| Your credit record: CCRIS | BNM: CCRIS FAQ |
| An empty credit record is not an approval | BNM: CCRIS FAQ |
| Which government schemes exist | PR1MA: Eligibility, MyGovernment: RMR |
| Qualifying doesn’t guarantee a unit | PR1MA: Eligibility |
| Check the resale conditions for the scheme | PR1MA: FAQ |
| The SPA, step by step | KPKT: Homebuyer FAQ |
| A lower valuation: a cash scenario | JPPH: Valuation FAQ；个人金额另标 ASSUMPTION |
| Dates that cost money if you miss them | Malaysian Bar: First-home exemption |
| Checking for defects before the window closes | KPKT: Homebuyer FAQ |

本轮内容更正：

- 开发商的新房受监管交易不能在 SPA 签署前收款；删除了把 booking fee 当作所有购房交易必经步骤的说法。
- SJKP 的文件页列出银行流水、税务/EPF 记录及经确认的收入声明；平台收入和现有承诺明确作为整理自己记录的辅助材料，不声称它们一律被接受。
- CCRIS 属于 BNM，报告本身不是黑名单或信用评级；删除了“空记录会不利于申请”的无依据结论，学习内容只解释记录与决策的区别。
- PR1MA 的 moratorium FAQ 要求联系方案方确认；本轮不提供未经核对的固定禁售年限。
- SJKP MADANI 与标准 SJKP 分别引用各自的上限，并明确符合条件不代表审批。参与机构链接直达 `/en/fi-partners`。
- Documents & financing 的三条条件也与 SJKP 现行官方页对齐：18 岁或以上、全部月还款不超过税前月收入的 65%、供本人居住的首套房；继续显示需要复核，不给审批结论。
- 个人房屋的额外现金/费用属于本应用的场景算术。假设估价低 5% 的例子明确标为 ASSUMPTION；不把它说成银行的估价或决定。
- 估价说明改为明确的现金场景，删除“贷款必然跟随估价”的标题与导语；来源改为 JPPH 关于公众从私人估价师获取市值估计的 FAQ，不再引用无关的 CCRIS 页面。

LHDN 的印花税标准保留原核对日期 2026-09-10，本轮没有把未完整复查的费率标成新核对。公开来源以后变化时，应同时更新正文、最后核对日期与对应验收固定值。

## How buying works 与月供检查的来源（2026-10-09，AC5.10.9、AC5.11.4）

登记在 `frontend/src/rumampu/buying-facts.ts`，界面在每个时间点或比例下面直接显示状态、来源和核对日期。“惯例”指合同条款或行业做法，不是法律规定；“未经核实”指原文没有打开，界面不写核对日期。没有一条标为官方来源。

| 条目 | 状态 | 来源 | 核对日期 |
| --- | --- | --- | --- |
| 定金通常 2–3%（Book the home） | 惯例 | Agent and lawyer guides (iProperty, DNH, HBA) | 9 October 2026 |
| 约 14 天内签 SPA | 未经核实（10/09 找不到任何可打开的来源；界面只写"以出价函为准"） | 无 | — |
| 3 到 4 个月后完成（常见为 3 个月加 1 个月计息） | 惯例 | HBA: Understanding an SPA, Part 1 (2006) | 9 October 2026 |
| 银行付清后约一个月开始供款 | 未经核实（由银行决定） | 无 | — |
| 新盘各阶段比例与建设周期 | 未经核实（宪报原文未打开；二手来源与代码的 12 个阶段逐项一致） | Housing Development (Control and Licensing) Regulations 1989, Schedule H（hba.org.my 收录的 1989 年原文；2015 年修订本未取得） | 二手来源 9 October 2026 |
| 贷款到 70 岁、最长 35 年 | 惯例（CIMB、RHB Islamic、Bank Islam 官网逐字写明，界面写 "Banks commonly"；"大多数银行"仍无证据） | CIMB: Home loan（界面链接）；RHB Islamic、Bank Islam 登记在 buying-facts.ts | 9 October 2026 |

没有做的：Schedule G/H 2015 年修订本原文、建筑师局通告 GC 2/2017、其他银行的年龄条款。调研过程见本地审查目录 `RuMampu_全面审查_2026-10-09/15-购房时间线来源调研.md`（不在仓库内）。
