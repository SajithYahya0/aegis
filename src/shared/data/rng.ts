/**
 * WHY THIS EXISTS:
 *   A seeded pseudo-random generator plus the sampling helpers the seed builder
 *   needs. Same seed in, same policy book out, on every reload and in every
 *   test run.
 *
 * CONCEPTS: W3-D2-06, W3-D2-07
 *
 * WITHOUT THIS:
 *   The seed data would use `Math.random()` at module scope, so the 120-policy
 *   book would be different on every page load. Concretely that breaks three
 *   things. (1) `PolicyList.test.tsx` (W3-D2-07) cannot assert "filtering to
 *   `lapsed` leaves 14 rows" — the number changes per run, so the test is
 *   either deleted or weakened to `expect(rows.length).toBeGreaterThan(0)`,
 *   which passes even when the filter is broken. (2) The render-count table in
 *   docs/render-counts.md (C-12) compares before/after numbers that would be
 *   measured against two different datasets. (3) Reloading the page while
 *   demonstrating memoisation silently swaps the data under the reviewer.
 */

export type Rng = () => number;

/**
 * mulberry32 — a 32-bit generator. Chosen over a naive LCG because low-bit
 * correlation in an LCG shows up visibly here: `pick()` on a 4-element array
 * uses the low bits, so an LCG would hand back a near-alternating cycle of
 * policy types instead of a plausible mix.
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [min, max], both inclusive. */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Uniform float in [min, max). */
export function float(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** True with probability `p`. */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/**
 * Uniform element. Throws on an empty array rather than returning `undefined`,
 * because a silently-undefined city would render as an empty table cell and be
 * mistaken for missing data rather than a generator bug.
 */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pick() called with an empty array');
  }
  return items[int(rng, 0, items.length - 1)] as T;
}

/**
 * Weighted pick. Used so the policy book has a realistic status mix (mostly
 * active, a minority lapsed) rather than a flat 25% each — a flat mix would
 * make the status filter look like it barely narrows anything.
 */
export function weighted<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [value, w] of entries) {
    roll -= w;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}

/** Shuffle a copy, Fisher-Yates. Never mutates the input. */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(rng, 0, i);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** An ISO date string `daysBack` days before `from`, truncated to the day. */
export function isoDaysBefore(from: Date, daysBack: number): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/** An ISO date string `monthsAhead` months after `iso`, truncated to the day. */
export function isoMonthsAfter(iso: string, monthsAhead: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}
