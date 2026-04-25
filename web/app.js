const ELEMENTS = ["Sun", "Moon", "Tide", "Stone"];
const EVENTS = ["Solar Flare", "Lunar Echo", "Rising Tides", "Stonewall", "Calm"];

function tileLabel(tile) {
  if (tile.power) {
    if (tile.power === "Wildcard") return "[Joker]";
    return `[${tile.power}]`;
  }
  return `${tile.element.slice(0, 2)}-${tile.value}`;
}

class RiftMeldWeb {
  constructor() {
    this.newGame("You", 2);
  }

  newDeck() {
    const tiles = [];
    for (let d = 0; d < 2; d += 1) {
      for (const element of ELEMENTS) {
        for (let value = 1; value <= 13; value += 1) {
          tiles.push({ value, element, power: null });
        }
      }
    }
    for (let i = 0; i < 2; i += 1) tiles.push({ value: 0, element: null, power: "Wildcard" });
    for (let i = 0; i < 3; i += 1) tiles.push({ value: 0, element: null, power: "Shift" });
    for (let i = 0; i < 3; i += 1) tiles.push({ value: 0, element: null, power: "Steal" });
    for (let i = 0; i < 3; i += 1) tiles.push({ value: 0, element: null, power: "Forge" });

    for (let i = tiles.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    return tiles;
  }

  draw(player, amount = 1) {
    for (let i = 0; i < amount; i += 1) {
      if (this.deck.length === 0) return;
      player.hand.push(this.deck.pop());
    }
  }

  newGame(humanName, botCount) {
    this.deck = this.newDeck();
    this.players = [{ name: humanName, hand: [], score: 0, bot: false }];
    for (let i = 0; i < botCount; i += 1) {
      this.players.push({ name: `Bot-${i + 1}`, hand: [], score: 0, bot: true });
    }
    this.table = [];
    this.roundEvent = "Calm";
    this.gameEnded = false;
    this.selectedHandIndexes = new Set();
    this.logLines = ["New game started."];

    for (const p of this.players) this.draw(p, 14);
    this.render();
  }

  log(text) {
    this.logLines.push(text);
    if (this.logLines.length > 120) this.logLines.shift();
  }

  scoreMeld(meld) {
    let base = meld.tiles.filter((t) => t.value > 0).reduce((a, b) => a + b.value, 0);
    if (meld.kind === "run") base += 2;
    if (meld.kind === "set") base += 1;
    if (this.roundEvent === "Solar Flare" && meld.tiles.some((t) => t.element === "Sun")) base += 4;
    if (this.roundEvent === "Lunar Echo" && meld.tiles.some((t) => t.element === "Moon")) base += 4;
    if (this.roundEvent === "Rising Tides" && meld.tiles.some((t) => t.element === "Tide")) base += 4;
    if (this.roundEvent === "Stonewall" && meld.tiles.some((t) => t.element === "Stone")) base += 4;
    return base;
  }

  validate(tiles) {
    if (tiles.length < 3) return null;
    const wilds = tiles.filter((t) => t.power === "Wildcard").length;
    const regular = tiles.filter((t) => !t.power);

    if (regular.length === 0 && wilds >= 3) return { tiles, kind: "set" };

    const values = new Set(regular.map((t) => t.value));
    if (values.size <= 1) {
      const seen = new Set();
      let distinct = true;
      for (const t of regular) {
        if (seen.has(t.element)) {
          distinct = false;
          break;
        }
        seen.add(t.element);
      }
      if (distinct && regular.length + wilds >= 3) return { tiles, kind: "set" };
    }

    const elements = new Set(regular.map((t) => t.element));
    if (elements.size === 1) {
      const vals = regular.map((t) => t.value).sort((a, b) => a - b);
      let needed = 0;
      for (let i = 1; i < vals.length; i += 1) {
        const gap = vals[i] - vals[i - 1];
        if (gap === 0) {
          needed = 999;
          break;
        }
        needed += Math.max(0, gap - 1);
      }
      if (needed <= wilds) return { tiles, kind: "run" };
    }

    return null;
  }

  removeTileInstances(hand, used) {
    for (const tile of used) {
      const idx = hand.indexOf(tile);
      if (idx >= 0) hand.splice(idx, 1);
    }
  }

  applyPower(player, tile) {
    if (tile.power === "Shift") {
      this.roundEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      this.log(`⚡ ${player.name} changed event to ${this.roundEvent}`);
    } else if (tile.power === "Steal") {
      const targets = this.players.filter((p) => p !== player && p.hand.length > 0);
      if (targets.length === 0) {
        this.log(`${player.name} tried to steal, but no target was available.`);
      } else {
        const target = targets[Math.floor(Math.random() * targets.length)];
        const stolenIdx = Math.floor(Math.random() * target.hand.length);
        const [stolen] = target.hand.splice(stolenIdx, 1);
        player.hand.push(stolen);
        this.log(`🕵️ ${player.name} stole ${tileLabel(stolen)} from ${target.name}`);
      }
    } else if (tile.power === "Forge") {
      if (player.hand.length < 2) {
        this.log(`${player.name} tried to forge, but had too few tiles.`);
      } else {
        for (let i = 0; i < 2; i += 1) {
          const idx = Math.floor(Math.random() * player.hand.length);
          player.hand.splice(idx, 1);
        }
        player.hand.push({ value: 0, element: null, power: "Wildcard" });
        this.log(`🔨 ${player.name} forged a Joker.`);
      }
    }
  }

  bestMeld(player) {
    let best = null;
    const hand = player.hand;
    const maxSize = Math.min(5, hand.length);

    for (let size = 3; size <= maxSize; size += 1) {
      const idxs = Array.from({ length: size }, (_, i) => i);
      while (idxs[0] <= hand.length - size) {
        const combo = idxs.map((idx) => hand[idx]);
        const meld = this.validate(combo);
        if (meld) {
          const score = this.scoreMeld(meld);
          if (!best || score > best.score) best = { meld, score };
        }

        let p = size - 1;
        while (p >= 0 && idxs[p] === hand.length - size + p) p -= 1;
        if (p < 0) break;
        idxs[p] += 1;
        for (let q = p + 1; q < size; q += 1) idxs[q] = idxs[q - 1] + 1;
      }
    }

    return best?.meld ?? null;
  }

  canAnyMeld(player) {
    return this.bestMeld(player) !== null;
  }

  gameOver() {
    if (this.players.some((p) => p.hand.length === 0)) return true;
    if (this.deck.length === 0 && this.players.every((p) => !this.canAnyMeld(p))) return true;
    return false;
  }

  winner() {
    return [...this.players].sort((a, b) => b.score - a.score)[0];
  }

  nextBots() {
    for (let i = 1; i < this.players.length; i += 1) {
      if (this.gameEnded) return;
      this.roundEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      const p = this.players[i];
      const powerTiles = p.hand.filter((t) => t.power && t.power !== "Wildcard");

      if (powerTiles.length > 0 && Math.random() < 0.35) {
        const power = powerTiles[Math.floor(Math.random() * powerTiles.length)];
        this.removeTileInstances(p.hand, [power]);
        this.applyPower(p, power);
      } else {
        const meld = this.bestMeld(p);
        if (meld) {
          this.removeTileInstances(p.hand, meld.tiles);
          this.table.push(meld);
          const gained = this.scoreMeld(meld);
          p.score += gained;
          this.log(`${p.name} played ${meld.kind} for +${gained}`);
        } else {
          this.draw(p, 1);
          this.log(`${p.name} drew a tile.`);
        }
      }

      if (this.gameOver()) {
        this.finishGame();
      }
    }

    this.render();
  }

  finishGame() {
    this.gameEnded = true;
    const champ = this.winner();
    this.log(`🏆 Winner: ${champ.name} (${champ.score} points)`);
  }

  humanPlayMeld() {
    if (this.gameEnded) return;
    const human = this.players[0];
    const chosen = [...this.selectedHandIndexes].sort((a, b) => a - b).map((i) => human.hand[i]);
    const meld = this.validate(chosen);
    if (!meld) {
      this.log("Invalid meld. Use a run or set of 3+ tiles.");
      this.render();
      return;
    }

    this.removeTileInstances(human.hand, chosen);
    this.table.push(meld);
    const gained = this.scoreMeld(meld);
    human.score += gained;
    this.log(`You played ${meld.kind} for +${gained}`);
    this.selectedHandIndexes.clear();

    if (this.gameOver()) {
      this.finishGame();
    } else {
      this.nextBots();
    }
    this.render();
  }

  humanPlayPower() {
    if (this.gameEnded) return;
    const human = this.players[0];
    const selected = [...this.selectedHandIndexes];
    if (selected.length !== 1) {
      this.log("Select exactly one power tile to play.");
      this.render();
      return;
    }
    const tile = human.hand[selected[0]];
    if (!tile.power || tile.power === "Wildcard") {
      this.log("Selected tile is not a power tile.");
      this.render();
      return;
    }
    this.removeTileInstances(human.hand, [tile]);
    this.applyPower(human, tile);
    this.selectedHandIndexes.clear();

    if (this.gameOver()) {
      this.finishGame();
    } else {
      this.nextBots();
    }
    this.render();
  }

  humanDraw() {
    if (this.gameEnded) return;
    this.draw(this.players[0], 1);
    this.log("You drew 1 tile.");
    this.selectedHandIndexes.clear();

    if (this.gameOver()) {
      this.finishGame();
    } else {
      this.nextBots();
    }
    this.render();
  }

  humanPass() {
    if (this.gameEnded) return;
    this.log("You passed.");
    this.selectedHandIndexes.clear();
    this.nextBots();
  }

  render() {
    const human = this.players[0];

    document.getElementById("status").innerHTML = `<strong>Event:</strong> ${this.roundEvent} &nbsp; | &nbsp; <strong>Deck:</strong> ${this.deck.length}`;

    document.getElementById("scoreboard").innerHTML = `<div class="status-grid">${this.players
      .map((p) => `<div><strong>${p.name}</strong><br/>${p.score} pts<br/><small>${p.hand.length} tiles</small></div>`)
      .join("")}</div>`;

    const handEl = document.getElementById("hand");
    handEl.innerHTML = "";
    human.hand.forEach((tile, idx) => {
      const btn = document.createElement("button");
      btn.className = `tile selectable ${this.selectedHandIndexes.has(idx) ? "selected" : ""}`;
      btn.textContent = `${idx + 1}:${tileLabel(tile)}`;
      btn.addEventListener("click", () => {
        if (this.selectedHandIndexes.has(idx)) this.selectedHandIndexes.delete(idx);
        else this.selectedHandIndexes.add(idx);
        this.render();
      });
      handEl.appendChild(btn);
    });

    document.getElementById("tableMelds").innerHTML = this.table
      .map((meld) => `<div class="tile">${meld.kind.toUpperCase()}: ${meld.tiles.map(tileLabel).join(" ")}</div>`)
      .join("");

    document.getElementById("log").textContent = this.logLines.join("\n");

    document.getElementById("playMeldBtn").disabled = this.gameEnded;
    document.getElementById("playPowerBtn").disabled = this.gameEnded;
    document.getElementById("drawBtn").disabled = this.gameEnded;
    document.getElementById("passBtn").disabled = this.gameEnded;
  }
}

const game = new RiftMeldWeb();

document.getElementById("newGameBtn").addEventListener("click", () => {
  const name = document.getElementById("playerName").value.trim() || "You";
  const bots = Number(document.getElementById("botCount").value || "2");
  game.newGame(name, bots);
});

document.getElementById("playMeldBtn").addEventListener("click", () => game.humanPlayMeld());
document.getElementById("playPowerBtn").addEventListener("click", () => game.humanPlayPower());
document.getElementById("drawBtn").addEventListener("click", () => game.humanDraw());
document.getElementById("passBtn").addEventListener("click", () => game.humanPass());

game.render();
