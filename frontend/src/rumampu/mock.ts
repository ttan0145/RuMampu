/* Seed data — every figure on screen derives from this. Ported verbatim from the prototype.
   When the backend lands, this module is the natural seam to replace with API data. */

export interface Source { id: string; k?: string; custom?: boolean; name?: string }
export interface IncomeEntry {
  id?: string;
  a: number;
  d: string;
  s: string;
  method?: 'manual' | 'historical_total' | 'import';
}
export interface CostItem { id: string; k?: string; a: number; custom?: boolean; name?: string; dv?: boolean; p?: string }
export interface WorkCostCategory { id: string; k?: string; custom?: boolean; name?: string; legacyMonthlyAmount?: number }
export interface WorkCostEntry { id: string; categoryId: string; categoryName?: string; a: number; d: string }
export interface Commitments { living: CostItem[]; debts: CostItem[]; savings: CostItem[] }
export interface House { price: number; deposit: number; rate: number; years: number; knownPayment: number | null }
export interface ExpenseCat { id: string; k?: string; custom?: boolean; name?: string }
export interface ExpenseEntry {
  a: number;
  d: string;
  c: string;
  method?: 'manual' | 'receipt';
  merchant?: string;
}
export interface AfterMonth { y: number; m: number; inc: number; home: number }

export interface AppData {
  sources: Source[];
  income: IncomeEntry[];
  workCostCategories: WorkCostCategory[];
  workCostEntries: WorkCostEntry[];
  commitments: Commitments;
  commitPresets: string[];
  house: House;
  homeCosts: CostItem[];
  cashOnHand: number;
  upfront: CostItem[];
  comparePayments: number[];
  expenseCats: ExpenseCat[];
  expenseLimits: Record<string, number>;
  expenses: ExpenseEntry[];
  after: { months: AfterMonth[] };
}

export const MOCK: AppData = {
  sources: [
    { id: 'ehail', k: 'src_ehail' },
    { id: 'freelance', k: 'src_freelance' },
    { id: 'parttime', k: 'src_parttime' }
  ],
  income: [
    {a:500,d:'2026-02-01',s:'parttime'},{a:880,d:'2026-02-06',s:'ehail'},{a:927,d:'2026-02-13',s:'ehail'},{a:550,d:'2026-02-14',s:'freelance'},{a:850,d:'2026-02-20',s:'ehail'},{a:920,d:'2026-02-27',s:'ehail'},
    {a:500,d:'2026-03-01',s:'parttime'},{a:910,d:'2026-03-06',s:'ehail'},{a:946,d:'2026-03-13',s:'ehail'},{a:620,d:'2026-03-18',s:'freelance'},{a:890,d:'2026-03-20',s:'ehail'},{a:980,d:'2026-03-27',s:'ehail'},
    {a:500,d:'2026-04-01',s:'parttime'},{a:1010,d:'2026-04-03',s:'ehail'},{a:1150,d:'2026-04-10',s:'freelance'},{a:1065,d:'2026-04-10',s:'ehail'},{a:990,d:'2026-04-17',s:'ehail'},{a:1000,d:'2026-04-24',s:'ehail'},
    {a:500,d:'2026-05-01',s:'parttime'},{a:1020,d:'2026-05-08',s:'ehail'},{a:995,d:'2026-05-15',s:'ehail'},{a:780,d:'2026-05-15',s:'freelance'},{a:1080,d:'2026-05-22',s:'ehail'},{a:960,d:'2026-05-29',s:'ehail'},
    {a:500,d:'2026-06-01',s:'parttime'},{a:940,d:'2026-06-05',s:'ehail'},{a:1005,d:'2026-06-12',s:'ehail'},{a:850,d:'2026-06-12',s:'freelance'},{a:926,d:'2026-06-19',s:'ehail'},{a:960,d:'2026-06-26',s:'ehail'},
    {a:500,d:'2026-07-01',s:'parttime'},{a:1030,d:'2026-07-03',s:'ehail'},{a:1064,d:'2026-07-10',s:'ehail'},{a:890,d:'2026-07-17',s:'freelance'},{a:985,d:'2026-07-17',s:'ehail'},{a:1020,d:'2026-07-24',s:'ehail'}
  ],
  workCostCategories: [
    {id:'petrol',k:'wc_petrol'},{id:'service',k:'wc_service'},{id:'platform',k:'wc_platform'},{id:'data',k:'wc_data'},{id:'roadtax',k:'wc_roadtax'}
  ],
  workCostEntries: [
    {id:'wc1',categoryId:'petrol',a:480,d:'2026-07-01'}, {id:'wc2',categoryId:'service',a:75,d:'2026-07-02'},
    {id:'wc3',categoryId:'platform',a:130,d:'2026-07-03'}, {id:'wc4',categoryId:'data',a:55,d:'2026-07-04'},
    {id:'wc5',categoryId:'roadtax',a:95,d:'2026-07-05'}
  ],
  commitments: {
    living: [{id:'rent',k:'cm_rent',a:700},{id:'food',k:'cm_food',a:900,dv:true},{id:'util',k:'cm_util',a:180},{id:'family',k:'cm_family',a:300,dv:true}],
    debts: [{id:'motor',k:'cm_motor',a:420},{id:'ptptn',k:'cm_ptptn',a:150}],
    savings: [{id:'save',k:'cm_save',a:100}]
  },
  commitPresets: ['rent','food','util','motor','ptptn','family','save'],
  house: { price: 250000, deposit: 0, rate: 4.3, years: 35, knownPayment: null },
  homeCosts: [
    {id:'maint',k:'hc_maint',a:150},{id:'insure',k:'hc_insure',a:55},{id:'assess',k:'hc_assess',a:20},{id:'quit',k:'hc_quit',a:5},{id:'parking',k:'hc_parking',a:0},{id:'other',k:'hc_other',a:0}
  ],
  cashOnHand: 8000,
  upfront: [
    {id:'legal',k:'uf_legal',a:2700,p:'assume'},{id:'stampT',k:'uf_stampT',a:4000,p:'official'},{id:'stampL',k:'uf_stampL',a:1250,p:'official'},{id:'val',k:'uf_val',a:800,p:'assume'},{id:'disb',k:'uf_disb',a:1500,p:'assume'},{id:'move',k:'uf_move',a:800,p:'assume'},{id:'basic',k:'uf_basic',a:2000,p:'assume'}
  ],
  comparePayments: [1000, 1200, 1400],
  expenseCats: [
    {id:'meals',k:'xc_meals'},{id:'groc',k:'xc_groc'},{id:'transp',k:'xc_transp'},{id:'family',k:'xc_family'},{id:'other',k:'xc_other'}
  ],
  expenseLimits: { total: 1500, meals: 220, groc: 300, family: 300 },
  expenses: [
    {a:28,d:'2026-07-01',c:'meals'},
    {a:7,d:'2026-07-02',c:'transp'},
    {a:31,d:'2026-07-03',c:'meals'},
    {a:59,d:'2026-07-04',c:'groc'},
    {a:30,d:'2026-07-06',c:'meals'},
    {a:9,d:'2026-07-07',c:'transp'},
    {a:22,d:'2026-07-08',c:'meals'},
    {a:61,d:'2026-07-09',c:'groc'},
    {a:25,d:'2026-07-10',c:'meals'},
    {a:4,d:'2026-07-11',c:'transp'},
    {a:24,d:'2026-07-13',c:'meals'},
    {a:63,d:'2026-07-14',c:'groc'},
    {a:27,d:'2026-07-15',c:'meals'},
    {a:6,d:'2026-07-16',c:'transp'},
    {a:30,d:'2026-07-17',c:'meals'},
    {a:58,d:'2026-07-18',c:'groc'},
    {a:29,d:'2026-07-20',c:'meals'},
    {a:8,d:'2026-07-21',c:'transp'},
    {a:21,d:'2026-07-22',c:'meals'},
    {a:60,d:'2026-07-23',c:'groc'},
    {a:24,d:'2026-07-24',c:'meals'},
    {a:14,d:'2026-07-25',c:'transp'},
    {a:23,d:'2026-07-27',c:'meals'},
    {a:62,d:'2026-07-28',c:'groc'},
    {a:150,d:'2026-07-05',c:'family'},
    {a:150,d:'2026-07-20',c:'family'},
    {a:28,d:'2026-08-01',c:'meals'},
    {a:7,d:'2026-08-02',c:'transp'},
    {a:27,d:'2026-08-04',c:'meals'},
    {a:55,d:'2026-08-05',c:'groc'},
    {a:30,d:'2026-08-06',c:'meals'},
    {a:5,d:'2026-08-08',c:'transp'},
    {a:29,d:'2026-08-09',c:'meals'},
    {a:53,d:'2026-08-11',c:'groc'},
    {a:28,d:'2026-08-12',c:'meals'},
    {a:7,d:'2026-08-13',c:'transp'},
    {a:27,d:'2026-08-15',c:'meals'},
    {a:55,d:'2026-08-16',c:'groc'},
    {a:30,d:'2026-08-17',c:'meals'},
    {a:9,d:'2026-08-18',c:'transp'},
    {a:22,d:'2026-08-19',c:'meals'},
    {a:61,d:'2026-08-20',c:'groc'},
    {a:21,d:'2026-08-22',c:'meals'},
    {a:11,d:'2026-08-23',c:'transp'},
    {a:150,d:'2026-08-05',c:'family'},
    {a:150,d:'2026-08-20',c:'family'}
  ],
  after: {
    months: [
      { y: 2026, m: 7, inc: 1560, home: 1380 },
      { y: 2026, m: 8, inc: 1240, home: 1380 },
      { y: 2026, m: 9, inc: 1690, home: 1430 },
      { y: 2026, m: 10, inc: 1470, home: 1380 },
      { y: 2026, m: 11, inc: 1320, home: 1380 }
    ]
  }
};
