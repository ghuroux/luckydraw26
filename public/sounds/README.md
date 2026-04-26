# Draw sound effects

Four sound files drive the reveal animation. Drop MP3s into this directory
with these exact filenames:

| File | Used during | Brief |
|---|---|---|
| `spin-loop.mp3` | spinUp + race phases (loops) | Looping rhythmic tick, ~0.5s loop, warm/woody. **Avoid** metallic clatter, casino slot machines, coin rattles. Think wooden percussion or a soft mechanical clock. |
| `slowdown.mp3` | slowDown phase (~1.5s, one-shot) | Descending sweep or pitch-bend down. Smooth, evolving. Could be a whoosh, a string slide, or a synthesised falling tone. |
| `land.mp3` | land phase (~0.5–1s, one-shot) | Single warm chime — vibraphone, marimba, wine-glass tap, or a soft bell. Short attack, gentle decay. **Avoid** sharp ding-dings or arcade coins. |
| `winner.mp3` | reveal moment (~1.5–2s, one-shot) | Celebratory swell. Builds, has sparkle, ends. Orchestral hit + shimmer is ideal. **Avoid** game-show fanfares, "ta-da!" cartoon stings. |

Volumes are pre-balanced in `components/draw/sounds.ts` (spin-loop quietest at
0.4, winner loudest at 0.8). Replace files freely — the wiring picks them up
on next draw.

## Where to find them

Pixabay sound effects are CC0-equivalent (no attribution required), MP3
downloads work in one click without an account. Curated search starting
points:

- `spin-loop.mp3` —
  - https://pixabay.com/sound-effects/search/clock-tick/ (look for ~0.5–1s loops)
  - https://pixabay.com/sound-effects/search/woodblock/
  - https://pixabay.com/sound-effects/search/marimba-tick/
- `slowdown.mp3` —
  - https://pixabay.com/sound-effects/search/whoosh-down/
  - https://pixabay.com/sound-effects/search/descending-sweep/
  - https://pixabay.com/sound-effects/search/pitch-down/
- `land.mp3` —
  - https://pixabay.com/sound-effects/search/vibraphone/
  - https://pixabay.com/sound-effects/search/marimba/
  - https://pixabay.com/sound-effects/search/wine-glass/
- `winner.mp3` —
  - https://pixabay.com/sound-effects/search/orchestral-sting/
  - https://pixabay.com/sound-effects/search/magical-reveal/
  - https://pixabay.com/sound-effects/search/sparkle-rise/

Mixkit (also free, no attribution required, but require interactive
"Download Free SFX" click in browser):

- https://mixkit.co/free-sound-effects/win/ (for winner)
- https://mixkit.co/free-sound-effects/chimes/ (for land)

## Track provenance

When you drop a file, record where it came from in `LICENSES.md` (next to this
file). Future-you will want to know.

## Files in `_v1/public/sounds/` (legacy)

`slot-machine.mp3` exists and might be acceptable as a starting `spin-loop`
candidate, though spec note says it's likely too "Vegas". `slot-stop.mp3` and
`winner.mp3` in v1 are 111-byte placeholders — ignore them.
