import { randomInt } from "node:crypto";

export interface EntryForSelection {
  id: string;
  entrantId: string;
  entrantDisplayName: string;
}

// One-win-per-entrant filter. If the filter would empty the pool (e.g. more
// prizes than unique entrants), eligibility resets to the full list and the
// `reset` flag tells the caller to surface the explanation + audit it.
export function filterEligible(
  entries: EntryForSelection[],
  alreadyWonEntrantIds: ReadonlySet<string>,
): { eligible: EntryForSelection[]; reset: boolean } {
  const eligible = entries.filter((e) => !alreadyWonEntrantIds.has(e.entrantId));
  if (eligible.length > 0) return { eligible, reset: false };
  return { eligible: entries, reset: true };
}

// Uniform pick from the eligible entries. Weighting by ticket count is
// implicit: entrants with more entries appear more times in the input list.
export function pickWinner(eligible: EntryForSelection[]): EntryForSelection {
  if (eligible.length === 0) {
    throw new Error("pickWinner: eligible list is empty");
  }
  const idx = randomInt(0, eligible.length);
  return eligible[idx]!;
}

// Build the reveal pool: `size` display names including the winner, padded by
// cycling through unique entrants when the event has fewer than `size` of them.
// The returned order is randomised so the caller can use it directly as a
// scrolling sequence; the animation is responsible for placing the winner at
// the landing frame.
export function samplePool(
  winner: EntryForSelection,
  allEventEntries: ReadonlyArray<EntryForSelection>,
  size = 10,
): string[] {
  const others = uniqueEntrantNames(allEventEntries, winner.entrantId);
  const sampled = sampleWithoutReplacement(others, Math.min(size - 1, others.length));
  const names: string[] = [winner.entrantDisplayName, ...sampled];

  if (names.length < size) {
    const base = names.slice();
    let i = 0;
    while (names.length < size) {
      names.push(base[i % base.length]!);
      i++;
    }
  }

  return shuffle(names);
}

function uniqueEntrantNames(
  entries: ReadonlyArray<EntryForSelection>,
  excludeEntrantId: string,
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const e of entries) {
    if (e.entrantId === excludeEntrantId) continue;
    if (seen.has(e.entrantId)) continue;
    seen.add(e.entrantId);
    names.push(e.entrantDisplayName);
  }
  return names;
}

function sampleWithoutReplacement<T>(arr: ReadonlyArray<T>, k: number): T[] {
  if (k <= 0 || arr.length === 0) return [];
  const a = arr.slice();
  const out: T[] = [];
  for (let i = 0; i < k && a.length > 0; i++) {
    const idx = randomInt(0, a.length);
    out.push(a[idx]!);
    a.splice(idx, 1);
  }
  return out;
}

function shuffle<T>(arr: ReadonlyArray<T>): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
