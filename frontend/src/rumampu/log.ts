import { AppState } from './state';

/* v24 activity log — what changed and when. Session-only, like the rest of
   the state: guest mode keeps nothing once the app is closed. */

export interface LogEntry {
  ts: number;
  k: string;
  v: Record<string, string | number>;
  field: string | null;
}

const LOG_WINDOW_H = 72;
const LOG_MAX = 300;

/* kind chip + action label per event key. */
export const LOG_META: Record<string, [string, string]> = {
  lg_inc_add: ['lgk_inc', 'lga_add'], lg_inc_edit: ['lgk_inc', 'lga_edit'],
  lg_inc_del: ['lgk_inc', 'lga_del'], lg_inc_date: ['lgk_inc', 'lga_date'],
  lg_scan: ['lgk_inc', 'lga_scan'], lg_csv: ['lgk_imp', 'lga_file'],
  lg_exp_add: ['lgk_exp', 'lga_add'], lg_exp_scan: ['lgk_exp', 'lga_scan'],
  lg_exp_edit: ['lgk_exp', 'lga_edit'], lg_exp_del: ['lgk_exp', 'lga_del'],
  lg_exp_date: ['lgk_exp', 'lga_date'],
  lg_wc_log: ['lgk_wc', 'lga_log'], lg_wc_edit: ['lgk_wc', 'lga_edit'],
  lg_wc_del: ['lgk_wc', 'lga_del'], lg_wc_move_in: ['lgk_wc', 'lga_in'],
  lg_wc_move_out: ['lgk_wc', 'lga_out'],
  lg_cm_add: ['lgk_cm', 'lga_add'], lg_cm_set: ['lgk_cm', 'lga_set'],
  lg_limit: ['lgk_lim', 'lga_set'], lg_limit_total: ['lgk_lim', 'lga_set'],
  lg_hc_set: ['lgk_hc', 'lga_set'], lg_uf_set: ['lgk_uf', 'lga_set'],
  lg_cp_set: ['lgk_house', 'lga_set'], lg_price: ['lgk_house', 'lga_price'],
  lg_dep: ['lgk_house', 'lga_dep'], lg_target: ['lgk_save', 'lga_target'],
  lg_test_save: ['lgk_test', 'lga_saved'], lg_test_del: ['lgk_test', 'lga_deleted'],
  lg_saved_day: ['lgk_save', 'lga_saved'], lg_unsaved_day: ['lgk_save', 'lga_undo'],
  lg_pot_add: ['lgk_save', 'lga_add'], lg_pot_del: ['lgk_save', 'lga_del'],
};

/* Mutates a draft (call inside up()). `field` coalesces an editing burst —
   one entry per field per 90 seconds, so holding a key never fills the list. */
export function logIt(s: AppState, k: string, v?: Record<string, string | number>, field?: string): void {
  const now = Date.now();
  if (!s.log) s.log = [];   /* sessions persisted before the log existed */
  const L = s.log;
  if (field && L.length) {
    const last = L[L.length - 1];
    if (last.field === field && now - last.ts < 90000) {
      last.ts = now;
      last.v = v || {};
      return;
    }
  }
  L.push({ ts: now, k, v: v || {}, field: field || null });
  if (L.length > LOG_MAX) L.splice(0, L.length - LOG_MAX);
}

/* Newest first, within the 72-hour window. */
export function logRecent(s: AppState): LogEntry[] {
  const cut = Date.now() - LOG_WINDOW_H * 3600 * 1000;
  return (s.log ?? []).filter(e => e.ts >= cut).slice().reverse();
}

export function logWhen(ts: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const min = Math.floor(Math.max(0, Date.now() - ts) / 60000);
  if (min < 1) return t('lg_now');
  if (min < 60) return t('lg_min', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('lg_hr', { n: hr });
  return t('lg_day', { n: Math.floor(hr / 24) });
}

export function logClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
