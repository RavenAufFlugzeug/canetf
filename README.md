# CanETF

A Canadian ETF selector: look up ETFs and companies (price charts, key stats, what each ETF
holds), keep a watch list, and build an investor profile.

- **Website:** Next.js 16 · React 19 · Tailwind 4 · TypeScript (`app/`, `components/`, `lib/`)
- **Data pipeline:** Python + yfinance → SQLite (`search/`), updated every hour

**Full documentation:** [docs/TECHNICAL.md](docs/TECHNICAL.md) — setup, running, scheduled
updates, databases, and things to be aware of. Product goals: [docs/CanETF_Product_Specification.md](docs/CanETF_Product_Specification.md).

## Quick start

Requires Node.js 22.5+ and Python 3.12+.

```bash
npm ci                                            # website packages

python3 -m venv .venv                             # Windows: py -m venv .venv
.venv/bin/pip install -r search/requirements.txt  # Windows: .venv\Scripts\pip ...
```

Build the database by running `search/Database.ipynb` with `REBUILD = True` (or see
[docs/TECHNICAL.md §3.3](docs/TECHNICAL.md#33-build-the-database)), then:

```bash
npm run dev                                       # http://localhost:3000
```

Keep prices current with `python search/update.py`, ideally every hour
([scheduled updates](docs/TECHNICAL.md#5-scheduled-updates)).
