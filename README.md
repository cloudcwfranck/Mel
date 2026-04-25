# Mel — RiftMeld

RiftMeld now has two ways to play:

1. **Browser version (no install):** open the GitHub Pages URL after the deploy workflow runs.
2. **Terminal version (Python prototype):** run `python3 game.py` locally.

## Play in browser (no download required)

After pushing to `main`, GitHub Actions deploys `/web` to GitHub Pages.

- Workflow: `.github/workflows/deploy-pages.yml`
- Site source: `web/`
- URL pattern: `https://<your-github-username>.github.io/<repo-name>/`

### One-time repo settings

In your GitHub repo:

1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

After that, every push to `main` publishes the latest browser build automatically.

## Browser controls

- Click hand tiles to select them.
- **Play Meld**: plays selected valid set/run (3+ tiles).
- **Play Power**: select one power tile (`Shift`, `Steal`, `Forge`) and play it.
- **Draw**: draw one tile.
- **Pass**: skip turn.

## Original terminal game

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
