# Mel — RiftMeld

You asked for "a game better than Rummikub", so this repo now ships **RiftMeld**:
a fast set-building game inspired by Rummikub with extra strategy and disruption.

## Why it is "better" (more strategic / chaotic)

RiftMeld keeps the satisfying pattern-building core (sets + runs) and adds:

- **Round events** that alter scoring each cycle (Solar Flare, Lunar Echo, etc.).
- **Power tiles**:
  - **Shift** changes the active event.
  - **Steal** takes a random tile from an opponent.
  - **Forge** converts two tiles into a Joker.
- **Dynamic scoring** with bonuses for meld type and event synergy.
- **Bots** so you can play instantly without setting up a table.

## How to play

```bash
python3 game.py
```

You can:

- `meld` to place a valid run or set (3+ tiles)
- `draw` to pull from the deck
- `power` to play a power tile
- `pass` to skip

### Meld rules

- **Set**: same value, all different elements (wildcards allowed).
- **Run**: same element, consecutive values (wildcards can fill gaps).

## Design notes

This is a terminal-first prototype focused on game mechanics.
If you want, the next iteration can add:

- local multiplayer over network,
- deterministic seeds + replay logs,
- a web UI with drag-and-drop table editing,
- stronger AI (lookahead rather than greedy).
