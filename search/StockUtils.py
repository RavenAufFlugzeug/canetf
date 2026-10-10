"""Shared helpers: fetch stock data with yfinance and keep it in a SQLite database."""

import os
import re
import sqlite3
import time
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf

# One database shared by the notebooks, update.py and the Next.js site (lib/db.ts).
# Defaults to search/stocks.db no matter which folder you run from;
# set CANETF_DB_PATH to use a different file (the website reads the same variable).
DB_PATH = os.environ.get(
    "CANETF_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "stocks.db"),
)

# Latest quote per company, replaced on every run. Only what the other tables don't
# already hold: the open, day's range, volume and previous close are in `prices`.
QUOTES_TABLE = """
CREATE TABLE IF NOT EXISTS quotes (
    symbol     TEXT PRIMARY KEY REFERENCES companies(symbol),
    fetched_at TEXT NOT NULL,
    price      REAL,                            -- can be newer than the last daily close
    avg_volume INTEGER                          -- 3-month average daily volume
)"""
QUOTE_COLUMNS = ["symbol", "fetched_at", "price", "avg_volume"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS companies (          -- one row per company (latest info)
    symbol      TEXT PRIMARY KEY,
    name        TEXT,
    sector      TEXT,
    industry    TEXT,
    currency    TEXT,
    market_cap  REAL,
    pe_trailing REAL,
    pe_forward  REAL,
    week52_high REAL,
    week52_low  REAL,
    updated_at  TEXT
);""" + QUOTES_TABLE + """;
CREATE TABLE IF NOT EXISTS prices (             -- one row per company per day
    symbol TEXT NOT NULL REFERENCES companies(symbol),
    date   TEXT NOT NULL,
    open   REAL,
    high   REAL,
    low    REAL,
    close  REAL,
    volume INTEGER,
    PRIMARY KEY (symbol, date)
);
CREATE TABLE IF NOT EXISTS intraday (           -- 5-minute bars for the last few trading days
    symbol TEXT NOT NULL REFERENCES companies(symbol),
    ts     TEXT NOT NULL,                       -- bar start in exchange time, with UTC offset
    date   TEXT NOT NULL,                       -- trading day the bar belongs to
    open   REAL,
    high   REAL,
    low    REAL,
    close  REAL,
    volume INTEGER,
    PRIMARY KEY (symbol, ts)
);
CREATE TABLE IF NOT EXISTS etf_breakdown (      -- what an ETF is made of, replaced every run
    etf    TEXT NOT NULL REFERENCES companies(symbol),
    kind   TEXT NOT NULL,                       -- 'holding' (Yahoo lists the top 10) or 'rating'
    rank   INTEGER NOT NULL,                    -- holdings: largest first; ratings: AAA first
    label  TEXT NOT NULL,                       -- holding name, or a credit rating such as 'AAA'
    symbol TEXT,                                -- the holding's ticker, when it has one
    weight REAL NOT NULL,                       -- share of the fund, 0..1
    PRIMARY KEY (etf, kind, rank)
);
CREATE TABLE IF NOT EXISTS holding_symbols (    -- how ETF holdings map to companies here
    holding    TEXT PRIMARY KEY,                -- the ticker as an ETF's holdings list it
    symbol     TEXT,                            -- its symbol here (companies.symbol); NULL if
                                                --   Yahoo has no usable listing for it
    checked_at TEXT NOT NULL
);
"""

# (max days since the last stored price, yfinance period to download).
# Each limit is a bit shorter than its period, so the download always overlaps the data we already have.
UPDATE_STEPS = [(1, "1d"), (7, "5d"), (28, "1mo"), (89, "3mo"), (180, "6mo"), (360, "1y")]

# Intraday bars behind the website's 1D and 5D charts. Replaced in full on every refresh.
INTRADAY_PERIOD, INTRADAY_INTERVAL = "5d", "5m"

# Keeping update_database within Yahoo's rate limits. Prices are refreshed every run (two
# requests per company); the profile (name, market cap, 52-week range, average volume) and
# an ETF's composition change slowly and cost several more requests, so each company gets
# those once PROFILE_MAX_AGE has passed, at most PROFILES_PER_RUN per run (oldest first).
PROFILE_MAX_AGE = timedelta(hours=20)
PROFILES_PER_RUN = 60
UPDATE_PAUSE_SECONDS = 0.3       # between companies
RATE_LIMIT_WAIT_SECONDS = 60     # before retrying the companies that failed

# New ETF holdings (after a composition changes) are added at most this many per run;
# holdings Yahoo has no usable listing for are looked up again after UNRESOLVED_RECHECK.
HOLDINGS_PER_RUN = 15
UNRESOLVED_RECHECK = timedelta(days=30)


# ---------------------------------------------------------------------------
# Fetching data from Yahoo Finance
# ---------------------------------------------------------------------------
def _get_info(ticker):
    """Full Yahoo profile -> dict, or {} when Yahoo blocks .info (fast_info still works)."""
    try:
        return ticker.info
    except Exception:
        return {}


def get_quote(symbol, info=None):
    """Current price and change vs. the previous close -> dict.

    Pass `info` (a Ticker's .info) to reuse it instead of downloading it again.
    """
    t = yf.Ticker(symbol)
    fi = t.fast_info
    info = _get_info(t) if info is None else info
    price, prev = fi["last_price"], fi["previous_close"]
    if price is None or prev is None:
        raise ValueError(f"No quote found for '{symbol}'. Try search_symbol('company name').")
    return {
        "symbol": symbol.upper(),
        "price": price,
        "change": price - prev,
        "change_pct": (price - prev) / prev * 100,
        "open": fi["open"],
        "day_high": fi["day_high"],
        "day_low": fi["day_low"],
        "prev_close": prev,
        "volume": fi["last_volume"],
        "currency": fi["currency"],
        "avg_volume": info.get("averageVolume") or fi["three_month_average_volume"],
    }


def get_company_info(symbol, info=None):
    """Company profile and key stats -> dict. Missing values are None.

    Pass `info` (a Ticker's .info) to reuse it instead of downloading it again.
    """
    t = yf.Ticker(symbol)
    info = _get_info(t) if info is None else info  # fast_info covers the basics if it's {}
    fi = t.fast_info
    return {
        "symbol": symbol.upper(),
        "name": info.get("longName") or info.get("shortName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "currency": info.get("currency") or fi["currency"],
        "market_cap": info.get("marketCap") or fi["market_cap"],
        "pe_trailing": info.get("trailingPE"),
        "pe_forward": info.get("forwardPE"),
        "week52_high": info.get("fiftyTwoWeekHigh") or fi["year_high"],
        "week52_low": info.get("fiftyTwoWeekLow") or fi["year_low"],
    }


def get_history(symbol, period="1y", interval="1d", start=None, end=None):
    """Historical OHLCV prices -> DataFrame indexed by date (oldest first).

    Use either `period` ("5d", "1mo", "6mo", "1y", "5y", "max") or `start`/`end`
    ("YYYY-MM-DD"). `interval` can be "1m", "5m", "1h", "1d", "1wk", "1mo".
    """
    t = yf.Ticker(symbol)
    if start:
        df = t.history(start=start, end=end, interval=interval, auto_adjust=False)
    else:
        df = t.history(period=period, interval=interval, auto_adjust=False)
    if df.empty:
        raise ValueError(f"No history found for '{symbol}'. Check the ticker.")
    return df[["Open", "High", "Low", "Close", "Volume"]]


# Yahoo's bond credit-quality keys, best first ('us_government' is left out: it overlaps
# the ratings rather than adding to them).
BOND_RATINGS = [("aaa", "AAA"), ("aa", "AA"), ("a", "A"), ("bbb", "BBB"), ("bb", "BB"),
                ("b", "B"), ("below_b", "Below B"), ("other", "Other")]


def get_etf_breakdown(symbol):
    """What an ETF is made of -> [(kind, label, symbol, weight), ...], or None.

    Its top holdings when Yahoo lists them (it gives the largest 10); for bond funds,
    whose holdings it usually doesn't list, the split by credit rating instead.
    Weights are shares of the whole fund (0..1).
    """
    funds = yf.Ticker(symbol).funds_data
    top = funds.top_holdings
    if top is not None and not top.empty:
        return [("holding", row["Name"] or sym, sym, float(row["Holding Percent"]))
                for sym, row in top.iterrows() if _num(row["Holding Percent"])]
    ratings = funds.bond_ratings or {}
    split = [("rating", label, None, float(ratings[key]))
             for key, label in BOND_RATINGS if _num(ratings.get(key))]
    return split or None


def search_symbol(name):
    """Find tickers by company name -> DataFrame."""
    quotes = yf.Search(name, max_results=10).quotes
    df = pd.DataFrame(quotes)
    cols = [c for c in ["symbol", "shortname", "quoteType", "exchDisp"] if c in df.columns]
    return df[cols] if not df.empty else df


# ---------------------------------------------------------------------------
# Saving to the database
# ---------------------------------------------------------------------------
def _num(x, cast=float):
    """Turn numpy values / None / NaN into plain Python types SQLite accepts."""
    return None if x is None or pd.isna(x) else cast(x)


def _migrate_quotes(conn):
    """Bring an older quotes table to the current columns (QUOTE_COLUMNS).

    Older layouts gained a row every run (with an `id`), repeated columns that `prices`
    holds, or had bid/ask columns. Keep each company's latest quote with the current
    columns; any it lacked become NULL and any extra ones are dropped.
    """
    old = [row[1] for row in conn.execute("PRAGMA table_info(quotes)")]
    if old == QUOTE_COLUMNS:
        return
    columns = ", ".join(QUOTE_COLUMNS)
    picked = ", ".join(c if c in old else f"NULL AS {c}" for c in QUOTE_COLUMNS)
    latest = ("WHERE id = (SELECT MAX(id) FROM quotes_old WHERE symbol = q.symbol)"
              if "id" in old else "")
    conn.execute("BEGIN")
    try:
        conn.execute("ALTER TABLE quotes RENAME TO quotes_old")
        conn.execute(QUOTES_TABLE)
        conn.execute(f"""INSERT INTO quotes ({columns})
                         SELECT {picked} FROM quotes_old q {latest}""")
        conn.execute("DROP TABLE quotes_old")
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def init_db(db_path=DB_PATH):
    """Create the database file and tables if they don't exist -> connection."""
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)
    _migrate_quotes(conn)
    conn.commit()
    return conn


def save_company(conn, info):
    """Insert or update a company. A missing value never erases an older one."""
    conn.execute(
        """INSERT INTO companies (symbol, name, sector, industry, currency, market_cap,
                                  pe_trailing, pe_forward, week52_high, week52_low, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(symbol) DO UPDATE SET
               name        = COALESCE(excluded.name, name),
               sector      = COALESCE(excluded.sector, sector),
               industry    = COALESCE(excluded.industry, industry),
               currency    = COALESCE(excluded.currency, currency),
               market_cap  = COALESCE(excluded.market_cap, market_cap),
               pe_trailing = COALESCE(excluded.pe_trailing, pe_trailing),
               pe_forward  = COALESCE(excluded.pe_forward, pe_forward),
               week52_high = COALESCE(excluded.week52_high, week52_high),
               week52_low  = COALESCE(excluded.week52_low, week52_low),
               updated_at  = excluded.updated_at""",
        (info["symbol"], info["name"], info["sector"], info["industry"], info["currency"],
         _num(info["market_cap"]), _num(info["pe_trailing"]), _num(info["pe_forward"]),
         _num(info["week52_high"]), _num(info["week52_low"]),
         datetime.now().isoformat(timespec="seconds")))


def save_quote(conn, symbol, price, avg_volume=None):
    """Store a company's latest price, replacing the previous one.

    Only what no other table holds (the open, day's range, volume and previous close are
    in `prices`). Without an `avg_volume` the stored one is kept.
    """
    conn.execute(
        """INSERT INTO quotes (symbol, fetched_at, price, avg_volume) VALUES (?, ?, ?, ?)
           ON CONFLICT(symbol) DO UPDATE SET
               fetched_at = excluded.fetched_at,
               price      = excluded.price,
               avg_volume = COALESCE(excluded.avg_volume, avg_volume)""",
        (symbol.upper(), datetime.now().isoformat(timespec="seconds"), _num(price),
         _num(avg_volume, int)))


def save_prices(conn, symbol, df):
    """Save daily bars. Re-running replaces existing days, so no duplicates."""
    symbol = symbol.upper()
    rows = [(symbol, r.Index.strftime("%Y-%m-%d"), _num(r.Open), _num(r.High),
             _num(r.Low), _num(r.Close), _num(r.Volume, int))
            for r in df.itertuples()]
    conn.executemany(
        "INSERT OR REPLACE INTO prices (symbol, date, open, high, low, close, volume) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)", rows)
    return len(rows)


def save_intraday(conn, symbol, df):
    """Replace a company's intraday bars with `df` (a tz-aware index, as yfinance returns)."""
    symbol = symbol.upper()
    rows = [(symbol, r.Index.isoformat(), r.Index.strftime("%Y-%m-%d"), _num(r.Open),
             _num(r.High), _num(r.Low), _num(r.Close), _num(r.Volume, int))
            for r in df.itertuples()]
    conn.execute("DELETE FROM intraday WHERE symbol = ?", (symbol,))
    conn.executemany(
        "INSERT INTO intraday (symbol, ts, date, open, high, low, close, volume) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows)
    return len(rows)


def _get_intraday(symbol):
    """Recent intraday bars, or None if Yahoo has none (the old bars are then kept)."""
    try:
        return get_history(symbol, period=INTRADAY_PERIOD, interval=INTRADAY_INTERVAL)
    except ValueError:
        return None


def save_etf_breakdown(conn, symbol, rows):
    """Replace an ETF's breakdown with `rows` from get_etf_breakdown."""
    symbol = symbol.upper()
    conn.execute("DELETE FROM etf_breakdown WHERE etf = ?", (symbol,))
    conn.executemany(
        "INSERT INTO etf_breakdown (etf, kind, rank, label, symbol, weight) VALUES (?, ?, ?, ?, ?, ?)",
        [(symbol, kind, rank, label, sym, weight)
         for rank, (kind, label, sym, weight) in enumerate(rows, start=1)])


def _get_etf_breakdown(symbol, raw_info):
    """The breakdown for ETFs, or None (not an ETF, or Yahoo has none: the old one is kept).

    Also tried when the quote type is unknown (Yahoo blocked .info), so an ETF never
    misses its update because of that.
    """
    if raw_info.get("quoteType") not in (None, "ETF"):
        return None
    try:
        return get_etf_breakdown(symbol)
    except Exception:
        return None


def _composition_note(conn, symbol, raw_info, breakdown):
    """What an ETF's composition looks like after a refresh -> (note, missing), or (None, False)
    for companies. `missing` is True when the ETF has no composition stored at all."""
    if breakdown is not None:
        kind = "holdings" if breakdown[0][0] == "holding" else "credit ratings"
        return f"composition: {len(breakdown)} {kind}", False
    if raw_info.get("quoteType") != "ETF":
        return None, False
    stored = conn.execute("SELECT COUNT(*) FROM etf_breakdown WHERE etf = ?", (symbol,)).fetchone()[0]
    if stored:
        return "composition: none from Yahoo this time, kept the previous one", False
    return "composition: none from Yahoo", True


def _refresh_company(conn, symbol, period, replace_prices=False, profile=True):
    """Download one company and store it -> (info, rows saved, composition note, missing).

    Prices (daily and intraday) and the latest price are always refreshed. With `profile`
    the company's profile and, for ETFs, its composition are refreshed too; they cost
    more requests, so update_database asks for them only about once a day. `info` is
    None without `profile`. For ETFs the note describes the composition saved (see
    _composition_note); `missing` is True for an ETF with no composition at all.

    Everything is downloaded before anything is written, and the writes are
    all-or-nothing, so a failure leaves the company's existing data untouched.
    This is the single place where a company is fetched and saved; both
    build_database and update_database use it.
    """
    history = get_history(symbol, period=period, interval="1d")
    intraday = _get_intraday(symbol)
    raw_info = _get_info(yf.Ticker(symbol)) if profile else {}
    info = get_company_info(symbol, raw_info) if profile else None
    breakdown = _get_etf_breakdown(symbol, raw_info) if profile else None
    # The latest daily bar's close is the current price while the market is open.
    price = history["Close"].iloc[-1]
    avg_volume = raw_info.get("averageVolume")
    if profile and not avg_volume and len(history) >= 63:      # ~3 months of trading days
        avg_volume = history["Volume"].tail(63).mean()
    try:
        if replace_prices:
            conn.execute("DELETE FROM prices WHERE symbol = ?", (symbol,))
        if info:
            save_company(conn, info)      # company row first
        save_quote(conn, symbol, price, avg_volume)
        n = save_prices(conn, symbol, history)
        if intraday is not None:
            save_intraday(conn, symbol, intraday)
        if breakdown is not None:
            save_etf_breakdown(conn, symbol, breakdown)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    note, missing = (_composition_note(conn, symbol.upper(), raw_info, breakdown)
                     if profile else (None, False))
    return info, n, note, missing


def _report_missing(missing):
    if missing:
        print(f"⚠ No composition from Yahoo for these ETFs: {missing}")


# ---------------------------------------------------------------------------
# Building, inspecting and updating the database
# ---------------------------------------------------------------------------
def build_database(symbols, db_path=DB_PATH, period="1y"):
    """Fetch every company in `symbols` and store it in the database.

    Returns the list of symbols that failed (empty if everything worked).
    """
    conn = init_db(db_path)
    failed, missing = [], []
    try:
        for symbol in symbols:
            symbol = symbol.strip().upper()
            try:
                info, n, note, no_composition = _refresh_company(conn, symbol, period)
                print(f"✓ {symbol}: {info['name'] or 'n/a'} | {n} daily rows saved"
                      + (f" | {note}" if note else ""))
                if no_composition:
                    missing.append(symbol)
            except Exception as e:
                failed.append(symbol)
                print(f"✗ {symbol}: {e}")
    finally:
        conn.close()
    print(f"\nDone. Database: {db_path}" + (f" | Failed: {failed}" if failed else ""))
    _report_missing(missing)
    return failed


def _ago(ts):
    """Readable age of a timestamp, e.g. '3 hours ago'."""
    if pd.isna(ts):
        return "n/a"
    secs = (pd.Timestamp.now() - ts).total_seconds()
    if secs < 90:
        return "just now"
    for unit, size in (("day", 86400), ("hour", 3600), ("minute", 60)):
        if secs >= size:
            n = int(secs // size)
            return f"{n} {unit}{'s' if n != 1 else ''} ago"


def list_companies(db_path=DB_PATH):
    """Companies stored in the database and when each was last updated -> DataFrame."""
    if not os.path.exists(db_path):
        print(f"No database found at '{db_path}'. Run build_database first.")
        return pd.DataFrame()

    conn = sqlite3.connect(db_path)
    try:
        df = pd.read_sql(
            """SELECT c.symbol, c.name, c.sector,
                      c.updated_at                                           AS last_updated,
                      (SELECT MAX(fetched_at) FROM quotes q WHERE q.symbol = c.symbol) AS last_quote,
                      (SELECT COUNT(*)  FROM prices p WHERE p.symbol = c.symbol)       AS price_days,
                      (SELECT MIN(date) FROM prices p WHERE p.symbol = c.symbol)       AS history_from,
                      (SELECT MAX(date) FROM prices p WHERE p.symbol = c.symbol)       AS history_to
               FROM companies c
               ORDER BY c.symbol""", conn)
    except (sqlite3.OperationalError, pd.errors.DatabaseError):
        print("The database exists but has no tables yet. Run build_database first.")
        return pd.DataFrame()
    finally:
        conn.close()

    if df.empty:
        print("The database has no companies yet. Run build_database first.")
        return df

    df["last_updated"] = pd.to_datetime(df["last_updated"])
    df.insert(4, "updated", df["last_updated"].map(_ago))
    return df


def missing_holdings(db_path=DB_PATH):
    """ETF holdings with no company in the database -> DataFrame.

    `status` says why: 'new' (not looked up yet; update_database adds these a few per
    run) or 'no listing' (Yahoo has no usable listing, e.g. a private company).
    Holdings stored under another symbol (TD as TD.TO) don't count as missing.
    """
    conn = init_db(db_path)
    try:
        return pd.read_sql(
            """SELECT b.symbol, MIN(b.label) AS name, GROUP_CONCAT(b.etf, ', ') AS held_by,
                      CASE WHEN h.holding IS NULL THEN 'new' ELSE 'no listing' END AS status
               FROM etf_breakdown b
               LEFT JOIN holding_symbols h ON h.holding = b.symbol
               WHERE b.kind = 'holding' AND b.symbol IS NOT NULL
                 AND b.symbol NOT IN (SELECT symbol FROM companies)
                 AND (h.symbol IS NULL OR h.symbol NOT IN (SELECT symbol FROM companies))
               GROUP BY b.symbol ORDER BY status, b.symbol""", conn)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Adding the companies (and funds) that ETFs hold
# ---------------------------------------------------------------------------
def _holding_variants(holding):
    """Ways Yahoo may spell a ticker as ETF holdings lists give it, most likely first."""
    out = [holding]
    m = re.fullmatch(r"([A-Z]+)\.(PR|PF)\.([A-Z])", holding)      # TRP.PR.D -> TRP-PD.TO
    if m:
        base, kind, series = m.groups()
        out.append(f"{base}-P{series}.TO" if kind == "PR" else f"{base}-PF{series}.TO")
    m = re.fullmatch(r"([A-Z]+)\.([A-Z]{1,2})", holding)           # CCL.B -> CCL-B.TO, BIP.UN
    if m:
        out += [f"{m.group(1)}-{m.group(2)}.TO", f"{m.group(1)}-{m.group(2)}"]
    if holding.endswith(".KQ"):                                     # Samsung is on KOSPI (.KS)
        out.append(holding[:-3] + ".KS")
    if re.fullmatch(r"\d{6}", holding):                             # Korean code without suffix
        out += [holding + ".KS", holding + ".KQ"]
    if re.fullmatch(r"\d{5}", holding):                             # 00939 -> 0939.HK
        out.append(holding[1:] + ".HK")
    return out


def _check_listing(symbol):
    """Yahoo's view of a ticker -> dict, or None if it isn't a priced stock or ETF."""
    try:
        t = yf.Ticker(symbol)
        info = t.info or {}
        if info.get("quoteType") not in ("EQUITY", "ETF") or len(t.history(period="1mo")) < 10:
            return None
    except Exception:
        return None
    return {"symbol": symbol, "type": info["quoteType"], "country": info.get("country"),
            "name": info.get("longName") or info.get("shortName")}


def resolve_holding(conn, holding):
    """The symbol to store an ETF holding under -> str, or None if Yahoo has no listing.

    The same rules as holding_companies.py: Yahoo's spelling (TRP.PR.D -> TRP-PD.TO), a
    Canadian company's TSX listing rather than its US one (TD -> TD.TO), and a company
    already here under another listing or share class maps to that one (a preferred
    share to the common shares, GOOG to GOOGL).
    """
    listing = None
    for candidate in _holding_variants(holding):
        listing = _check_listing(candidate)
        if listing:
            break
        time.sleep(UPDATE_PAUSE_SECONDS)
    if not listing:
        return None
    symbol = listing["symbol"]
    if (listing["type"] == "EQUITY" and listing["country"] == "Canada"
            and "." not in symbol and "-" not in symbol):
        tsx = _check_listing(symbol + ".TO")
        if tsx and tsx["type"] == "EQUITY":
            symbol, listing = tsx["symbol"], tsx
    have = {r[0] for r in conn.execute("SELECT symbol FROM companies")}
    preferred = re.fullmatch(r"([A-Z]+)-P[A-Z]{1,2}\.TO", symbol)
    if preferred and f"{preferred.group(1)}.TO" in have:
        return f"{preferred.group(1)}.TO"
    if listing["name"] and symbol not in have:
        same = conn.execute("SELECT symbol FROM companies WHERE LOWER(name) = LOWER(?)",
                            (listing["name"],)).fetchone()
        if same:
            return same[0]
    return symbol


def add_missing_holdings(db_path=DB_PATH, limit=HOLDINGS_PER_RUN, conn=None):
    """Add the companies and funds ETFs hold that aren't in the database yet.

    Looks up at most `limit` holdings (None: all), remembers how each maps to a symbol
    here (holding_symbols), and builds the new ones like build_database does. A fund added
    this way gets its own composition, whose holdings are picked up by a later call.
    Returns the symbols added.
    """
    own = conn is None
    conn = conn or init_db(db_path)
    recheck = (datetime.now() - UNRESOLVED_RECHECK).isoformat(timespec="seconds")
    try:
        pending = [r[0] for r in conn.execute(
            """SELECT DISTINCT b.symbol FROM etf_breakdown b
               WHERE b.kind = 'holding' AND b.symbol IS NOT NULL
                 AND b.symbol NOT IN (SELECT symbol FROM companies)
                 AND b.symbol NOT IN (SELECT holding FROM holding_symbols
                                      WHERE symbol IS NOT NULL OR checked_at > ?)
               ORDER BY b.symbol""", (recheck,))]
        added = []
        for holding in pending[:limit]:
            target = resolve_holding(conn, holding)
            exists = target and conn.execute(
                "SELECT 1 FROM companies WHERE symbol = ?", (target,)).fetchone()
            if target and not exists:
                try:
                    info, n, note, _ = _refresh_company(conn, target, "1y")
                    added.append(target)
                    print(f"+ {target}: {info['name'] or 'n/a'} (held as {holding}) | "
                          f"{n} daily rows saved" + (f" | {note}" if note else ""))
                except Exception as e:
                    print(f"✗ {target} (held as {holding}): {e}")
                    continue      # not recorded, so it is tried again next time
            elif not target:
                print(f"- {holding}: no usable listing on Yahoo, will look again later")
            conn.execute("INSERT OR REPLACE INTO holding_symbols VALUES (?, ?, ?)",
                         (holding, target, datetime.now().isoformat(timespec="seconds")))
            conn.commit()
            time.sleep(UPDATE_PAUSE_SECONDS)
        left = len(pending) - min(len(pending), limit if limit is not None else len(pending))
        if added or left:
            print(f"Added {len(added)} held companies/funds" + (f"; {left} left for later runs" if left else ""))
        return added
    finally:
        if own:
            conn.close()


def choose_period(last_price_date, today=None):
    """Smallest period that covers the gap since the last stored day.

    Returns a yfinance period ("1d", "5d", "1mo", ...) or None, meaning the gap is too big
    (or there is no data) and the company should be refreshed from scratch.
    """
    if last_price_date is None:
        return None
    today = today or datetime.now().date()
    days_back = (today - last_price_date).days + 1   # +1: re-download the last stored day too
    for max_days, period in UPDATE_STEPS:
        if days_back <= max_days:
            return period
    return None


def _update_one(conn, row, full_period, profile):
    """Refresh one company for update_database -> (log line, missing composition)."""
    last = pd.to_datetime(row.history_to).date() if pd.notna(row.history_to) else None
    period = choose_period(last)
    full_refresh = period is None
    period = period or full_period
    _, n, note, no_composition = _refresh_company(
        conn, row.symbol, period, replace_prices=full_refresh, profile=profile)
    what = f"full refresh ({period})" if full_refresh else f"downloaded {period}"
    extra = " | profile refreshed" if profile else ""
    return (f"✓ {row.symbol}: last data {last or 'none'} -> {what}, {n} rows saved{extra}"
            + (f" | {note}" if note else "")), no_composition


def update_database(db_path=DB_PATH, full_period="1y"):
    """Refresh every company in the database, downloading only what's missing.

    Prices are refreshed for every company; profiles and ETF compositions only for the
    companies whose profile is older than PROFILE_MAX_AGE (at most PROFILES_PER_RUN,
    oldest first), which keeps each run within Yahoo's rate limits. Companies that fail
    are retried once after RATE_LIMIT_WAIT_SECONDS.

    If a company's data is more than about a year old (or it has no prices), its price
    history is dropped and downloaded again using `full_period`.
    Returns the list of symbols that failed (empty if everything worked).
    """
    stored = list_companies(db_path)        # also prints a message if there's nothing to update
    if stored.empty:
        return []

    cutoff = pd.Timestamp(datetime.now() - PROFILE_MAX_AGE)
    stale = stored[stored["last_updated"].isna() | (stored["last_updated"] < cutoff)]
    due = set(stale.sort_values("last_updated", na_position="first")
              .head(PROFILES_PER_RUN)["symbol"])

    conn = init_db(db_path)
    failed, missing = [], []
    print(f"Updating {len(stored)} companies ({len(due)} profiles and compositions due)\n")
    try:
        for attempt in (1, 2):
            rows = (stored if attempt == 1
                    else stored[stored["symbol"].isin(failed)])
            if attempt == 2:
                if not failed:
                    break
                print(f"\nRetrying {len(failed)} that failed, after {RATE_LIMIT_WAIT_SECONDS}s "
                      "(usually Yahoo's rate limit)\n")
                time.sleep(RATE_LIMIT_WAIT_SECONDS)
                failed = []
            for row in rows.itertuples():
                try:
                    line, no_composition = _update_one(
                        conn, row, full_period, profile=row.symbol in due)
                    print(line)
                    if no_composition:
                        missing.append(row.symbol)
                except Exception as e:
                    failed.append(row.symbol)
                    print(f"✗ {row.symbol}: {e}")
                time.sleep(UPDATE_PAUSE_SECONDS)
        print()
        add_missing_holdings(conn=conn)       # new holdings after compositions change
    finally:
        conn.close()
    print("\nDone." + (f" Failed: {failed}" if failed else ""))
    _report_missing(missing)
    return failed