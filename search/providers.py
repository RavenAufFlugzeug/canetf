"""The listed companies behind the ETFs' providers (build them with build_database(PROVIDERS)).

The Search page's fund section lets a provider be clicked to see the company that runs it
(lib/providers.ts maps each provider to one of these, or to none when it is privately owned:
Vanguard, Fidelity, Global X). Those already in the database for other reasons (BMO.TO,
TD.TO, MFC.TO) are listed too, so the set is complete here.
"""

PROVIDERS = [
    "BLK",        # BlackRock, Inc. (iShares; BlackRock Asset Management Canada)
    "BMO.TO",     # Bank of Montreal (BMO Asset Management)
    "TD.TO",      # The Toronto-Dominion Bank (TD Asset Management)
    "MFC.TO",     # Manulife Financial Corporation (Manufacturers Life)
    "IGM.TO",     # IGM Financial Inc. (Mackenzie Investments)
]
