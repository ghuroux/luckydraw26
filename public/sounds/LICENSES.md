# Sound asset provenance

All four files are sourced from [SoundBible.com](https://soundbible.com), a free
sound effect library. Most sounds there are under **Attribution 3.0** or **Public
Domain** — the per-sound license is shown on each sound's page. Until we hear
back from a license review, we should treat these as **attribution-required**
and credit SoundBible somewhere in the public-facing portal (Phase 5).

## Active files

| File | SoundBible page | Author | License |
|---|---|---|---|
| `spin-loop.mp3` | [Metronome (1)](https://soundbible.com/914-Metronome-1.html) — wood block metronome | Mike Koenig | Attribution 3.0 |
| `slowdown.mp3` | [Swoosh 1](https://soundbible.com/682-Swoosh-1.html) | Mike Koenig | Attribution 3.0 |
| `land.mp3` | [Japanese Temple Bell Small](https://soundbible.com/1496-Japanese-Temple-Bell-Small.html) | Mike Koenig | Attribution 3.0 |
| `winner.mp3` | [Magical](https://soundbible.com/1088-Magical.html) | KevanGC | Attribution 3.0 |

## Alternates (in `_alternates/`)

Drop these in over the canonical filenames if the primary picks miss the brief.

- `spin-loop-tick.mp3` — [Tick (2044)](https://soundbible.com/2044-Tick.html), Daniel Simion
- `spin-loop-clock.mp3` — [Ticking Clock (1580)](https://soundbible.com/1580-Ticking-Clock.html), Mike Koenig (longer, melancholic)
- `slowdown-swooshing.mp3` — [Swooshing (670)](https://soundbible.com/670-Swooshing.html), Mike Koenig
- `slowdown-swoosh3.mp3` — [Swoosh 3 (706)](https://soundbible.com/706-Swoosh-3.html), Mike Koenig (shorter)
- `land-zen-bell.mp3` — [Zen Buddhist Temple Bell (1491)](https://soundbible.com/1491-Zen-Buddhist-Temple-Bell.html), Mike Koenig (deeper)
- `land-temple-bigger.mp3` — [Temple Bell Bigger (1474)](https://soundbible.com/1474-Temple-Bell-Bigger.html), Mike Koenig
- `winner-fanfare.mp3` — [Winning Triumphal Fanfare (1823)](https://soundbible.com/1823-Winning-Triumphal-Fanfare.html), John Stracke (more game-show)
- `winner-computer-magic.mp3` — [Computer Magic (1630)](https://soundbible.com/1630-Computer-Magic.html), Microsift

## To swap

```bash
# example: replace winner with the fanfare alternate
cp public/sounds/_alternates/winner-fanfare.mp3 public/sounds/winner.mp3
```
