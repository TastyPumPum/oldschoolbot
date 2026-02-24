---
title: "Managing Miscellania"
---

Managing Miscellania in OSB is a repeatable activity that tracks coffer, favour, and resource points over time.

Start it with:

[[/activities managing_miscellania primary_area\:Herbs secondary_area\:Wood (Maple)]]

Preview cost/time without starting:

[[/activities managing_miscellania primary_area\:Herbs secondary_area\:Wood (Maple) preview\:true]]

You can also preview from simulate:

[[/simulate managing_miscellania primary_area\:Herbs secondary_area\:Wood (Maple)]]

Detailed simulation (coffer + favour + resource points):

[[/simulate managing_miscellania detailed\:true days\:30 royal_trouble\:true starting_coffer\:7500000 starting_favour\:100 primary_area\:Herbs secondary_area\:Wood (Maple)]]

## How It Works

- The bot assumes [[Royal Trouble]] is effectively complete for this activity.
- You must pick 2 different areas:
- `primary_area` = 10 workers
- `secondary_area` = 5 workers
- The trip represents your "kingdom upkeep/claim" run.
- Some pairs are blocked:
- You cannot pick both `Fishing (Raw)` and `Fishing (Cooked)`.
- You cannot combine multiple hardwood modes (`Mahogany`, `Teak`, `Hardwood (Both)`).

## State Model

The command stores and updates:

- current coffer amount
- current favour
- total resource points
- last claim timestamp
- chosen primary/secondary area pair

When a trip completes, favour is topped back to 100% (representing your upkeep run), and updated coffer/resource points are persisted.

## Cost And Time

- Day unit: 1 real day since your last Miscellania claim.
- Minimum claim size: 1 day.
- Maximum claim size: 100 days.
- Trip duration per day: `15s`.

Formulas:

- `days = clamp(days_since_last_claim, 1, 100)`
- `duration = days * 15s`

GP cost is not a flat `75,000 * days`. It is calculated from the detailed coffer simulation loop over those days (with the daily cap and coffer percentage reduction), then withdrawn from your bank at trip start.

So the maximum trip is:

- `7,500,000 GP`
- `25 minutes` (100 * 15s)

## Daily Usage

1. Run [[/activities managing_miscellania]] with your preferred primary/secondary areas.
2. Your minion pays GP immediately and starts the trip.
3. On completion, claim timestamp, coffer, favour, and resource points are updated.
4. Repeat daily (or let days accumulate, up to 100).

## Previewing Before Sending

Use either preview command to check:

- days that would be claimed now
- GP cost now
- trip duration now
- whether you can afford it
- whether it fits your max trip length

## Detailed Simulation Mode

`/simulate managing_miscellania` supports a detailed mode that mirrors the internal coffer/favour loop:

- `detailed:true`
- `days`
- `royal_trouble`
- `starting_coffer`
- `starting_favour`
- `constant_favour`

It reports:

- ending coffer
- total GP spent
- ending favour
- resource points

## Testing Helpers

For local/dev environments (`/testpotato` only):

- `miscellania_set` sets a custom Miscellania state
- `miscellania_age` backdates claim time by N days
- `miscellania_clear` clears saved Miscellania state

These are for testing and not part of normal user flow.
