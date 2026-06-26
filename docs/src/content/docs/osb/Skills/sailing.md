---
title: "Sailing"
---

### Status

Sailing is in active development. Activities and rewards come from OSRS. Where live navigation or player input cannot be represented by an AFK bot trip, documented XP/hour estimates and simplified interactions are used.

### Commands

- `/sail` - Start a Sailing activity through subcommands for Sea charting, port tasks, shipwreck salvaging, Barracuda Trials, and deep sea trawling.
- `/ship status` - View installed facilities, stored salvage, charting progress, and Barracuda Trial ranks.
- `/ship select` - Select which ship type is active.
- `/ship install` - Install a Sailing facility by choosing a facility type, then a specific variant.
- `/ship install_part` - Install a structural ship part such as a hull, helm, keel, or mast and sails.
- `/ship sort_salvage` - Sort stored shipwreck salvage for Sailing XP.
- `/ship clam` - Prepare a tradeable, alchable item for a future giant clam encounter.
- `/ship rename` - Rename your ship.

Sailing trips are fully AFK. Sail trimming, wind mote releases, and crystal extractor harvesting are calculated automatically when the trip finishes.

### Access

Sailing requires the Pandemonium quest. When content is locked by a named quest, the bot can show a Start Quest button where that quest exists in the bot.

Individual charting tasks retain their OSRS level and quest requirements. Current tasks require Current Affairs, and crate tasks require Prying Times.

### Activities

Implemented Sailing activities:

- Sea charting
- Courier and bounty port tasks
- Shipwreck salvaging
- Barracuda Trials
- Deep sea trawling

### Sea Charting

Sea charting uses one-off OSRS charting tasks and completion bonuses. The bot selects eligible unfinished tasks, respecting each task's Sailing level, quest, and diving equipment requirements.

Charting progress is stored per task and shown on `/ship status` with a per-ocean breakdown.

### Port Tasks

Courier tasks are available from level 1 and bounty tasks from level 30. They run as ten-minute AFK task cycles rather than simulating notice boards, cargo handling, ship combat, and individual routes.

The bot uses approximate XP/hour bands from the Sailing training guide, with bounty tasks tuned below Barracuda Trial pacing. Rewards follow OSRS: coins equal the base Sailing XP gained, plus a 1/36 chance of shark paint per completed cycle. Bounty tasks also roll low-mid sailing combat loot. Concurrent task capacity increases at levels 7, 28, 56, and 84 and is included in the rate shown at trip completion.

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

Without a salvaging station facility, salvaging stores unsorted salvage on the ship. `/ship sort_salvage` sorts it at port for the OSRS sorting XP and loot table.

Each salvage attempt recovers multiple pieces of salvage. With a salvaging station facility installed before the trip starts, salvage is automatically sorted during the AFK trip. This represents the facility's OSRS ability to sort salvage while at sea.

### Barracuda Trials

The bot models Barracuda Trials as successful rank completions using OSRS target times, XP, first-completion bonus XP, one-time rewards, rank progression, structural ship requirements, and Barracuda paint rolls.

Supported trials:

- The Tempor Tantrum - 30 Sailing
- The Jubbly Jive - 55 Sailing
- The Gwenith Glide - 72 Sailing

Trial ship requirements:

- The Tempor Tantrum - Skiff, iron helm or better, and oak mast with linen sails or better.
- The Jubbly Jive - Skiff, mithril helm or better, and an Inoculation station.
- The Gwenith Glide - Skiff and adamant keel or better, plus the Regicide mimic requirements below.

Each trial supports Swordfish, Shark, and Marlin ranks. Swordfish must be completed before Shark, and Shark before Marlin. Completed ranks and best target times are stored on the ship.

Rewards currently implemented:

- Tempor Swordfish: Stormy key
- Tempor Shark: Barrel stand and Whirlpool surprise
- Tempor Marlin: Ralph's fabric roll, with Barracuda paint chance
- Jubbly Swordfish: Fetid key
- Jubbly Shark: Captured wind mote
- Jubbly Marlin: Gurtob's fabric roll, with Barracuda paint chance
- Gwenith Swordfish: Serrated key
- Gwenith Shark: Heart of ithell
- Gwenith Marlin: Gwyna's fabric roll, with Barracuda paint chance

Gwenith Glide requires Regicide in OSRS. In the bot this is mimicked with 10 Crafting, 56 Agility, 25 Ranged, and 50 quest points.

Barracuda Trials only roll strong winds from ocean encounters; other random encounters, encounter loot, and encounter XP are suppressed during trials.

### Facilities

Facilities are installed on your ship to unlock content.

- Rafts have 1 facility hotspot, skiffs have 7, and sloops have 13.
- `/ship install` groups facilities by type: salvaging hooks, trawling nets, wind catchers, and station/utility facilities.
- Bronze through dragon salvaging hooks - unlock and improve shipwreck salvaging.
- Keg - built with the Barrel stand from The Tempor Tantrum. Ale effects are not yet modelled.
- Inoculation station - protects against fetid waters and is required for The Jubbly Jive.
- Salvaging station - automatically sorts salvage while salvaging at sea.
- Rope, linen, hemp, and cotton trawling nets - unlock increasingly deep trawling shoals.
- Wind catcher - automatically catches and releases wind motes for 40 Sailing XP; requires Captured wind mote to build.
- Gale catcher - automatically catches and releases wind motes for 70 Sailing XP; requires Captured wind mote to build.
- Crystal extractor - automatically grants 250 Sailing XP every 63 seconds. Its motes are automatically released for 10 Sailing XP when a catcher is installed; requires a Heart of ithell, which is not consumed.

### Structural Ship Parts

Ships have OSRS-style structural parts. Rafts have a hull, helm, and mast with sails. Skiffs and sloops also have a keel. Structural parts install on the currently active ship.

Each user has one raft, one skiff, and one sloop. `/ship select` chooses the active ship, and Sailing commands use that active ship's structural parts, facilities, and stored salvage.

Supported ship types:

- Raft - 1 Sailing, 1 facility hotspot, no keel, no Barracuda Trials.
- Skiff - 15 Sailing, 7 facility hotspots, required for Barracuda Trials.
- Sloop - 50 Sailing, 13 facility hotspots.

Supported structural tiers:

- Hulls: wooden, oak, teak, mahogany, camphor, ironwood, and rosewood.
- Helms and keels: bronze, iron, steel, mithril, adamant, rune, and dragon.
- Mast and sails: wooden/linen, oak/linen, teak/canvas, mahogany/canvas, camphor/canvas, ironwood/cotton, and rosewood/cotton.

Recipes are kept close to OSRS. If an OSRS recipe component is not in the bot's current item data yet, the command leaves that component uncharged and reports it instead of inventing an item.

### Passive Sailing Actions

During every Sailing trip, the bot automatically:

- Trims the starter sails once per completed 30 seconds and rolls the Soup chance for each trim.
- Applies the 25% reduced trimming XP when a wind or gale catcher is installed.
- Releases every wind mote generated by trimming.
- Harvests the crystal extractor once per completed 63 seconds and releases its mote when a catcher is installed.

The combined passive XP and actions are shown in the trip completion message. No commands are required while the minion is away.

### Deep Sea Trawling

Deep sea trawling starts at 56 Sailing and requires an installed trawling net. Shoals use their OSRS Fishing requirements, Fishing XP, catch chances, depths, and raw fish:

- Giant krill - 69 Fishing
- Haddock - 73 Fishing
- Yellowfin - 79 Fishing
- Halibut - 83 Fishing
- Bluefin - 87 Fishing
- Marlin - 91 Fishing

The command quantity is the number of shoal stops. Each stop uses the shoal's OSRS stop duration, and catch rolls occur every three ticks during that stop. Better nets increase the maximum fish caught per successful roll and unlock moderate or deep shoals.

### Ocean Encounters

Moving activities such as Sea charting and port tasks can trigger ocean encounters. Barracuda Trials only trigger strong winds. The bot uses the OSRS 72-second checks with escalating 1/6 through 6/6 spawn odds and the published encounter rarity weights.

Implemented encounters are strong winds, mysterious glows, lost crates, castaways, giant clams, clue turtles, Ocean Man, and lost caskets. Lost crates award real items from their OSRS loot categories rather than creating crate items. Lost caskets award one roll from the appropriate clue reward table.

`/ship clam` represents feeding the clam during an encounter. The prepared item must be tradeable and alchable, takes at least one hour to polish, and is returned as the appropriate real pearl on a later giant clam encounter.

### Known Limitations

- Port-task routes, cargo handling, bounty combat, and notice-board selection are represented by approximate XP/hour bands.
- Lost-crate tier selection and loot within each real OSRS loot category are simplified.
- The giant clam is prepared through `/ship clam` because feeding it during a random AFK encounter is not interactive.
- OSRS hulls, masts, sails, helms, keels, cargo holds, and crew layout are not yet modelled. Generic ship tiers and their invented bonuses have been removed.
- Cargo holds and typed hotspot placement are not fully modelled yet; facility hotspot counts are enforced by ship type.
- Crewmate restrictions for Barracuda Trials are not enforced because crewmates are not modelled as OSRS ship crew.
- The Gale catcher schematic requirement is not checked because the schematic item is not currently in the item data.
- The salvaging station schematic and several salvage pre-roll items are not checked because those items are not currently in the item data.
- Barracuda route movement, hazards, and player skill are not simulated.
- Automatic sail trimming currently uses the starter sail's sourced XP until real sail parts are implemented. Live navigation speed effects are not represented by the trip timer.
- Keg ale effects, trawling bait, mixed shoals, trophy fish, fish crates, and crewmate-operated nets are not modelled.
- Regicide itself is not added as a named bot quest; Gwenith checks the mimicked Regicide requirements instead.
