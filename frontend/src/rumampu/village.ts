import { AppState, VillageState } from './state';

/* v22 saving village — a 4x4 merge board (2048-style): saving a day spawns a
   Pondok, sliding merges two alike into the next tier. Ported verbatim from the
   prototype. All functions mutate the draft state passed by up(). */

export const ISO_TIERS = ['pondok', 'kampung', 'teres', 'kondo', 'istana'] as const;

export function villageEnsure(s: AppState): VillageState {
  if (!s.village) s.village = { cells: new Array(16).fill(0), pop: [], score: 0, best: 0, moves: 0, gain: 0, built: 0 };
  return s.village;
}

export function villageSpawn(s: AppState): boolean {
  const v = villageEnsure(s);
  const empty = v.cells.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
  if (!empty.length) return false;
  const i = empty[Math.floor(Math.random() * empty.length)];
  v.cells[i] = 1;
  v.pop = [i];
  v.built++;
  return true;
}

export function villageRemove(s: AppState): void {
  const v = villageEnsure(s);
  const i = v.cells.indexOf(1);
  if (i >= 0) { v.cells[i] = 0; v.built = Math.max(0, v.built - 1); }
  v.pop = [];
}

/* Slide + merge in one direction; returns the best merged tier, or -1 if nothing moved. */
export function villageMove(s: AppState, dir: 'l' | 'r' | 'u' | 'd'): number {
  const v = villageEnsure(s);
  const g = v.cells;
  let changed = false, best = 0, gain = 0;
  const pop: number[] = [];
  for (let a = 0; a < 4; a++) {
    const idxs: number[] = [];
    for (let b = 0; b < 4; b++) {
      let r: number, c: number;
      if (dir === 'l') { r = a; c = b; } else if (dir === 'r') { r = a; c = 3 - b; } else if (dir === 'u') { r = b; c = a; } else { r = 3 - b; c = a; }
      idxs.push(r * 4 + c);
    }
    const vals = idxs.map(i => g[i]).filter(x => x);
    const out: number[] = [];
    for (let k = 0; k < vals.length; k++) {
      if (k + 1 < vals.length && vals[k] === vals[k + 1] && vals[k] < ISO_TIERS.length) {
        out.push(vals[k] + 1);
        pop.push(idxs[out.length - 1]);
        best = Math.max(best, vals[k] + 1);
        gain += Math.pow(2, vals[k] + 1);
        k++;
      } else out.push(vals[k]);
    }
    while (out.length < 4) out.push(0);
    idxs.forEach((i, k) => { if (g[i] !== out[k]) { g[i] = out[k]; changed = true; } });
  }
  v.pop = pop;
  v.gain = changed ? gain : 0;
  return changed ? best : -1;
}

/* One player move: slide, then update the score/message. Returns false if nothing moved. */
export function villagePlay(s: AppState, dir: 'l' | 'r' | 'u' | 'd', builtLabel: (tier: number) => string): boolean {
  const r = villageMove(s, dir);
  if (r < 0) return false;
  const v = villageEnsure(s);
  v.msg = r >= 2 ? builtLabel(r) : '';
  v.moves++;
  v.score += v.gain;
  v.best = Math.max(v.best, v.score);
  return true;
}
