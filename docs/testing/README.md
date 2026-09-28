# Expedition testing · 27 September 2026

The [full-run audit](final.json) completed 720 deterministic guest expeditions: 60 seeds for each of four starting rosters (suggested, Earth, Life, Fire) and three route preferences (safe, elite, merchant). Each simulation uses the production encounter, combat, recruitment, reward, camp, reroll, and lineup functions. It serializes and restores the run after map and reward steps, and checks roster, currency, battle legality, reward, and ending invariants. It encountered all six node types, all ten rulesets, all seven Rift modifiers, and all six realm pairings. It reached an ending in every run and found no roster softlocks in those 720 runs.

| Route preference | Full victories | Out of | Typical issue |
| --- | ---: | ---: | --- |
| Safe | 153 | 240 | Guardian difficulty varies by realm |
| Elite | 103 | 240 | Token depletion after repeated hard battles |
| Merchant | 118 | 240 | More roster growth, but fewer camp boons |
| **All** | **374** | **720** | |

The suggested starting roster won 46/60 safe-route runs, 28/60 elite-route runs, and 29/60 merchant-route runs. Earth-focused starts performed best in this sample; Fire-focused starts were hardest. A narrow comparison using the old first-Archon auto-draft model won 0/60 suggested-roster safe-route seeds, versus 46/60 with the new lineup suggestion. That comparison measures automatic selection, not a skilled player's manual choices.

Guardian difficulty remains uneven. Across all attempts (including rerolls), Act 2 Earth won 98/535 and Act 3 Earth won 29/348, whereas Act 1 Life won 70/70 and Act 2 Life won 74/74. These are attempt rates, not independent run win probabilities. The Earth encounter is a particularly strong [Last Stand](https://support.splinterlands.com/hc/en-us/articles/13132032473236-Last-Stand) and [Cleanse](https://support.splinterlands.com/hc/en-us/articles/12254015432596-Cleanse) pairing. The next balance pass should test counterplay and Guardian escort composition with human decisions before changing official card stats.

The [matched-seed merchant audit](economy.json) repeated 60 merchant-route seeds for each roster under four purchase policies. Buying the usual recruit and supply mix won 118/240 runs, compared with 98/240 when skipping all purchases. Supplies alone won 97/240; recruits alone won 103/240. The mixed policy's advantage varied by roster and seed, so this does not establish optimal prices.

In an isolated browser origin, a guest expedition also traversed battle, mystery battle, camp, and merchant nodes. The browser check confirmed automatic Archon switching, battle resolution, shard awards, recruitment, merchant spending, and resume after reload. The player's saved expedition on port 4173 was left intact. This is a smoke test; the 720-run audit is automated strategy play rather than full three-act browser input or human tactical testing.

Run `npm test`, `npm run audit`, and `npm run audit:economy` to repeat the checks. The audit scripts overwrite their respective reports using a fixed set of seeds.
