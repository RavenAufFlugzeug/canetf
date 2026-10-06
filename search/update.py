"""Refresh every company in the database. Run from anywhere, e.g. from cron:

    python search/update.py

Exits with status 1 if any company failed, so schedulers can report it.
"""

import sys

from StockUtils import update_database

if __name__ == "__main__":
    failed = update_database()
    sys.exit(1 if failed else 0)
