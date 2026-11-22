# WatcherX demo

Clickable Arabic (RTL) demo of WatcherX for the Second Industrial City, Riyadh. All data is synthetic and rule-based (Tier 1).

- `data-gen/`: `generate.py` builds zones, incidents, forecasts, plans and agent content as JSON (`uv run python generate.py`)
- `web/`: Next.js app (static export) that reads that JSON
- `shots/`: the 10 deck screenshots

See [HANDOFF.md](HANDOFF.md) for how to run it, the numbers for the deck and the video run sheet.
