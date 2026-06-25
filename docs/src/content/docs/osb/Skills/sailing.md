---
title: "Sailing"
---

### Status

Sailing is in active development. This page documents the current bot implementation, which aims to follow OSRS data where it is represented in the codebase.

### Commands

- `/sail` - Start a Sailing activity. Supports `activity`, `variant`, `difficulty`, and `quantity`.
- `/ship status` - View ship tiers, installed facilities, stored salvage, and Barracuda Trial ranks.
- `/ship install` - Install a Sailing facility.
- `/ship upgrade` - Upgrade generic ship tiers.
- `/ship sort_salvage` - Sort stored shipwreck salvage for Sailing XP.
- `/ship trim_sails` - Trim sails during a Sailing trip. Sails can be trimmed once every 30 seconds.
- `/ship release_mote` - Release a stored wind mote during a Sailing trip.
- `/ship clam` - Feed/check the giant clam used by Sailing ocean encounters.

### Access

Sailing requires the Pandemonium quest. When content is locked by a named quest, the bot can show a Start Quest button where that quest exists in the bot.

Sea charting at Standard difficulty requires Current Affairs. This follows the OSRS training flow without requiring players to keep the Current duck item after completing the quest.

### Activities

Implemented Sailing activities:

- Sea charting
- Port tasks
- Shipwreck salvaging
- Barracuda Trials
- Deep sea trawling

### Sea Charting

Sea charting uses one-off charting tasks and completion bonuses. Easy charting is available from level 1. Standard charting requires Current Affairs and 22 Sailing.

### Shipwreck Salvaging

Shipwreck salvaging starts at 15 Sailing and requires a bronze salvaging hook facility. The bot uses OSRS shipwreck tiers, salvage names, salvage XP, sorting XP, and average wreck durations.

Supported shipwrecks:

- Small shipwreck - 15 Sailing
- Fisherman's shipwreck - 26 Sailing
- Barracuda shipwreck - 35 Sailing
- Large shipwreck - 53 Sailing
- Pirate shipwreck - 64 Sailing
- Mercenary shipwreck - 73 Sailing
- Fremennik shipwreck - 80 Sailing
- Merchant shipwreck - 87 Sailing

Salvaging stores unsorted salvage on the ship. `/ship sort_salvage` converts stored salvage into the OSRS sorting XP and rolls the corresponding OSRS salvage loot table. Drops absent from the bot's current item cache are omitted until the item data is updated.

### Barracuda Trials

The bot models Barracuda Trials as successful rank completions using OSRS target times, XP, first-completion bonus XP, one-time rewards, rank progression, and Barracuda paint rolls.

Supported trials:

- The Tempor Tantrum - 30 Sailing
- The Jubbly Jive - 55 Sailing
- The Gwenith Glide - 72 Sailing

Each trial supports Swordfish, Shark, and Marlin ranks. Swordfish must be completed before Shark, and Shark before Marlin. Completed ranks and best target times are stored on the ship.

Rewards currently implemented:

- Tempor Swordfish: Stormy key
- Tempor Shark: Barrel stand and Whirlpool surprise
- Tempor Marlin: Ralph's fabric roll, with Barracuda paint chance
- Jubbly Swordfish: Fetid key
- Jubbly Shark: Captured wind mote
- Jubbly Marlin: Gurtob's fabric roll, with Barracuda paint chance
- Gwenith Swordfish: Serrated key
- Gwenith Shark: Heart of Ithell
- Gwenith Marlin: Gwyna's fabric roll, with Barracuda paint chance

Gwenith Glide requires Regicide in OSRS. In the bot this is mimicked with 10 Crafting, 56 Agility, 25 Ranged, and 50 quest points.

### Facilities

Facilities are installed on your ship to unlock content.

- Bronze salvaging hook - unlocks shipwreck salvaging.
- Keg - built with the Barrel stand from The Tempor Tantrum. Ale effects are not yet modelled.
- Inoculation station - protects against fetid waters and is required for The Jubbly Jive.
- Salvaging station - allows salvage sorting aboard the ship.
- Rope, linen, hemp, and cotton trawling nets - unlock increasingly deep trawling shoals.
- Wind catcher - stores two wind motes; requires Captured wind mote to build.
- Gale catcher - stores three wind motes; requires Captured wind mote to build.
- Crystal extractor - grants 250 Sailing XP and produces an extractor wind mote every 63 seconds during Sailing trips; requires Heart of Ithell to build.

### Deep Sea Trawling

Deep sea trawling starts at 56 Sailing and requires an installed trawling net. Shoals use their OSRS Fishing requirements, Fishing XP, catch chances, depths, and raw fish:

- Giant krill - 69 Fishing
- Haddock - 73 Fishing
- Yellowfin - 79 Fishing
- Halibut - 83 Fishing
- Bluefin - 87 Fishing
- Marlin - 91 Fishing

Trawling rolls occur every three ticks. Better nets increase the maximum fish caught per successful roll and unlock moderate or deep shoals.

### Ocean Encounters

Ocean encounters can occur during generic Sailing trips. Implemented encounters include clue turtles, castaways, lost caskets, lost shipments, mysterious glow, Ocean Man, and the giant clam.

These encounters are not applied to Sea charting, Shipwreck salvaging, or Barracuda Trials where those activities have their own sourced result paths.

### Known Limitations

- The current ship model uses generic tiers, not OSRS skiff hulls, masts, helms, keels, or crew layout.
- Skiff-only and OSRS boat-part requirements are documented in activity messages but cannot be fully checked yet.
- Crewmate restrictions for Barracuda Trials are not enforced because crewmates are not modelled as OSRS ship crew.
- The Gale catcher schematic requirement is not checked because the schematic item is not currently in the item data.
- The salvaging station schematic and several salvage pre-roll items are not checked because those items are not currently in the item data.
- Barracuda route movement, hazards, and player skill are not simulated.
- Sail trimming and released motes grant their sourced XP and store/use charges, but their live navigation speed effects are not represented by the trip timer.
- Keg ale effects, trawling bait, mixed shoals, trophy fish, fish crates, and crewmate-operated nets are not modelled.
- Regicide itself is not added as a named bot quest; Gwenith checks the mimicked Regicide requirements instead.
