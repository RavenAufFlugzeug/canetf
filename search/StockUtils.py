"""Shared helpers: fetch stock data with yfinance and keep it in a SQLite database."""

import os
import sqlite3
from datetime import datetime

import pandas as pd
import yfinance as yf

# One database shared by the notebooks, update.py and the Next.js site (lib/db.ts).
# Defaults to search/stocks.db no matter which folder you run from;
# set CANETF_DB_PATH to use a different file (the website reads the same variable).
DB_PATH = os.environ.get(
    "CANETF_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "stocks.db"),
)

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
);
CREATE TABLE IF NOT EXISTS quotes (             -- one row per company per run
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol     TEXT NOT NULL REFERENCES companies(symbol),
    fetched_at TEXT NOT NULL,
    price      REAL,
    change     REAL,
    change_pct REAL,
    open       REAL,
    day_high   REAL,
    day_low    REAL,
    prev_close REAL,
    volume     INTEGER,
    bid        REAL,
    bid_size   INTEGER,                         -- shares
    ask        REAL,
    ask_size   INTEGER,                         -- shares
    avg_volume INTEGER                          -- 3-month average daily volume
);
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
"""

# Columns added after the first release. CREATE TABLE IF NOT EXISTS won't add them
# to an existing database, so init_db does: {table: [(column, type), ...]}.
ADDED_COLUMNS = {
    "quotes": [("bid", "REAL"), ("bid_size", "INTEGER"), ("ask", "REAL"),
               ("ask_size", "INTEGER"), ("avg_volume", "INTEGER")],
}

# (max days since the last stored price, yfinance period to download).
# Each limit is a bit shorter than its period, so the download always overlaps the data we already have.
UPDATE_STEPS = [(1, "1d"), (7, "5d"), (28, "1mo"), (89, "3mo"), (180, "6mo"), (360, "1y")]

# Intraday bars behind the website's 1D and 5D charts. Replaced in full on every refresh.
INTRADAY_PERIOD, INTRADAY_INTERVAL = "5d", "5m"


# ---------------------------------------------------------------------------
# Fetching data from Yahoo Finance
# ---------------------------------------------------------------------------
def _get_info(ticker):
    """Full Yahoo profile -> dict, or {} when Yahoo blocks .info (fast_info still works)."""
    try:
        return ticker.info
    except Exception:
        return {}


def _lot_to_shares(size):
    """Yahoo reports bid/ask sizes in round lots of 100 shares, as its website shows them."""
    return None if size is None else size * 100


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
        "bid": info.get("bid") or None,          # 0 means no bid, e.g. outside market hours
        "bid_size": _lot_to_shares(info.get("bidSize")),
        "ask": info.get("ask") or None,
        "ask_size": _lot_to_shares(info.get("askSize")),
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


def init_db(db_path=DB_PATH):
    """Create the database file and tables if they don't exist -> connection."""
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)
    for table, columns in ADDED_COLUMNS.items():
        existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
        for name, type_ in columns:
            if name not in existing:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {type_}")
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


def save_quote(conn, q):
    """Add a new price snapshot (quotes accumulate with every run)."""
    conn.execute(
        """INSERT INTO quotes (symbol, fetched_at, price, change, change_pct, open,
                               day_high, day_low, prev_close, volume,
                               bid, bid_size, ask, ask_size, avg_volume)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (q["symbol"], datetime.now().isoformat(timespec="seconds"),
         _num(q["price"]), _num(q["change"]), _num(q["change_pct"]), _num(q["open"]),
         _num(q["day_high"]), _num(q["day_low"]), _num(q["prev_close"]),
         _num(q["volume"], int), _num(q.get("bid")), _num(q.get("bid_size"), int),
         _num(q.get("ask")), _num(q.get("ask_size"), int), _num(q.get("avg_volume"), int)))


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


def _refresh_company(conn, symbol, period, replace_prices=False):
    """Download one company and store it -> (info, rows saved).

    Everything is downloaded before anything is written, and the writes are
    all-or-nothing, so a failure leaves the company's existing data untouched.
    This is the single place where a company is fetched and saved; both
    build_database and update_database use it.
    """
    raw_info = _get_info(yf.Ticker(symbol))   # downloaded once, used by both
    info = get_company_info(symbol, raw_info)
    quote = get_quote(symbol, raw_info)
    history = get_history(symbol, period=period, interval="1d")
    intraday = _get_intraday(symbol)
    try:
        if replace_prices:
            conn.execute("DELETE FROM prices WHERE symbol = ?", (symbol,))
        save_company(conn, info)          # company row first
        save_quote(conn, quote)
        n = save_prices(conn, symbol, history)
        if intraday is not None:
            save_intraday(conn, symbol, intraday)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return info, n


# ---------------------------------------------------------------------------
# Building, inspecting and updating the database
# ---------------------------------------------------------------------------
def build_database(symbols, db_path=DB_PATH, period="1y"):
    """Fetch every company in `symbols` and store it in the database.

    Returns the list of symbols that failed (empty if everything worked).
    """
    conn = init_db(db_path)
    failed = []
    try:
        for symbol in symbols:
            symbol = symbol.strip().upper()
            try:
                info, n = _refresh_company(conn, symbol, period)
                print(f"✓ {symbol}: {info['name'] or 'n/a'} | {n} daily rows saved")
            except Exception as e:
                failed.append(symbol)
                print(f"✗ {symbol}: {e}")
    finally:
        conn.close()
    print(f"\nDone. Database: {db_path}" + (f" | Failed: {failed}" if failed else ""))
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


def update_database(db_path=DB_PATH, full_period="1y"):
    """Refresh every company in the database, downloading only what's missing.

    If a company's data is more than about a year old (or it has no prices), its price
    history is dropped and downloaded again using `full_period`.
    Returns the list of symbols that failed (empty if everything worked).
    """
    stored = list_companies(db_path)        # also prints a message if there's nothing to update
    if stored.empty:
        return []

    conn = init_db(db_path)
    failed = []
    print(f"Updating {len(stored)} companies\n")
    try:
        for row in stored.itertuples():
            symbol = row.symbol
            last = pd.to_datetime(row.history_to).date() if pd.notna(row.history_to) else None
            period = choose_period(last)
            full_refresh = period is None
            period = period or full_period
            try:
                _, n = _refresh_company(conn, symbol, period, replace_prices=full_refresh)
                what = f"full refresh ({period})" if full_refresh else f"downloaded {period}"
                print(f"✓ {symbol}: last data {last or 'none'} -> {what}, {n} rows saved")
            except Exception as e:
                failed.append(symbol)
                print(f"✗ {symbol}: {e}")
    finally:
        conn.close()
    print("\nDone." + (f" Failed: {failed}" if failed else ""))
    return failed