# The Ascent

A small RPG built into Sanctum, where your real-world productivity — habits,
quests, and focus sessions — feeds a character that grows stronger over time.
No separate app, no separate login: it's just another tab, fed by the same
data as the rest of Sanctum.

## The core idea

Everything you do elsewhere in Sanctum generates **Essence**. Essence does
two things: it levels your character up automatically in the background, and
you can spend your banked balance to fight monsters for gear.

You don't have to engage with the battle system at all for your character to
grow — just using Sanctum normally (completing habits, finishing quests,
running focus sessions) is enough. Battling is there if and when you want a
more active reward loop.

## Earning Essence

| Source | Essence |
|---|---|
| Completing a habit | 5 |
| Completing a low-priority quest | 10 |
| Completing a medium-priority quest | 15 |
| Completing a high-priority quest | 25 |
| Each minute of a focus session | 1 |

Essence is tracked two ways: **lifetime Essence** (everything you've ever
earned — this is what determines your level) and **balance** (what you
currently have banked and can spend on battles).

Essence syncs automatically in the background. You don't need to visit The
Ascent page for it to accrue — it's calculated off your existing habit
completions, quest completions, and focus session history, so leveling up is
a side effect of using the rest of the app.

## Leveling and stats

Every **100 lifetime Essence** = 1 level. Leveling raises four stats
automatically, no decisions required:

- **HP** — how much damage you can take before being defeated in battle
- **ATK** — how hard you hit
- **DEF** — how much incoming damage is reduced
- **SPD** — determines who acts first in combat

Gear (see below) adds on top of these base stats.

## Your familiar fights with you

Your dragon familiar from the dashboard isn't just decorative here — it
fights alongside you. If you have one or more **active habit streaks** when
you head into battle, you can trigger the familiar's "surge" ability: a
one-time damage boost at the start of the fight, scaled by how many streaks
you currently have running. Keeping habits consistent has a direct payoff in
combat, not just on the dashboard.

## Battling

1. Pick an enemy. Enemies are grouped into five tiers (Slime and Goblin at
   the low end, up through the Lich King at the top) and gated by your
   level — you can't challenge a tier you haven't reached yet, so there's no
   way to walk into something hopelessly out of reach.
2. Battling costs Essence (scales with the enemy's tier). This is spent
   whether you win or lose.
3. Combat resolves automatically, turn by turn, based on stats — speed
   determines turn order, and each side's attack vs. the other's defense
   determines damage. You watch the exchange play out in a short combat log
   rather than picking individual moves each turn.
4. **Win:** you get a chunk of bonus Essence back, plus a chance at a gear
   drop.
5. **Lose:** you simply don't get the Essence back. There's no further
   penalty — losing a fight costs you the Essence you spent to start it and
   nothing more, so there's no reason not to experiment with tougher enemies.

## Gear

Gear drops in three slots — **Weapon**, **Armor**, **Trinket** — and three
tiers — **Common**, **Rare**, **Epic** — with epic drops becoming possible
once you're fighting tier-4+ enemies. Each piece gives flat bonuses to ATK,
DEF, and HP. Drops land in your inventory; tap a piece to equip it into its
slot, which immediately updates your combat stats. There's no deeper
itemization beyond that — no sockets, enchanting, or set bonuses — by design,
to keep the system readable at a glance.


## Data and privacy

Like the rest of Sanctum, all Ascent data — Essence totals, level, equipped
gear, inventory, and battle history — lives in your browser's `localStorage`
alongside everything else. Nothing is sent anywhere, and progress is tied to
whichever URL/browser you're using Sanctum from.
