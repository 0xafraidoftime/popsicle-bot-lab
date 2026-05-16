# popsicle-bot-lab

> PGN → personality fingerprint → a bot that *actually plays like you.*

**[Live Demo →](https://0xafraidoftime.github.io/popsicle-bot-lab)**

Now you might ask "why popsicle bot lab? why not chess human exterminator?"

I'm here to tell you that's a valid question. So I decided to name this repo "popsicle-bot-lab" cuz that's me on chess.com

![alt text](images/popsicle_guy.png)

An open prototype for Chess.com's 3rd 2026 AI focus area — mapping a player's historical PGN data to a personality vector, then encoding that vector into a Stockfish-driven bot spec.

Built by **Ankita Pal** aka [@popsicle_guy](https://www.chess.com/member/popsicle_guy)

---

## How it all works (not that you care but maybe you do hehe)

```
chess.com /pub/player/{user}/games    PGN file
                    └──────────────┘
                           ▼
               [ python-chess parser ]
                           ▼
              per-game heuristic metrics
                           ▼
         normalise → 8-dim trait vector ∈ [0,1]
              ┌────────────────────────────┐
              ▼                            ▼
  nearest-centroid cluster       param-mapping function
              ▼                            ▼
          ARCHETYPE              STOCKFISH BOT SPEC
                              skill / depth / contempt
                              move-bias vector
                              blunder injection prob
```

### Pipeline

| Step | What happens |
|------|-------------|
| **01 PGN ingestion** | Pull last N games via Chess.com's public archives API, or accept a raw PGN dump. Parses mainline into board states + move metadata. |
| **02 Heuristic feature extraction** | Per-game: captures, checks, sacrifice ratio, early-queen moves, castling speed, central pawn pushes, endgame reach + result, opening (ECO) diversity, time-control base. |
| **03 Trait normalisation** | Raw stats compose into 8 traits in [0,1]: `aggression`, `tactical_vision`, `positional_play`, `time_mgmt`, `opening_diversity`, `endgame_strength`, `risk_tolerance`, `blunder_resistance`. |
| **04 Nearest-centroid clustering** | 8 hand-seeded archetype centroids (Tactical Tornado, Patient Strategist, Endgame Surgeon…). Euclidean distance → confidence score. |
| **05 Bot spec generation** | Trait vector maps to Stockfish runtime params: `skill_level`, `search_depth`, `contempt`, `move_time`, `blunder_injection_prob`, opening-book width, and a 6-dim move-selection bias vector. |

### Archetypes

| Archetype | Personality |
|-----------|-------------|
| Tactical Tornado | Relentlessly aggressive, sacrifices for initiative |
| Patient Strategist | Pawn structure devotee, positional grinder |
| Endgame Surgeon | Trades into endings with frightening precision |
| Opening Theorist | 25 moves of prep, slightly lost after |
| Blitz Berserker | Pre-moves on move 3, clock as weapon |
| Solid Defender | Never loses a won position. Actually never loses. |
| Chaotic Gambiteer | King's Gambit on move 2. Sacrifices are felt, not calculated. |
| Balanced Pragmatist | Does everything competently. Terrifying in aggregate. |

---

## What's next

- Plug Stockfish + the bias vector into a **move-sampler** (top-k softmax over engine PVs weighted by bias)
- Add **engine-eval-based blunder labelling** for true `tactical_vision`
- Train an **embedding head on millions of Chess.com users** to replace hand-seeded centroids
- Replace heuristic ECO diversity with proper **opening tree analysis**

---

## Stack

- Vanilla JS + CSS (no framework — keeps it inspectable)
- Chess.com Public API (`/pub/player/{user}/games/archives`)
- Stockfish 16 (spec generated; live move-sampler = next weekend)
- GitHub Pages (zero infra)

---

## Run locally

```bash
git clone https://github.com/0xafraidoftime/popsicle-bot-lab
cd popsicle-bot-lab
# Any static server works:
python3 -m http.server 8080
# → open http://localhost:8080
```

> Note: The Chess.com API is CORS-friendly for public endpoints, so this runs fully client-side.

---

## Links

- GitHub: [0xafraidoftime](https://github.com/0xafraidoftime)
- LinkedIn: [Ankita Pal](https://www.linkedin.com/in/ankita-pal-70a269157/)
- Twitter: [@afraidoftime_](https://x.com/afraidoftime_)
- Chess.com: [@popsicle_guy](https://www.chess.com/member/popsicle_guy)

---

*v0.1 · open-source · built in a weekend*
