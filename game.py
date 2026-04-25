#!/usr/bin/env python3
"""RiftMeld: a strategic set-building game inspired by Rummikub.

Play in terminal against bots. Build valid melds to score points while reacting to
round events and using power tiles.
"""

from __future__ import annotations

import random
from collections import Counter
from dataclasses import dataclass
from enum import Enum
from typing import Iterable, List, Optional
import itertools


class Element(str, Enum):
    SUN = "Sun"
    MOON = "Moon"
    TIDE = "Tide"
    STONE = "Stone"


ELEMENTS = [Element.SUN, Element.MOON, Element.TIDE, Element.STONE]


@dataclass(frozen=True)
class Tile:
    value: int
    element: Optional[Element] = None
    power: Optional[str] = None

    @property
    def is_wild(self) -> bool:
        return self.power == "Wildcard"

    @property
    def is_power(self) -> bool:
        return self.power is not None and self.power != "Wildcard"

    def label(self) -> str:
        if self.power:
            if self.power == "Wildcard":
                return "[Joker]"
            return f"[{self.power}]"
        return f"{self.element.value[:2]}-{self.value}"


@dataclass
class Meld:
    tiles: List[Tile]
    kind: str

    def score(self, event: str) -> int:
        base = sum(tile.value for tile in self.tiles if tile.value > 0)
        if self.kind == "run":
            base += 2
        if self.kind == "set":
            base += 1
        if event == "Solar Flare" and any(t.element == Element.SUN for t in self.tiles):
            base += 4
        if event == "Lunar Echo" and any(t.element == Element.MOON for t in self.tiles):
            base += 4
        if event == "Rising Tides" and any(t.element == Element.TIDE for t in self.tiles):
            base += 4
        if event == "Stonewall" and any(t.element == Element.STONE for t in self.tiles):
            base += 4
        return base

    def description(self) -> str:
        return f"{self.kind.title()} -> " + " ".join(tile.label() for tile in self.tiles)


class Deck:
    def __init__(self) -> None:
        tiles: List[Tile] = []
        for _ in range(2):
            for element in ELEMENTS:
                for value in range(1, 14):
                    tiles.append(Tile(value=value, element=element))
        tiles.extend([Tile(value=0, power="Wildcard") for _ in range(2)])
        tiles.extend([Tile(value=0, power="Shift") for _ in range(3)])
        tiles.extend([Tile(value=0, power="Steal") for _ in range(3)])
        tiles.extend([Tile(value=0, power="Forge") for _ in range(3)])
        random.shuffle(tiles)
        self._tiles = tiles

    def draw(self) -> Optional[Tile]:
        if not self._tiles:
            return None
        return self._tiles.pop()

    def __len__(self) -> int:
        return len(self._tiles)


class Player:
    def __init__(self, name: str, bot: bool = False) -> None:
        self.name = name
        self.hand: List[Tile] = []
        self.score = 0
        self.bot = bot

    def draw(self, deck: Deck, amount: int = 1) -> None:
        for _ in range(amount):
            tile = deck.draw()
            if tile:
                self.hand.append(tile)

    def hand_text(self) -> str:
        indexed = [f"{i + 1}:{tile.label()}" for i, tile in enumerate(self.hand)]
        return "  ".join(indexed) if indexed else "(empty)"


class RiftMeld:
    EVENTS = ["Solar Flare", "Lunar Echo", "Rising Tides", "Stonewall", "Calm"]

    def __init__(self, human_name: str, bot_count: int = 2) -> None:
        self.deck = Deck()
        self.players = [Player(human_name)] + [Player(f"Bot-{i+1}", bot=True) for i in range(bot_count)]
        self.table: List[Meld] = []
        self.round_event = "Calm"

        for p in self.players:
            p.draw(self.deck, 14)

    @staticmethod
    def _non_power(tiles: Iterable[Tile]) -> List[Tile]:
        return [t for t in tiles if not t.power]

    @staticmethod
    def _count_wilds(tiles: Iterable[Tile]) -> int:
        return sum(1 for t in tiles if t.is_wild)

    def validate(self, chosen: List[Tile]) -> Optional[Meld]:
        if len(chosen) < 3:
            return None

        wilds = self._count_wilds(chosen)
        regular = self._non_power(chosen)
        if not regular and wilds >= 3:
            return Meld(chosen, "set")

        # Try set: same value, all distinct elements
        values = {t.value for t in regular}
        if len(values) <= 1:
            element_counts = Counter(t.element for t in regular)
            if all(c == 1 for c in element_counts.values()) and len(regular) + wilds >= 3:
                return Meld(chosen, "set")

        # Try run: same element, consecutive values with possible wild gaps
        elements = {t.element for t in regular}
        if len(elements) == 1:
            vals = sorted(t.value for t in regular)
            needed = 0
            for i in range(1, len(vals)):
                gap = vals[i] - vals[i - 1]
                if gap == 0:
                    needed = 999
                    break
                needed += max(0, gap - 1)
            if needed <= wilds and len(chosen) >= 3:
                return Meld(chosen, "run")

        return None

    def apply_power(self, player: Player, tile: Tile) -> None:
        if tile.power == "Shift":
            self.round_event = random.choice(self.EVENTS)
            print(f"  ⚡ {player.name} shifts the round event to: {self.round_event}")
        elif tile.power == "Steal":
            candidates = [p for p in self.players if p is not player and p.hand]
            if not candidates:
                print("  No one to steal from.")
            else:
                target = random.choice(candidates)
                stolen = random.choice(target.hand)
                target.hand.remove(stolen)
                player.hand.append(stolen)
                print(f"  🕵️ {player.name} steals {stolen.label()} from {target.name}!")
        elif tile.power == "Forge":
            if len(player.hand) < 2:
                print("  Need 2 tiles in hand to forge.")
            else:
                tossed = random.sample(player.hand, 2)
                for t in tossed:
                    player.hand.remove(t)
                player.hand.append(Tile(value=0, power="Wildcard"))
                print(f"  🔨 {player.name} forges a Joker from two random tiles.")

    def available_actions(self, player: Player) -> List[str]:
        return ["meld", "draw", "power", "pass"] if any(t.is_power for t in player.hand) else ["meld", "draw", "pass"]

    def _human_choose_tiles(self, player: Player) -> List[Tile]:
        print("Choose tile numbers separated by spaces.")
        print(player.hand_text())
        raw = input("> ").strip()
        if not raw:
            return []
        try:
            idxs = sorted({int(x) - 1 for x in raw.split()})
        except ValueError:
            return []
        if any(i < 0 or i >= len(player.hand) for i in idxs):
            return []
        return [player.hand[i] for i in idxs]

    def _best_meld(self, player: Player) -> Optional[Meld]:
        best: Optional[Meld] = None
        hand = player.hand
        max_size = min(5, len(hand))
        for size in range(3, max_size + 1):
            for combo in itertools.combinations(hand, size):
                meld = self.validate(list(combo))
                if meld and (best is None or meld.score(self.round_event) > best.score(self.round_event)):
                    best = meld
        return best

    def _remove_tiles_from_hand(self, player: Player, used: List[Tile]) -> None:
        for t in used:
            player.hand.remove(t)

    def turn(self, player: Player) -> None:
        print(f"\n--- {player.name}'s turn ---")
        print(f"Event: {self.round_event} | Deck: {len(self.deck)} | Score: {player.score}")

        if player.bot:
            power_tiles = [t for t in player.hand if t.is_power]
            if power_tiles and random.random() < 0.35:
                chosen_power = random.choice(power_tiles)
                player.hand.remove(chosen_power)
                self.apply_power(player, chosen_power)
                return
            meld = self._best_meld(player)
            if meld:
                self._remove_tiles_from_hand(player, meld.tiles)
                self.table.append(meld)
                gained = meld.score(self.round_event)
                player.score += gained
                print(f"  {player.name} plays {meld.description()} for +{gained} points")
            else:
                player.draw(self.deck)
                print(f"  {player.name} draws a tile")
            return

        while True:
            print("Hand:", player.hand_text())
            print("Actions:", ", ".join(self.available_actions(player)))
            action = input("Choose action> ").strip().lower()

            if action == "draw":
                player.draw(self.deck)
                print("You draw 1 tile.")
                return
            if action == "pass":
                print("You pass.")
                return
            if action == "power":
                powers = [t for t in player.hand if t.is_power]
                if not powers:
                    print("No power tiles.")
                    continue
                print("Power tiles:", "  ".join(f"{i+1}:{t.label()}" for i, t in enumerate(powers)))
                pick = input("Pick power number> ").strip()
                if not pick.isdigit() or not (1 <= int(pick) <= len(powers)):
                    print("Invalid power selection.")
                    continue
                chosen_power = powers[int(pick) - 1]
                player.hand.remove(chosen_power)
                self.apply_power(player, chosen_power)
                return
            if action == "meld":
                chosen = self._human_choose_tiles(player)
                meld = self.validate(chosen)
                if not meld:
                    print("Invalid meld. Need a set or run (wildcards allowed).")
                    continue
                self._remove_tiles_from_hand(player, chosen)
                self.table.append(meld)
                gained = meld.score(self.round_event)
                player.score += gained
                print(f"You play {meld.description()} for +{gained} points")
                return

            print("Unknown action.")

    def game_over(self) -> bool:
        if any(len(p.hand) == 0 for p in self.players):
            return True
        if len(self.deck) == 0 and all(not self._best_meld(p) for p in self.players):
            return True
        return False

    def winner(self) -> Player:
        return max(self.players, key=lambda p: p.score)

    def play(self) -> None:
        print("=" * 70)
        print("RiftMeld — Build runs and sets, bend the rules, beat the bots.")
        print("Scoring favors bigger melds and current event alignment.")
        print("=" * 70)
        while not self.game_over():
            self.round_event = random.choice(self.EVENTS)
            for p in self.players:
                self.turn(p)
                if self.game_over():
                    break

        print("\n=== Final Scores ===")
        for p in sorted(self.players, key=lambda p: p.score, reverse=True):
            print(f"{p.name:10} {p.score:3} pts | {len(p.hand)} tiles left")
        champ = self.winner()
        print(f"\n🏆 Winner: {champ.name} with {champ.score} points")


if __name__ == "__main__":
    print("Welcome to RiftMeld.")
    name = input("Your name: ").strip() or "You"
    bots_raw = input("How many bots? (1-3, default 2): ").strip()
    bots = 2
    if bots_raw.isdigit() and 1 <= int(bots_raw) <= 3:
        bots = int(bots_raw)
    game = RiftMeld(name, bot_count=bots)
    game.play()
