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

export interface LnArticle { id: string; title: string; lead: string; src: string[]; pages: LnBlock[][] }
export interface LnSection { id: string; tab: string; title: string; epf?: boolean; articles: LnArticle[] }

export const LN_SRC: Record<string, { n: string; h: string; d: string }> = {
  "madani": {
    "n": "SJKP: MADANI",
    "h": "https://www.sjkp.com.my/en/hcgs/hcgs-madani",
    "d": "8 October 2026"
  },
  "hcgs": {
    "n": "SJKP: HCGS",
    "h": "https://www.sjkp.com.my/en/hcgs/scheme-features",
    "d": "8 October 2026"
  },
  "elig": {
    "n": "SJKP: Eligibility",
    "h": "https://www.sjkp.com.my/en/hcgs/eligibility",
    "d": "8 October 2026"
  },
  "docs": {
    "n": "SJKP: Documents to FIs",
    "h": "https://www.sjkp.com.my/en/hcgs/documents-to-fis",
    "d": "8 October 2026"
  },
  "sro": {
    "n": "Malaysian Bar: SRO 2023",
    "h": "https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20258-2023.pdf",
    "d": "8 October 2026"
  },
  "stamp": {
    "n": "LHDN: Stamp Act 1949",
    "h": "https://www.hasil.gov.my/media/hwdf2s3g/20240101-stamp-act-1949-act-378.pdf",
    "d": "10 September 2026"
  },
  "exempt": {
    "n": "Malaysian Bar: First-home exemption",
    "h": "https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20128-2026.pdf",
    "d": "8 October 2026"
  },
  "ccris": {
    "n": "BNM: CCRIS FAQ",
    "h": "https://www.bnm.gov.my/faq/ccris",
    "d": "8 October 2026"
  },
  "buyer": {
    "n": "KPKT: Homebuyer FAQ",
    "h": "https://ehome.kpkt.gov.my/index.php/pages/view/220",
    "d": "8 October 2026"
  },
  "valuation": {
    "n": "JPPH: Valuation FAQ",
    "h": "https://www.jpph.gov.my/v3/?page_id=8647&lang=en",
    "d": "8 October 2026"
  },
  "pr1ma": {
    "n": "PR1MA: Eligibility",
    "h": "https://www.pr1ma.my/eligibility-home",
    "d": "8 October 2026"
  },
  "pr1mafaq": {
    "n": "PR1MA: FAQ",
    "h": "https://www.pr1ma.my/faq",
    "d": "8 October 2026"
  },
  "rmr": {
    "n": "MyGovernment: RMR",
    "h": "https://www.malaysia.gov.my/en/categories/aid-welfare-and-assistance/housing-aid/rumah-mesra-rakyat-rmr-programme",
    "d": "8 October 2026"
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
          "hcgs",
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
              "p": "SJKP MADANI guarantees up to 120% of the purchase price, capped at RM360,000: up to 100% for the home and up to 20% for costs such as [[MRTT|Mortgage Reducing Term Takaful: cover for the remaining loan if the insured person dies or becomes permanently disabled.]], legal fees and furnishing."
            },
            {
              "p": "The standard SJKP scheme has a financing limit of RM500,000. Eligibility does not mean approval."
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
                "href": "https://www.sjkp.com.my/en/fi-partners"
              }
            }
          ]
        ]
      },
      {
        "id": "docs",
        "title": "What to bring instead of a payslip",
        "lead": "Records that show income a payslip would.",
        "pages": [
          [
            {
              "p": "SJKP lists supporting records for applicants whose income does not come with a payslip. The financial institution reviews the application."
            }
          ],
          [
            {
              "ul": [
                "Bank or deposit statements for the latest six months, if available",
                "Income tax return or EPF statement",
                "A confirmed declaration of self-employment or income stream"
              ]
            }
          ],
          [
            {
              "p": "Your platform earnings summary and commitments can help organise your own record. The checklist is a preparation aid; the institution decides which evidence it accepts."
            },
            {
              "go": {
                "label": "Open your document checklist",
                "to": "docs"
              }
            }
          ]
        ],
        "src": [
          "docs"
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
              "p": "The purchase agreement sets when payments fall due. For regulated developer sales, KPKT says the developer cannot collect payment before the [[SPA|Sale and purchase agreement: the contract setting the home, price and payment terms.]] is signed."
            }
          ],
          [
            {
              "p": "Upfront cash groups your estimate into signing, completion and moving in. These groups organise your scenario; your contract and invoices set the actual dates."
            },
            {
              "go": {
                "label": "Open Upfront cash",
                "to": "upfront"
              }
            }
          ]
        ],
        "src": [
          "buyer",
          "sro"
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
              "p": "The cash you provide depends on the price and the financing actually agreed. RuMampu tests the deposit you enter; a test is not a loan offer."
            }
          ],
          [
            {
              "mine": "deposit"
            }
          ],
          [
            {
              "note": "A RM0 deposit in a scenario does not guarantee that an institution will finance the whole purchase."
            }
          ]
        ],
        "src": [
          "hcgs"
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
                "Your utility connection charges or deposits",
                "Building charges stated in your agreement",
                "Your own furniture and moving budget"
              ]
            }
          ],
          [
            {
              "p": "Upfront cash asks for your figures for these items. Use the charges or quotes that apply to your home; a blank field is not an estimate."
            },
            {
              "go": {
                "label": "Open Upfront cash",
                "to": "upfront"
              }
            }
          ]
        ],
        "src": [
          "buyer"
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
        "pages": [
          [
            {
              "p": "SJKP publishes conditions about income, total loan repayments and repayment history. These are scheme conditions, not a promise of financing."
            }
          ],
          [
            {
              "p": "The application is assessed by the participating financial institution. RuMampu does not make its lending decision."
            }
          ]
        ],
        "src": [
          "elig"
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
              "p": "A ratio is one input to a lending assessment. RuMampu’s house test shows how a scenario compares with your recorded months; it does not predict approval."
            }
          ]
        ]
      },
      {
        "id": "credit",
        "title": "Your credit record: CCRIS",
        "lead": "What a bank can see about past borrowing.",
        "src": [
          "ccris"
        ],
        "pages": [
          [
            {
              "p": "[[CCRIS|The Central Credit Reference Information System run by Bank Negara Malaysia. It collects credit information reported by participating financial institutions.]] records financing and repayment information. You can access your own report through eCCRIS without a fee."
            }
          ],
          [
            {
              "p": "CCRIS is not a blacklist or a credit rating. Institutions make their own lending decisions using it and other information."
            }
          ]
        ]
      },
      {
        "id": "thin",
        "title": "An empty credit record is not an approval",
        "lead": "A report is information, not a decision.",
        "pages": [
          [
            {
              "p": "An empty record does not show a history of repaying borrowing. It is not a credit rating or a guarantee that an application will succeed."
            }
          ],
          [
            {
              "p": "Institutions use information from the application and supporting documents as well as credit records. RuMampu does not know what decision they will make."
            }
          ]
        ],
        "src": [
          "ccris"
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
        "pages": [
          [
            {
              "p": "PR1MA offers homes for eligible Malaysian applicants. Its published conditions include an income range and limits on existing property ownership."
            }
          ],
          [
            {
              "p": "Rumah Mesra Rakyat is a government programme through SPNB for lower-income households to build on land they own or have permission to use."
            }
          ],
          [
            {
              "p": "These are different programmes with different conditions. Their official pages give the current application requirements."
            }
          ]
        ],
        "src": [
          "pr1ma",
          "rmr"
        ]
      },
      {
        "id": "ballot",
        "title": "Qualifying doesn’t guarantee a unit",
        "lead": "Registration and selection are different steps.",
        "pages": [
          [
            {
              "p": "PR1MA describes a separate application step for newly launched developments. Registering does not automatically enter an applicant into a ballot."
            }
          ],
          [
            {
              "p": "Its process includes selection and checking eligibility. Meeting the basic criteria does not reserve a unit or promise financing."
            }
          ]
        ],
        "src": [
          "pr1ma"
        ]
      },
      {
        "id": "resale",
        "title": "Check the resale conditions for the scheme",
        "lead": "The scheme’s current terms matter.",
        "pages": [
          [
            {
              "p": "PR1MA’s FAQ asks purchasers to contact it for clarification of the moratorium period. This lesson does not supply a fixed waiting period."
            }
          ],
          [
            {
              "p": "Use the scheme’s current terms and your agreement to understand any limits on resale. Different programmes can have different conditions."
            }
          ]
        ],
        "src": [
          "pr1mafaq"
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
        "pages": [
          [
            {
              "p": "For regulated developer sales, KPKT says payment cannot be collected before the [[SPA|Sale and purchase agreement: the contract setting the home, price and payment terms.]] is signed."
            }
          ],
          [
            {
              "p": "The signed agreement and its payment schedule set the purchase payments. The loan agreement is separate; both affect what is due."
            }
          ],
          [
            {
              "p": "The [[MOT|Memorandum of transfer: the document used to register ownership in your name.]] concerns transfer of title. Completion and key collection follow the terms of the transaction."
            }
          ]
        ],
        "src": [
          "buyer"
        ]
      },
      {
        "id": "valuation",
        "title": "A lower valuation: a cash scenario",
        "lead": "A worked example, not a loan offer.",
        "pages": [
          [
            {
              "p": "JPPH says the public can obtain a market-value estimate from a private valuer. The next page assumes a value 5% below your tested price and the same financing share: an example, not a loan offer."
            }
          ],
          [
            {
              "mine": "valuation"
            }
          ]
        ],
        "src": [
          "valuation"
        ]
      },
      {
        "id": "deadlines",
        "title": "Dates that cost money if you miss them",
        "lead": "Worth noting as soon as you sign.",
        "pages": [
          [
            {
              "p": "The first-home stamp duty orders cover qualifying sale and purchase agreements signed from 1 January 2021 to 31 December 2027. The other conditions must also be met."
            }
          ]
        ],
        "src": [
          "exempt"
        ]
      },
      {
        "id": "defects",
        "title": "Checking for defects before the window closes",
        "lead": "The developer repairs what you report in time.",
        "pages": [
          [
            {
              "p": "For regulated new homes under Schedules G and H, KPKT states a 24-month [[defect liability period|The period after vacant possession during which defects are dealt with under the purchase agreement.]]. The agreement records the dates."
            }
          ],
          [
            {
              "p": "Defects and any report about them relate to the home’s condition. The agreement and KPKT’s official information explain the applicable process."
            }
          ],
          [
            {
              "p": "The end of the period does not by itself settle every right or remedy. KPKT’s FAQ also describes tribunal claims."
            }
          ]
        ],
        "src": [
          "buyer"
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
/* how much of the section is read: pages read over all pages */
export function lnPct(prog: Record<string, number> | undefined): number {
  let a = 0, b = 0;
  lnAll().forEach(x => { a += lnSeen(prog, x); b += x.pages.length; });
  return b ? Math.round(a / b * 100) : 0;
}
