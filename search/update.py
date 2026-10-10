"""Refresh every company in the database. Run from anywhere, e.g. from cron:

    python search/update.py

Exits with status 1 if any company failed, so schedulers can report it.

Run without a console (pythonw.exe, as the Windows scheduled task does), the output
is appended to update.log next to this file instead.
"""

import os
import sys
from datetime import datetime

from StockUtils import update_database

LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "update.log")

if __name__ == "__main__":
    if sys.stdout is None:  # no console to print to
        sys.stdout = sys.stderr = open(LOG_PATH, "a", encoding="utf-8")
        print(f"\n=== {datetime.now().isoformat(timespec='seconds')} ===")
    else:
        # A console using a legacy code page (e.g. GBK) can't print ✓/✗; show "?" instead of crashing.
        sys.stdout.reconfigure(errors="replace")
        sys.stderr.reconfigure(errors="replace")
    try:
        failed = update_database()
    except Exception as e:
        print(f"Update failed: {e!r}")
        failed = ["(all)"]
    sys.exit(1 if failed else 0)
