/* v26/v27b What buying involves: five topics of short, illustrated lessons.
   Ported from the prototype (rumampu27b3, merged from the team's learn mockup
   of 29 Sep 2026). Each lesson is a list of pages, one idea per page.
   [[Term|definition]] marks a term that opens its explanation in place
   (US5.5.7). Lessons are in English for now (ln_en_only). */

export type LnBlock =
  | { p: string }
  | { ul: string[] }
  | { steps: string[]; start?: number }
  | { mine: string }
  | { note: string }
  | { ext: { label: string; href: string } }
  | { go: { label: string; to: string } }
  | { jump: { label: string; a: string } };

export interface LnArticle { id: string; title: string; lead: string; src?: string[]; draft?: boolean; pages: LnBlock[][] }
export interface LnSection { id: string; tab: string; title: string; epf?: boolean; articles: LnArticle[] }

export const LN_SRC: Record<string, { n: string; h: string; d: string }> = {
  "madani": {
    "n": "Syarikat Jaminan Kredit Perumahan, HCGS-MADANI and HCGS scheme features",
    "h": "https://www.sjkp.com.my/en/hcgs/hcgs-madani",
    "d": "29 September 2026"
  },
  "elig": {
    "n": "Syarikat Jaminan Kredit Perumahan, HCGS eligibility",
    "h": "https://www.sjkp.com.my/en/hcgs/eligibility",
    "d": "29 September 2026"
  },
  "sro": {
    "n": "Solicitors’ Remuneration Order 2023, P.U. (A) 207/2023, as set out by the Malaysian Bar",
    "h": "https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20258-2023.pdf",
    "d": "29 September 2026"
  },
  "stamp": {
    "n": "Stamp Act 1949 (Act 378), First Schedule items 32(a) and 27(a), Attorney General’s Chambers of Malaysia",
    "h": "https://lom.agc.gov.my",
    "d": "10 September 2026"
  },
  "exempt": {
    "n": "Malaysian Bar Circular No 128/2026 (16 April 2026), on P.U. (A) 53/2021 and 54/2021 as amended by P.U. (A) 448/2025 and 449/2025",
    "h": "https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20128-2026.pdf",
    "d": "29 September 2026"
  },
  "ccris": {
    "n": "Bank Negara Malaysia, Central Credit Reference Information System",
    "h": "https://www.bnm.gov.my/ccris",
    "d": "29 September 2026"
  }
};

export const LEARN: LnSection[] = [
  {
    "id": "nosalary",
    "tab": "No payslip",
    "title": "If you don’t earn a fixed salary",
    "articles": [
      {
        "id": "sjkp",
        "title": "How SJKP helps if you don’t have a payslip",
        "lead": "A loan guarantee for people without a fixed salary.",
        "src": [
          "madani",
          "elig"
        ],
        "pages": [
          [
            {
              "p": "Banks usually ask for payslips to prove income. [[SJKP|Syarikat Jaminan Kredit Perumahan. It guarantees home loans, so a bank can lend to people it might otherwise turn down.]] accepts applicants with non-fixed income and people who are self-employed, such as e-hailing drivers and freelancers."
            }
          ],
          [
            {
              "p": "SJKP doesn’t lend you money itself. You apply at a bank or financial institution that takes part in the scheme, and that institution decides whether to approve you."
            }
          ],
          [
            {
              "p": "Under SJKP MADANI, the guarantee can cover up to 120% of the purchase price: the price itself, plus costs such as [[MRTT|Mortgage Reducing Term Takaful. It pays off what is left of your loan if you die or become permanently unable to work, and the amount it covers shrinks as your loan does.]], legal fees, valuation, renovation and furnishing."
            },
            {
              "p": "The most it covers is RM360,000. The standard SJKP scheme covers financing of up to RM500,000."
            }
          ],
          [
            {
              "mine": "sjkp120"
            }
          ],
          [
            {
              "p": "Borrowing more than the price means a larger repayment, for longer."
            },
            {
              "ext": {
                "label": "SJKP’s participating institutions",
                "href": "https://www.sjkp.com.my"
              }
            }
          ]
        ]
      },
      {
        "id": "docs",
        "title": "What to bring instead of a payslip",
        "lead": "Records that show income a payslip would.",
        "draft": true,
        "pages": [
          [
            {
              "p": "A bank needs to see that money comes in steadily enough to repay a loan. Without a payslip, other records can show it."
            }
          ],
          [
            {
              "ul": [
                "Bank statements showing your earnings arriving",
                "An earnings summary from the platform you work through",
                "A statutory declaration of your income",
                "Your EPF statement, if you have one",
                "A list of what you already pay each month"
              ]
            }
          ],
          [
            {
              "p": "A longer record gives a clearer picture than one good month. Slow months belong in it too."
            },
            {
              "go": {
                "label": "Open your document checklist",
                "to": "docs"
              }
            }
          ]
        ]
      },
      {
        "id": "limit",
        "title": "What the RM360,000 limit reaches",
        "lead": "The same limit goes further in some places.",
        "src": [
          "madani"
        ],
        "pages": [
          [
            {
              "p": "SJKP MADANI covers up to RM360,000. How far that goes depends on where you want to live."
            }
          ],
          [
            {
              "p": "In some districts, the typical home costs more than the limit. In others, many homes sell for less. Seeing what homes actually sold for near you shows which areas it can reach."
            },
            {
              "go": {
                "label": "See what homes cost here",
                "to": "famhome"
              }
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "upfront",
    "tab": "Upfront",
    "title": "The money you’ll need upfront",
    "epf": true,
    "articles": [
      {
        "id": "moments",
        "title": "The three times you’ll need cash",
        "lead": "The money isn’t all due at once.",
        "pages": [
          [
            {
              "steps": [
                "To sign: the deposit. Part of it may already be paid as an [[earnest deposit|A first payment made when you book the home. It counts toward your deposit, not on top of it.]].",
                "To complete: legal fees, stamp duty and the valuation fee.",
                "To move in: deposits to connect the utilities and, for an apartment, toward the building’s upkeep."
              ]
            }
          ],
          [
            {
              "p": "Knowing which moment a cost belongs to tells you when you need the money, as well as how much."
            },
            {
              "go": {
                "label": "Open Upfront cash",
                "to": "upfront"
              }
            }
          ]
        ]
      },
      {
        "id": "deposit",
        "title": "The deposit, and why it can end up higher",
        "lead": "It covers whatever the bank won’t lend.",
        "pages": [
          [
            {
              "p": "The deposit is the part of the price your loan doesn’t cover. RuMampu lets you test any deposit, including RM0."
            }
          ],
          [
            {
              "p": "A bank lends against its own [[valuation|An estimate of the home’s value, made by a registered valuer the bank appoints. It can differ from the price you agreed.]], which can differ from the price you agreed. If the valuation comes in lower, the loan shrinks and the difference comes out of your cash."
            }
          ],
          [
            {
              "mine": "deposit"
            }
          ],
          [
            {
              "note": "The valuation often arrives late in the process, after the price has been agreed."
            }
          ]
        ]
      },
      {
        "id": "fees",
        "title": "Legal fees, stamp duty and valuation",
        "lead": "Three costs set by published scales.",
        "src": [
          "sro",
          "stamp"
        ],
        "pages": [
          [
            {
              "p": "Legal fees are set by law. The lawyer handling the purchase charges 1.25% of the first RM500,000 of the price, with a minimum of RM500. The lawyer preparing the loan charges on the same scale, on the loan amount."
            },
            {
              "p": "Buying from a developer can cost less, because a lower scale applies to those sales."
            }
          ],
          [
            {
              "p": "[[Stamp duty|A government tax on the documents that transfer the home to you and secure the loan.]] on the transfer is 1% of the first RM100,000 of the price and 2% of the next RM400,000. On the loan agreement it is 0.5% of the loan."
            }
          ],
          [
            {
              "p": "The valuation fee follows a scale set by the Board of Valuers. RuMampu marks its figure for it as an assumption, because the published copy of that scale could not be fully checked."
            }
          ],
          [
            {
              "mine": "legal"
            },
            {
              "jump": {
                "label": "The first-home stamp duty exemption",
                "a": "exemption"
              }
            }
          ]
        ]
      },
      {
        "id": "exemption",
        "title": "The first-home stamp duty exemption",
        "lead": "Stamp duty can be waived on a first home.",
        "src": [
          "exempt"
        ],
        "pages": [
          [
            {
              "p": "If you are a Malaysian citizen who has never owned a home, including one you inherited or were given, and the home costs RM500,000 or less, you pay no stamp duty on the transfer or on the loan agreement."
            }
          ],
          [
            {
              "p": "It applies to sale and purchase agreements signed between 1 January 2021 and 31 December 2027."
            }
          ],
          [
            {
              "p": "In Upfront cash the exemption is a switch you control, because only you know whether this is your first home."
            }
          ],
          [
            {
              "mine": "exempt"
            }
          ]
        ]
      },
      {
        "id": "movein",
        "title": "Moving-in costs nobody mentions",
        "lead": "The costs that arrive with the keys.",
        "pages": [
          [
            {
              "ul": [
                "Deposits to connect electricity and water",
                "For an apartment, a deposit toward the building’s upkeep",
                "Basic furniture and appliances",
                "Movers, or a van for the day"
              ]
            }
          ],
          [
            {
              "p": "None of these follow a published scale, so Upfront cash asks for your own figures instead of guessing them."
            },
            {
              "go": {
                "label": "Open Upfront cash",
                "to": "upfront"
              }
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "loan",
    "tab": "Loan",
    "title": "Getting ready for a loan",
    "articles": [
      {
        "id": "bank",
        "title": "What a bank looks at before saying yes",
        "lead": "Three things it will ask about.",
        "draft": true,
        "pages": [
          [
            {
              "ul": [
                "Your income, and whether it is steady enough to cover the repayments",
                "What you already pay toward other borrowing each month",
                "Your record of repaying past borrowing"
              ]
            }
          ],
          [
            {
              "p": "With irregular income, the first is the hardest to show. That is why records carry more weight for you than for someone paid a salary."
            }
          ]
        ]
      },
      {
        "id": "dsr",
        "title": "DSR, and why banks work it out differently",
        "lead": "How a bank decides whether it may lend.",
        "src": [
          "elig"
        ],
        "pages": [
          [
            {
              "p": "[[DSR|Debt service ratio: your monthly debt repayments, including the new home loan, as a share of your monthly income.]] tells a bank how much of your income would go to repayments."
            }
          ],
          [
            {
              "p": "Banks work DSR out in their own ways, so the same person can look different to two lenders. One published example: SJKP’s condition is that all your loan repayments together stay within 65% of your gross monthly income."
            }
          ],
          [
            {
              "p": "DSR says whether a bank may lend. It doesn’t say whether the repayment will be comfortable in your slower months. That is the question the house test answers."
            }
          ]
        ]
      },
      {
        "id": "credit",
        "title": "Your credit record: CCRIS and CTOS",
        "lead": "What a bank can see about past borrowing.",
        "src": [
          "ccris"
        ],
        "pages": [
          [
            {
              "p": "[[CCRIS|The Central Credit Reference Information System, owned and run by Bank Negara Malaysia. It lists the financing you hold and how you have repaid it.]] shows your borrowing and repayments over the past 12 months. You can check your own report free of charge through eCCRIS."
            }
          ],
          [
            {
              "p": "[[CTOS|A credit reporting agency approved in Malaysia. It keeps its own record, separate from CCRIS.]] is one of the agencies some lenders check as well."
            }
          ]
        ]
      },
      {
        "id": "thin",
        "title": "No borrowing history isn’t a clean record",
        "lead": "An empty record can count against you.",
        "draft": true,
        "pages": [
          [
            {
              "p": "Never having had a loan or a credit card can feel like a good sign. To a bank it can mean there is nothing to judge you on."
            }
          ],
          [
            {
              "p": "If your record is empty, expect the bank to rely more heavily on your income records, which makes a complete record of your earnings worth more."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "schemes",
    "tab": "Schemes",
    "title": "Schemes you might qualify for",
    "articles": [
      {
        "id": "which",
        "title": "Which government schemes exist",
        "lead": "Each is meant for a different group.",
        "draft": true,
        "pages": [
          [
            {
              "ul": [
                "PPR, the People’s Housing Programme, for lower-income households",
                "Rumah Mesra Rakyat, for building a home on land you already own",
                "PR1MA, for middle-income households in towns and cities",
                "Residensi Wilayah, for people who live or work in the Federal Territories",
                "State schemes such as Rumah Selangorku, run by each state for its own residents"
              ]
            }
          ],
          [
            {
              "p": "Each sets its own income range and conditions, and they change. Check the scheme’s own site before you apply."
            }
          ]
        ]
      },
      {
        "id": "ballot",
        "title": "Qualifying doesn’t guarantee a unit",
        "lead": "Popular projects are allocated by ballot.",
        "draft": true,
        "pages": [
          [
            {
              "p": "When more people apply than there are homes, units are often allocated by ballot. Meeting the conditions puts you in the draw. It doesn’t reserve a home."
            }
          ],
          [
            {
              "p": "Some people apply to more than one project, where each scheme’s rules allow it."
            }
          ]
        ]
      },
      {
        "id": "resale",
        "title": "Why you may not be able to sell for years",
        "lead": "Affordable homes often carry a waiting period.",
        "draft": true,
        "pages": [
          [
            {
              "p": "Many schemes restrict selling or renting out the home for a set number of years after you buy. The period differs by scheme and is written into your agreement."
            }
          ],
          [
            {
              "p": "If you might need to move for work, check it before you commit."
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "signing",
    "tab": "Signing",
    "title": "Signing and moving in",
    "articles": [
      {
        "id": "spa",
        "title": "The SPA, step by step",
        "lead": "The order things usually happen in.",
        "draft": true,
        "pages": [
          [
            {
              "steps": [
                "Book the home and pay the booking fee or earnest deposit.",
                "Sign the [[SPA|Sale and purchase agreement: the contract between you and the seller that sets the price, the deposit and the dates.]] and pay the rest of the deposit.",
                "Sign the loan agreement with your bank."
              ]
            }
          ],
          [
            {
              "steps": [
                "The [[MOT|Memorandum of transfer: the document that moves ownership of the home into your name at the land office.]] is registered, and stamp duty is paid.",
                "Collect the keys."
              ],
              "start": 4
            }
          ],
          [
            {
              "p": "Buying from a developer follows a standard agreement set by law. Buying a home someone already owns follows an agreement the lawyers prepare."
            }
          ]
        ]
      },
      {
        "id": "valuation",
        "title": "Why the bank’s valuation matters more than your price",
        "lead": "The loan follows the valuation.",
        "pages": [
          [
            {
              "p": "If the valuer puts the home below the price you agreed, the bank lends less, and the gap comes out of your own cash."
            }
          ],
          [
            {
              "mine": "valuation"
            }
          ]
        ]
      },
      {
        "id": "deadlines",
        "title": "Dates that cost money if you miss them",
        "lead": "Worth noting as soon as you sign.",
        "draft": true,
        "pages": [
          [
            {
              "ul": [
                "The stamp duty exemption applies only to agreements signed by 31 December 2027.",
                "Defects in a new home must be reported within the period your agreement states.",
                "Your agreement sets dates for paying the rest of the price, and missing them can bring late charges."
              ]
            }
          ]
        ]
      },
      {
        "id": "defects",
        "title": "Checking for defects before the window closes",
        "lead": "The developer repairs what you report in time.",
        "draft": true,
        "pages": [
          [
            {
              "p": "A new home comes with a [[defect liability period|The time after you get the keys during which the developer must repair defects you report. Your agreement states how long it lasts.]]."
            }
          ],
          [
            {
              "p": "Walk through the home soon after you get the keys, and note cracks, leaks, doors that won’t close and fittings that don’t work. Report them in writing and keep a copy."
            }
          ],
          [
            {
              "p": "Once the period ends, repairs are yours to pay for."
            }
          ]
        ]
      }
    ]
  }
];

export const LN_META: Record<string, { bg: string; ic: string }> = {
  "nosalary": {
    "bg": "#E3F3F1",
    "ic": "file"
  },
  "upfront": {
    "bg": "#FFF4D6",
    "ic": "wallet"
  },
  "loan": {
    "bg": "#E6EEF8",
    "ic": "banknote"
  },
  "schemes": {
    "bg": "#F1ECFA",
    "ic": "search"
  },
  "signing": {
    "bg": "#FCE9E2",
    "ic": "house"
  }
};

/* each lesson's small picture when it has no photo: an icon name or SVG path markup */
export const LN_SPOT: Record<string, string> = {
  "sjkp": "<path d=\"M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z\"/><path d=\"m9.3 11.8 2 2 3.4-4\"/>",
  "docs": "file",
  "limit": "gauge",
  "moments": "calendar",
  "deposit": "wallet",
  "fees": "receipt",
  "exemption": "<path d=\"M3.5 12.5V4.5h8l9 9-8 8z\"/><circle cx=\"8\" cy=\"9\" r=\"1.5\"/>",
  "movein": "<path d=\"M4 8l8-4 8 4v9l-8 4-8-4z\"/><path d=\"M4 8l8 4 8-4M12 12v9\"/>",
  "bank": "columns",
  "dsr": "bars",
  "credit": "eye",
  "thin": "person",
  "which": "house",
  "ballot": "<rect x=\"4\" y=\"10\" width=\"16\" height=\"10\" rx=\"2\"/><path d=\"M8 10V5h8v5M10 7.5h4\"/>",
  "resale": "<rect x=\"5\" y=\"10.5\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 10.5V7.5a4 4 0 0 1 8 0v3\"/>",
  "spa": "<path d=\"M4 20l1-4L16 5l3 3L8 19z\"/><path d=\"M14 7l3 3\"/>",
  "valuation": "search",
  "deadlines": "calday",
  "defects": "wrench"
};

/* step pictures, keyed lesson_page; "mine" is shared by the pages that show a figure for your home */
/* eslint-disable @typescript-eslint/no-require-imports */
export const LN_PIC: Record<string, number> = {
  "ballot_1": require('../../assets/learn/ballot_1.webp'),
  "ballot_2": require('../../assets/learn/ballot_2.webp'),
  "bank_1": require('../../assets/learn/bank_1.webp'),
  "bank_2": require('../../assets/learn/bank_2.webp'),
  "credit_1": require('../../assets/learn/credit_1.webp'),
  "credit_2": require('../../assets/learn/credit_2.webp'),
  "deadlines_1": require('../../assets/learn/deadlines_1.webp'),
  "defects_1": require('../../assets/learn/defects_1.webp'),
  "defects_2": require('../../assets/learn/defects_2.webp'),
  "defects_3": require('../../assets/learn/defects_3.webp'),
  "deposit_1": require('../../assets/learn/deposit_1.webp'),
  "deposit_2": require('../../assets/learn/deposit_2.webp'),
  "deposit_4": require('../../assets/learn/deposit_4.webp'),
  "docs_1": require('../../assets/learn/docs_1.webp'),
  "docs_2": require('../../assets/learn/docs_2.webp'),
  "docs_3": require('../../assets/learn/docs_3.webp'),
  "dsr_1": require('../../assets/learn/dsr_1.webp'),
  "dsr_2": require('../../assets/learn/dsr_2.webp'),
  "dsr_3": require('../../assets/learn/dsr_3.webp'),
  "exemption_1": require('../../assets/learn/exemption_1.webp'),
  "exemption_2": require('../../assets/learn/exemption_2.webp'),
  "exemption_3": require('../../assets/learn/exemption_3.webp'),
  "fees_1": require('../../assets/learn/fees_1.webp'),
  "fees_2": require('../../assets/learn/fees_2.webp'),
  "fees_3": require('../../assets/learn/fees_3.webp'),
  "limit_1": require('../../assets/learn/limit_1.webp'),
  "limit_2": require('../../assets/learn/limit_2.webp'),
  "mine": require('../../assets/learn/mine.webp'),
  "moments_1": require('../../assets/learn/moments_1.webp'),
  "moments_2": require('../../assets/learn/moments_2.webp'),
  "movein_1": require('../../assets/learn/movein_1.webp'),
  "movein_2": require('../../assets/learn/movein_2.webp'),
  "resale_1": require('../../assets/learn/resale_1.webp'),
  "resale_2": require('../../assets/learn/resale_2.webp'),
  "sjkp_1": require('../../assets/learn/sjkp_1.webp'),
  "sjkp_2": require('../../assets/learn/sjkp_2.webp'),
  "sjkp_3": require('../../assets/learn/sjkp_3.webp'),
  "sjkp_5": require('../../assets/learn/sjkp_5.webp'),
  "spa_1": require('../../assets/learn/spa_1.webp'),
  "spa_2": require('../../assets/learn/spa_2.webp'),
  "spa_3": require('../../assets/learn/spa_3.webp'),
  "thin_1": require('../../assets/learn/thin_1.webp'),
  "thin_2": require('../../assets/learn/thin_2.webp'),
  "valuation_1": require('../../assets/learn/valuation_1.webp'),
  "which_1": require('../../assets/learn/which_1.webp'),
  "which_2": require('../../assets/learn/which_2.webp'),
};

export const LN_TOPIC: Record<string, number> = {
  loan: require('../../assets/learn/topic_loan.webp'),
  nosalary: require('../../assets/learn/topic_nosalary.webp'),
  schemes: require('../../assets/learn/topic_schemes.webp'),
  signing: require('../../assets/learn/topic_signing.webp'),
  upfront: require('../../assets/learn/topic_upfront.webp'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export function lnPicOf(a: LnArticle, pg: number): number {
  const page = a.pages[pg - 1] || [];
  return (page.some(b => 'mine' in b) ? LN_PIC.mine : LN_PIC[`${a.id}_${pg}`]) || LN_PIC.mine;
}

export function lnAll(): LnArticle[] { return LEARN.flatMap(x => x.articles); }
export function lnArt(id: string | null): LnArticle | undefined { return lnAll().find(a => a.id === id); }
export function lnSecOf(a: LnArticle): LnSection { return LEARN.find(x => x.articles.includes(a)) || LEARN[0]; }
export function lnSeen(prog: Record<string, number> | undefined, a: LnArticle): number { return Math.min((prog || {})[a.id] || 0, a.pages.length); }
export function lnDone(prog: Record<string, number> | undefined, a: LnArticle): boolean { return lnSeen(prog, a) >= a.pages.length; }
export function lnDoneIn(prog: Record<string, number> | undefined, x: LnSection): number { return x.articles.filter(a => lnDone(prog, a)).length; }
export function lnSecDone(prog: Record<string, number> | undefined, x: LnSection): boolean { return lnDoneIn(prog, x) === x.articles.length; }
export function lnBadges(prog: Record<string, number> | undefined): number { return LEARN.filter(x => lnSecDone(prog, x)).length; }
/* how much of the section is read: pages read over all pages */
export function lnPct(prog: Record<string, number> | undefined): number {
  let a = 0, b = 0;
  lnAll().forEach(x => { a += lnSeen(prog, x); b += x.pages.length; });
  return b ? Math.round(a / b * 100) : 0;
}
