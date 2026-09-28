# Splinterlands: Rift Walker

A playable local prototype of the supplied roguelike design. Build a team from real Splinterlands cards, traverse three branching acts, and challenge the act Guardians. Losing a battle spends chances, not persistent health.

## Run

Requires Node.js 20 or later. No packages need installing.

```powershell
npm start
```

Open **http://localhost:4173**. The server binds to `127.0.0.1`. To use a different port, set `PORT` before starting.

```powershell
npm test
```

## Play

1. Enter as a guest, or look up a public Hive collection. Choose up to 12 starting roster cards, including an Archon and compatible units, then lock your roster. The suggested roster includes different attack types and mana costs.
2. Choose a glowing connected map node. Your choice commits the encounter.
3. Choose an Archon and up to six units from your expedition roster. The Archon also costs mana. Use **Suggest lineup** to select a legal Archon and team, then adjust positions with the arrows. A red map node warns when your current roster cannot field any legal lineup under its rules; you can reroll a committed encounter with a Rift Token.
4. Watch the replay or skip to its computed result. Results cannot be manually toggled.
5. Claim shards and ability tokens, then choose one of up to three free recruits or skip. Merchants sell three recruits for 20/30/45/65 shards by rarity, as well as supplies. Mystery events can offer a free recruit. Recruitment expands the roster beyond the starting 12-card limit; it never changes your underlying collection.
6. Apply an ability token with the **+** underneath a drafted unit. Common and rare grafts expire after their battle. Epic grafts expire after their act; legendary grafts persist through the run. Divine Shield grafts are consumed after one battle.
7. A defeat can be rerolled with a Rift Token. Both lineups start fresh each encounter. Losing with no tokens left ends the expedition.

## Implemented

- Three acts, eight encounters per act, reachable branching routes, all six locked Guardian pairings in the random realm roster.
- Fight, elite, mystery, merchant, camp, and Guardian nodes; automatic combat, replay controls, and event log.
- Official mana and level-specific stats, cumulative ability unlocks, melee/ranged/magic positioning, armor, accuracy, speed ordering, and core targeting and damage abilities.
- Ten rulesets and all seven proposed Rift modifiers.
- Three starting Rift Tokens, regenerated opponents/rules/mana on buyback, capped escalating penalties for rerolled wins, lower Guardian penalty, clean subsequent fights at full rewards.
- Shard drops, Guardian guarantees, shop prices, ability grafts, mana artifacts, and between-act boons.
- Guest Archon access: Fire/Earth/Life initially; Water after one completed run, Death after two. Defeats count; abandoning does not.
- Persistent expedition rosters, a starting selection screen, battle/event recruitment choices, fixed merchant stock, and read-only roster inspection.
- Browser saves, resumed expeditions, chronicle, separate guest/collection records, responsive layout, reduced motion, and keyboard controls.
- Public collection lookup with no credentials, native-Hive card joins, level selection, and best available copy per card definition.

## Card data and artwork

`data/cards.json` and `data/settings.json` are public API snapshots retrieved on **26 September 2026**. The guest pool is derived from Foundation editions 15/16 rather than a hand-authored list. The current API has **55** Foundation cards: five Archons, eight Neutral units, eight units each for Fire/Water/Life, and nine each for Earth/Death. Coverage checks verify melee, ranged, magic, and a spread of mana costs in every paired trial pool.

Existing expeditions automatically form a roster around their saved Archon, drafted units, and grafted cards. Migration preserves map progress, currency, and pending battle results; exceptionally large legacy loadouts retain their required cards. Roster cards and run-long grafts persist across acts.

Collection imports exclude land-only cards without battle stats. Non-attacking support units, zero-mana units, and Archons remain available. Existing saved collections and expedition snapshots are cleaned on reload; any ability tokens attached to removed cards return to the satchel.

All Foundation and Guardian portraits are cached in `assets/cards`. Other imported card portraits use their official edition-specific image URLs. Guest gameplay works with cached data and artwork; fonts have local fallbacks. Collection lookup and uncached portraits require internet access.

```powershell
npm run refresh-data
```

This updates public stats and settings. It does not update cached artwork. Live stats may change; rerun tests after refreshing.

Sources: [official public API](https://api.splinterlands.com/doc/), [official gameplay guide](https://support.splinterlands.com/hc/en-us/articles/11780878408852-New-Player-Guide-Gameplay), [Foundation campaign walkthrough](https://support.splinterlands.com/hc/en-us/articles/39794013457428-Campaign-Walkthrough). Card artwork is served by Splinterlands’ official asset CDN. This is an independent fan prototype, not an official Splinterlands product.

## Preview boundaries

This is a playable first implementation, **not a production recreation of the entire official combat engine**. Foundation level-one abilities are covered; selected classic abilities are also simulated. `engine.js` exposes the covered set. Unsupported imported abilities are flagged in the card inspector. Advanced simultaneous triggers, removal of auras after their source dies, tactical Archon choices/racial synergies, official tie-breaker details, and Archon unit-level limits require additional parity work. Local results should not be treated as official Splinterlands battle predictions.

Wallet ownership verification through Hive Keychain/HiveAuth and affiliate signup are not implemented. Public lookup is explicitly labeled as lookup, not authentication. Shards and tokens have no real DEC value; no blockchain writes or real money transactions occur.

Loadout expansion beyond six units, reward-driven rarity unlocks, ruleset reroll items, persistent cosmetic/meta rewards, the Neutral secret finale, and additional legendary token examples are later milestones. Foundation contains no Dragon Archon, so the guest Dragon unlock needs a source decision; Dragon/Neutral pairing already works with imported Archons. Guardian monsters currently use official level-one stats, without additional boss stat bumps. Their escorts grow across acts, fielding three, four, then five total units; support-only and ranged Guardians begin behind a frontline unit. Automated expedition testing is recorded in [`docs/testing/README.md`](docs/testing/README.md). Human tactical playtesting and encounter balance work remain necessary, especially against the Earth Guardian.

## Files

- `app.js`: screens, browser persistence, drafting, replay, and UI actions.
- `engine.js`: deterministic local battle simulator and team legality.
- `run.js`: maps, encounters, rewards, rerolls, and act transitions.
- `roster.js`: starter selection, save migration, recruitment stock, and recruitment costs.
- `data.js`: real-stat normalization, collection level lookup, and official image paths.
- `server.mjs`: local static server and read-only collection proxy with a one-minute cache.
- `test/`: combat, economy, pool coverage, data joins, and map checks.
- `scripts/audit-expeditions.mjs`: repeatable full-run guest simulations across routes and rosters.
- `scripts/audit-economy.mjs`: matched-seed merchant purchase comparison.
- `docs/design-reference.txt`: supplied design brief.

The source can be edited directly; reload the browser after changes. No build step is needed.
