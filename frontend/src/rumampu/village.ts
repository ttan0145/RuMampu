import { AppState, VillageState } from './state';
import { potSum } from './pot';

/* v22 saving village — a 4x4 merge board (2048-style): saving a day spawns a
   Pondok, sliding merges two alike into the next tier. Ported verbatim from the
   prototype. All functions mutate the draft state passed by up().
   Since 8 Oct 2026 a saved day adds a Pondok to a ready pile, and each swipe places one. */

export const ISO_TIERS = ['pondok', 'kampung', 'teres', 'kondo', 'istana'] as const;

/* Epic 10 non-negotiables, spelled out as flags so adding a streak or a decay
   timer means consciously flipping one here — not accidental design drift.
   The game can't be won by playing, only by saving; saving is never taxed and
   the board never manufactures loss. */
export const VILLAGE_RULES = {
  streaks: false,
  decay: false,
  lossAnimations: false,
  guiltNudges: false,
  mergesOptional: true,
} as const;

export function villageEnsure(s: AppState): VillageState {
  if (!s.village) {
    s.village = {
      cells: new Array(16).fill(0), pop: [], score: 0, best: 0, moves: 0, gain: 0, built: 0,
      collection: 0, queued: 0, savedRm: 0,
    };
  }
  /* Sessions persisted before Epic 10 lack the new counters. */
  if (s.village.collection == null) s.village.collection = 0;
  if (s.village.queued == null) s.village.queued = 0;
  if (s.village.savedRm == null) s.village.savedRm = 0;
  return s.village;
}

/* Epic 10 buffer lock: once a real buffer target exists, the village only
   progresses while the shield is full. A dip pauses progress (new houses
   queue) but never touches existing tiles — the app won't help someone drain
   their safety net into a deposit. Pre-Epic-10 sessions have no buffer. */
export function canProgressVillage(s: AppState): boolean {
  const b = s.buffer;
  if (!b || b.target === null) return true;
  /* US5.8: the buffer is held from the whole pot first. */
  return potSum(s) >= b.target;
}

/* A saved day always registers. If the board is full — or the buffer lock is
   on — the house waits in the queue instead of silently vanishing, so a
   saving never reads as "didn't count." */
/* A saved day adds one Pondok to the ready pile ("queued"); it lands on the plot with the
   player's next swipe, so saving and playing feel like one loop. */
export function villageSpawn(s: AppState): boolean {
  const v = villageEnsure(s);
  v.built++;
  v.queued++;
  v.pop = [];
  return true;
}

/* Place one ready Pondok on a free square, if any is ready and the plot may grow. */
function villagePlaceOne(s: AppState): number | null {
  const v = villageEnsure(s);
  if (v.queued <= 0 || !canProgressVillage(s)) return null;
  const empty = v.cells.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
  if (!empty.length) return null;
  const i = empty[Math.floor(Math.random() * empty.length)];
  v.cells[i] = 1;
  v.queued--;
  return i;
}

/* Un-saving a day takes one Pondok back. When every Pondok has already been
   merged (two saved days built a Kampung house), the smallest house on the
   plot is broken back into the Pondok-equivalents it was built from, minus the
   one taken back: a Kampung leaves a Pondok, a Terrace leaves a Kampung and a
   Pondok, a Kondo leaves a Terrace, a Kampung and a Pondok. Houses that do
   not fit on the plot wait in the queue as Pondoks. Without this the merged
   house stayed and the next save spawned an extra Pondok, so the plot showed
   more saved days than the plan. An Istana in the collection is only opened
   when the plot is empty. */
export function villageRemove(s: AppState): void {
  const v = villageEnsure(s);
  const resetRunIfEmpty = () => {
    if (v.built !== 0) return;
    v.score = 0;
    v.moves = 0;
    v.gain = 0;
    v.msg = '';
    /* best is intentionally kept as the all-time high score. */
  };
  v.pop = [];
  if (v.queued > 0) {
    v.queued--;
    v.built = Math.max(0, v.built - 1);
    resetRunIfEmpty();
    return;
  }
  const pondok = v.cells.indexOf(1);
  if (pondok >= 0) {
    v.cells[pondok] = 0;
    v.built = Math.max(0, v.built - 1);
    resetRunIfEmpty();
    return;
  }
  let tier = 0, at = -1;
  v.cells.forEach((c, i) => { if (c > 0 && (tier === 0 || c < tier)) { tier = c; at = i; } });
  if (at >= 0) {
    v.cells[at] = 0;
  } else if (v.collection > 0) {
    v.collection--;
    tier = ISO_TIERS.length;
  } else {
    return;
  }
  v.built = Math.max(0, v.built - 1);
  /* A tier-t house is 2^(t-1) Pondoks; one fewer is exactly one house of each
     lower tier. Place the biggest first so the plot keeps its shape. */
  let waiting = 0;
  for (let t = tier - 1; t >= 1; t--) {
    const empty = v.cells.indexOf(0);
    if (empty >= 0) {
      v.cells[empty] = t;
      v.pop.push(empty);
    } else {
      waiting += Math.pow(2, t - 1);
    }
  }
  v.queued += waiting;
  resetRunIfEmpty();
}

/* Slide + merge in one direction; returns the best merged tier, or -1 if nothing moved. */
export function villageMove(s: AppState, dir: 'l' | 'r' | 'u' | 'd'): number {
  const v = villageEnsure(s);
  const g = v.cells;
  let changed = false, best = 0, gain = 0;
  const pop: number[] = [];
  /* where every house goes on this move, so the plot can slide them there */
  const slide: Array<{ f: number; t: number; tier: number }> = [];
  for (let a = 0; a < 4; a++) {
    const idxs: number[] = [];
    for (let b = 0; b < 4; b++) {
      let r: number, c: number;
      if (dir === 'l') { r = a; c = b; } else if (dir === 'r') { r = a; c = 3 - b; } else if (dir === 'u') { r = b; c = a; } else { r = 3 - b; c = a; }
      idxs.push(r * 4 + c);
    }
    const src = idxs.filter(i => g[i]);
    const vals = src.map(i => g[i]);
    const out: number[] = [];
    for (let k = 0; k < vals.length; k++) {
      if (k + 1 < vals.length && vals[k] === vals[k + 1] && vals[k] < ISO_TIERS.length) {
        const next = vals[k] + 1;
        const to = idxs[out.length];
        slide.push({ f: src[k], t: to, tier: vals[k] }, { f: src[k + 1], t: to, tier: vals[k + 1] });
        best = Math.max(best, next);
        /* 2^tier scoring: kampung 2, teres 4, kondo 8, istana 16. */
        gain += Math.pow(2, next - 1);
        if (next === ISO_TIERS.length) {
          /* Epic 10: a new istana graduates off the grid into the permanent
             collection — the grid is the workshop, the collection the record,
             so the board never fills with unmergeable terminal tiles. */
          v.collection++;
          pop.push(idxs[out.length]);
        } else {
          out.push(next);
          pop.push(idxs[out.length - 1]);
        }
        k++;
      } else {
        slide.push({ f: src[k], t: idxs[out.length], tier: vals[k] });
        out.push(vals[k]);
      }
    }
    while (out.length < 4) out.push(0);
    idxs.forEach((i, k) => { if (g[i] !== out[k]) { g[i] = out[k]; changed = true; } });
  }
  v.pop = pop;
  v.slide = changed ? slide : [];
  v.gain = changed ? gain : 0;
  return changed ? best : -1;
}

/* One player move: slide and merge, then one ready Pondok lands on a free square (the "+1").
   A swipe that only places a Pondok still counts as a move. Returns false if nothing happened. */
export function villagePlay(s: AppState, dir: 'l' | 'r' | 'u' | 'd', builtLabel: (tier: number) => string): boolean {
  const r = villageMove(s, dir);
  const v = villageEnsure(s);
  const placed = villagePlaceOne(s);
  if (r < 0 && placed == null) return false;
  v.msg = r >= 2 ? builtLabel(r) : '';
  v.moves++;
  if (r >= 0) {
    v.score += v.gain;
    v.best = Math.max(v.best, v.score);
  }
  v.spawn = placed;
  v.spawnAt = v.moves;
  return true;
}

/* Start over: every house goes back to the ready pile as the Pondoks it was built from
   (a tier-t house is 2^(t-1) Pondoks, an Istana in the collection is 16), so the ready
   pile again holds every saved day and no saved day is lost. Score and moves restart;
   the best score and the built count stay. */
export function villageRestart(s: AppState): void {
  const v = villageEnsure(s);
  const back = v.cells.reduce((a, c) => a + (c > 0 ? Math.pow(2, c - 1) : 0), 0)
    + v.collection * Math.pow(2, ISO_TIERS.length - 1);
  v.cells = new Array(16).fill(0);
  v.queued += back;
  v.collection = 0;
  v.score = 0;
  v.moves = 0;
  v.gain = 0;
  v.msg = '';
  v.pop = [];
  v.spawn = null;
  v.slide = [];
}

/* Play: "Let's start!" the first time in a session, straight into the village after that. */
export function villageOpen(s: AppState): void {
  villageEnsure(s).msg = '';
  s.vHelp = false;
  s.sheet = s.vFlashSeen ? 'village' : 'vflash';
  s.vFlashSeen = true;
}

/* Houses that could not be placed yet, said as something ready rather than something lost:
   either merging makes room, or they wait for the safety money to be full again. */
export function villageQueueKey(s: AppState): string | null {
  const v = s.village;
  const q = v?.queued ?? 0;
  if (q <= 0) return null;
  if (!canProgressVillage(s)) return 'vl_queue_buf';
  return v!.cells.some(c => !c) ? 'vl_ready_swipe' : 'vl_queue_room';
}

/* The square to light up: where the last swipe placed a ready Pondok, until the next move. */
export function villageGlow(s: AppState): number[] {
  const v = s.village;
  return v && v.spawn != null && v.spawnAt === v.moves && v.cells[v.spawn] ? [v.spawn] : [];
}
