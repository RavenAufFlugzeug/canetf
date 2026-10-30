"""The exchange rates in the database (build them with build_database(FX_PAIRS)).

Foreign exchange as a product of its own, beside companies and ETFs: every pair among the
eight major currencies, both ways round (USDCAD=X, how many Canadian dollars one US dollar
buys, and CADUSD=X), and each other common currency against the Canadian and US dollars,
both ways round. Yahoo lacks a few of those (UNAVAILABLE); the pair the other way round
is there for each. Stored like a company, with category 'Currency' (see get_company_info).
"""

from itertools import permutations

# Each currency's name, for the pairs' names (so a search for "yen" finds JPY/CAD).
CURRENCY_NAMES = {
    "CAD": "Canadian Dollar",
    "USD": "US Dollar",
    "EUR": "Euro",
    "GBP": "British Pound",
    "CHF": "Swiss Franc",
    "JPY": "Japanese Yen",
    "AUD": "Australian Dollar",
    "HKD": "Hong Kong Dollar",
    "CNY": "Chinese Yuan",
    "INR": "Indian Rupee",
    "KRW": "South Korean Won",
    "TWD": "New Taiwan Dollar",
    "SGD": "Singapore Dollar",
    "AED": "UAE Dirham",
    "MXN": "Mexican Peso",
    "NZD": "New Zealand Dollar",
    "SEK": "Swedish Krona",
    "NOK": "Norwegian Krone",
    "DKK": "Danish Krone",
    "ZAR": "South African Rand",
    "BRL": "Brazilian Real",
    "ILS": "Israeli New Shekel",
}

# The majors, traded against one another; the others, against the Canadian and US dollars.
MAJORS = ["USD", "EUR", "JPY", "GBP", "CHF", "AUD", "CAD", "NZD"]
OTHERS = ["HKD", "CNY", "INR", "KRW", "TWD", "SGD", "AED", "MXN", "SEK", "NOK", "DKK", "ZAR",
          "BRL", "ILS"]

# Pairs Yahoo has no prices for (checked October 2026); each is there the other way round.
UNAVAILABLE = {"SGDCAD=X", "NOKCAD=X", "DKKCAD=X", "BRLCAD=X", "ILSCAD=X"}

FX_PAIRS = [f"{a}{b}=X" for a, b in permutations(MAJORS, 2)] + [
    f"{a}{b}=X" for c in OTHERS for d in ("CAD", "USD") for a, b in ((c, d), (d, c))
]
FX_PAIRS = [p for p in FX_PAIRS if p not in UNAVAILABLE]       # 107 pairs


def is_fx(symbol):
    """Whether a symbol is a currency pair (Yahoo writes them as USDCAD=X)."""
    return symbol.upper().endswith("=X")


def pair_name(symbol):
    """A pair's name, e.g. 'US Dollar to Canadian Dollar (USD/CAD)'."""
    base, quote = symbol[:3].upper(), symbol[3:6].upper()
    named = lambda c: CURRENCY_NAMES.get(c, c)
    return f"{named(base)} to {named(quote)} ({base}/{quote})"
