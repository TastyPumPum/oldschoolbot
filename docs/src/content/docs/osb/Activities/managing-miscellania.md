---
title: "Managing Miscellania"
---

Managing Miscellania in OSB has two actions:

- `topup` (default): do your upkeep trip to restore favour.
- `claim`: collect your accumulated output and pay the coffer GP spend since the last claim.

Start/topup:

[[/activities managing_miscellania action\:topup primary_area\:Herbs secondary_area\:Wood (Maple)]]

Claim:

[[/activities managing_miscellania action\:claim]]

## How It Works

- `primary_area` is where 10 workers go.
- `secondary_area` is where 5 workers go.
- Areas must be different.
- You cannot combine `Fishing (Raw)` with `Fishing (Cooked)`.
- You cannot combine multiple hardwood modes (`Mahogany`, `Teak`, `Hardwood (Both)`).

## State Model

The bot persists:

- current coffer
- current favour
- unclaimed resource points
- last claim time
- last topup time
- selected primary/secondary areas

`topup` runs a normal trip and restores favour to 100% on completion.
`claim` is instant (no trip), deducts GP from bank equal to coffer spent since last claim, and resets unclaimed resource points.

## Topup Trip Time

Topup trip time scales by days since your last topup:

- `days = clamp(days_since_last_topup, 1, 100)`
- `duration = days * 15s`

Max topup duration is 25 minutes.

## Claim GP Cost

Claim GP is charged only on `action:claim`, based on coffer reduction since your previous claim.

## Preview

Use `preview:true` with either action:

- `topup` preview: days, duration, max-trip fit, coffer/favour/resource points snapshot.
- `claim` preview: days since claim, GP needed now, coffer/favour/resource points snapshot, affordability.

## Detailed Simulation Mode

Use `/simulate managing_miscellania` for mechanic previews.

Detailed mode includes coffer/favour/resource-point simulation over arbitrary day counts.

## Testing Helpers

For local/dev environments (`/testpotato` only):

- `miscellania_set` sets a custom Miscellania state
- `miscellania_age` backdates Miscellania timestamps by N days
- `miscellania_clear` clears saved Miscellania state

These are for testing and not part of normal user flow.
