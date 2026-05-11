// Throwaway sanity script for lib/rng.ts. Run with: npx tsx scripts/check-rng.ts
import { filterEligible, pickWinner, samplePool, type EntryForSelection } from "@/lib/rng";

function makeEntries(spec: { entrantId: string; name: string; tickets: number }[]): EntryForSelection[] {
  const out: EntryForSelection[] = [];
  let id = 0;
  for (const s of spec) {
    for (let i = 0; i < s.tickets; i++) {
      out.push({
        id: `e${id}`,
        entrantId: s.entrantId,
        entrantDisplayName: s.name,
        ticketNumber: id + 1,
      });
      id++;
    }
  }
  return out;
}

function pct(n: number, total: number) {
  return ((n / total) * 100).toFixed(2) + "%";
}

// ── 1. Uniformity over a flat pool of 10 ────────────────────────────────────
{
  const entries = makeEntries(
    Array.from({ length: 10 }, (_, i) => ({ entrantId: `p${i}`, name: `P${i}`, tickets: 1 })),
  );
  const counts = new Map<string, number>();
  const N = 100_000;
  for (let i = 0; i < N; i++) {
    const w = pickWinner(entries);
    counts.set(w.entrantId, (counts.get(w.entrantId) ?? 0) + 1);
  }
  console.log(`\n[1] Uniformity over 10 entrants, N=${N} (each should be ~10%):`);
  for (const [id, c] of [...counts.entries()].sort()) {
    console.log(`    ${id}: ${c} (${pct(c, N)})`);
  }
}

// ── 2. Ticket-weighting ─────────────────────────────────────────────────────
{
  const entries = makeEntries([
    { entrantId: "alice", name: "Alice", tickets: 5 },
    { entrantId: "bob", name: "Bob", tickets: 1 },
  ]);
  let alice = 0,
    bob = 0;
  const N = 60_000;
  for (let i = 0; i < N; i++) {
    const w = pickWinner(entries);
    if (w.entrantId === "alice") alice++;
    else bob++;
  }
  console.log(`\n[2] Ticket-weighting (Alice 5 / Bob 1, expect ~83% / ~17%), N=${N}:`);
  console.log(`    Alice: ${alice} (${pct(alice, N)})`);
  console.log(`    Bob:   ${bob} (${pct(bob, N)})`);
}

// ── 3. Eligibility filter ───────────────────────────────────────────────────
{
  const entries = makeEntries([
    { entrantId: "a", name: "A", tickets: 1 },
    { entrantId: "b", name: "B", tickets: 1 },
    { entrantId: "c", name: "C", tickets: 1 },
  ]);
  const some = filterEligible(entries, new Set(["a", "b"]));
  const all = filterEligible(entries, new Set(["a", "b", "c"]));
  console.log("\n[3] Eligibility filter:");
  console.log(`    Two won → reset=${some.reset}, eligible=${some.eligible.map((e) => e.entrantId).join(",")} (expect c only)`);
  console.log(`    All won → reset=${all.reset}, eligible.length=${all.eligible.length} (expect reset=true, length=3)`);
}

// ── 4. samplePool with plenty of entrants ───────────────────────────────────
{
  const entries = makeEntries(
    Array.from({ length: 30 }, (_, i) => ({ entrantId: `p${i}`, name: `Person ${i}`, tickets: 1 })),
  );
  const winner = entries[3]!;
  const pool = samplePool(winner, entries);
  const winnerCount = pool.filter((n) => n === winner.entrantDisplayName).length;
  const unique = new Set(pool).size;
  console.log("\n[4] samplePool with 30 unique entrants:");
  console.log(`    pool.length=${pool.length} (expect 10)`);
  console.log(`    winner appearances=${winnerCount} (expect 1)`);
  console.log(`    unique names=${unique} (expect 10)`);
  console.log(`    pool: ${pool.join(", ")}`);
}

// ── 5. samplePool with FEWER than 10 unique entrants (padding by cycling) ───
{
  const entries = makeEntries([
    { entrantId: "a", name: "Alice", tickets: 1 },
    { entrantId: "b", name: "Bob", tickets: 1 },
    { entrantId: "c", name: "Carol", tickets: 1 },
    { entrantId: "d", name: "Dave", tickets: 1 },
  ]);
  const winner = entries[0]!;
  const pool = samplePool(winner, entries);
  const winnerCount = pool.filter((n) => n === winner.entrantDisplayName).length;
  const unique = new Set(pool).size;
  console.log("\n[5] samplePool with only 4 unique entrants (expect padding):");
  console.log(`    pool.length=${pool.length} (expect 10)`);
  console.log(`    unique names=${unique} (expect 4)`);
  console.log(`    winner appearances=${winnerCount} (expect ≥1; cycling will repeat names)`);
  console.log(`    pool: ${pool.join(", ")}`);
}

// ── 6. samplePool with a single entrant (winner is everyone) ────────────────
{
  const entries = makeEntries([{ entrantId: "solo", name: "Solo", tickets: 3 }]);
  const winner = entries[0]!;
  const pool = samplePool(winner, entries);
  console.log("\n[6] samplePool degenerate case — single entrant:");
  console.log(`    pool.length=${pool.length} (expect 10)`);
  console.log(`    pool: ${pool.join(", ")}`);
}

console.log("\nDone.");
