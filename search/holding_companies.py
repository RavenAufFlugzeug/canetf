"""Companies held by the ETFs in etfs.py that weren't otherwise in the database.

Each was resolved to a Yahoo ticker with a year of prices: preferred shares use Yahoo's
spelling (TRP.PR.D -> TRP-PD.TO), Canadian companies their TSX listing, and a company
appears once even if an ETF holds several of its share classes.
Find holdings that are still missing with missing_holdings() in StockUtils.
"""

HOLDING_COMPANIES = [
    # Canadian companies
    "ABX.TO",     # Barrick Mining Corporation
    "AC.TO",      # Air Canada
    "ACO-X.TO",   # ATCO Ltd.
    "AEM.TO",     # Agnico Eagle Mines Limited
    "AGI.TO",     # Alamos Gold Inc.
    "ALA.TO",     # AltaGas Ltd.
    "ATD.TO",     # Alimentation Couche-Tard Inc.
    "ATH.TO",     # Athabasca Oil Corporation
    "BB.TO",      # BlackBerry Limited
    "BBD-B.TO",   # Bombardier Inc.
    "BBUC.TO",    # Brookfield Business Corporation
    "BCE.TO",     # BCE Inc.
    "BDGI.TO",    # Badger Infrastructure Solutions Ltd.
    "BDT.TO",     # Bird Construction Inc.
    "BEI-UN.TO",  # Boardwalk Real Estate Investment Trust
    "BEP-UN.TO",  # Brookfield Renewable Partners L.P.
    "BIP-UN.TO",  # Brookfield Infrastructure Partners L.P.
    "BMO.TO",     # Bank of Montreal
    "BN.TO",      # Brookfield Corporation
    "BNS.TO",     # The Bank of Nova Scotia
    "BPO-PN.TO",  # Brookfield Office Properties Inc.
    "BPO-PR.TO",  # Brookfield Office Properties Inc
    "BTE.TO",     # Baytex Energy Corp.
    "CAR-UN.TO",  # Canadian Apartment Properties Real Estate Investment Trust
    "CCL-B.TO",   # CCL Industries Inc.
    "CCO.TO",     # Cameco Corporation
    "CHP-UN.TO",  # Choice Properties Real Estate Investment Trust
    "CIGI.TO",    # Colliers International Group Inc.
    "CLS.TO",     # Celestica Inc.
    "CM.TO",      # Canadian Imperial Bank of Commerce
    "CNQ.TO",     # Canadian Natural Resources Limited
    "CNR.TO",     # Canadian National Railway Company
    "CP.TO",      # Canadian Pacific Kansas City Limited
    "CPX.TO",     # Capital Power Corporation
    "CRR-UN.TO",  # Crombie Real Estate Investment Trust
    "CRT-UN.TO",  # CT Real Estate Investment Trust
    "CSH-UN.TO",  # Chartwell Retirement Residences
    "CSU.TO",     # Constellation Software Inc.
    "CTC-A.TO",   # Canadian Tire Corporation, Limited
    "CU.TO",      # Canadian Utilities Limited
    "CVE.TO",     # Cenovus Energy Inc.
    "DIR-UN.TO",  # Dream Industrial Real Estate Investment Trust
    "DSG.TO",     # The Descartes Systems Group Inc.
    "EFX.TO",     # Enerflex Ltd.
    "EMA.TO",     # Emera Incorporated
    "EMP-A.TO",   # Empire Company Limited
    "ENB.TO",     # Enbridge Inc.
    "ENGH.TO",    # Enghouse Systems Limited
    "EQX.TO",     # Equinox Gold Corp.
    "ERO.TO",     # Ero Copper Corp.
    "FCR-UN.TO",  # First Capital Real Estate Investment Trust
    "FM.TO",      # First Quantum Minerals Ltd.
    "FNV.TO",     # Franco-Nevada Corporation
    "FSV.TO",     # FirstService Corporation
    "FTS.TO",     # Fortis Inc.
    "FVI.TO",     # Fortuna Mining Corp.
    "GEI.TO",     # Gibson Energy Inc.
    "GFL.TO",     # GFL Environmental Inc.
    "GIB-A.TO",   # CGI Inc.
    "GRT-UN.TO",  # Granite Real Estate Investment Trust
    "GWO.TO",     # Great-West Lifeco Inc.
    "H.TO",       # Hydro One Limited
    "HPS-A.TO",   # Hammond Power Solutions Inc.
    "HR-UN.TO",   # H&R Real Estate Investment Trust
    "IFC.TO",     # Intact Financial Corporation
    "IMO.TO",     # Imperial Oil Limited
    "JWEL.TO",    # Jamieson Wellness Inc.
    "K.TO",       # Kinross Gold Corporation
    "KMP-UN.TO",  # Killam Apartment REIT
    "KXS.TO",     # Kinaxis Inc.
    "L.TO",       # Loblaw Companies Limited
    "LSPD.TO",    # Lightspeed Commerce Inc.
    "LUN.TO",     # Lundin Mining Corporation
    "MFC.TO",     # Manulife Financial Corporation
    "MFI.TO",     # Maple Leaf Foods Inc.
    "MG.TO",      # Magna International Inc.
    "MRU.TO",     # Metro Inc.
    "MTL.TO",     # Mullen Group Ltd.
    "NA.TO",      # National Bank of Canada
    "NFI.TO",     # NFI Group Inc.
    "NPI.TO",     # Northland Power Inc.
    "NTR.TO",     # Nutrien Ltd.
    "NWC.TO",     # The North West Company Inc.
    "OTEX.TO",    # Open Text Corporation
    "PAAS.TO",    # Pan American Silver Corp.
    "PBH.TO",     # Premium Brands Holdings Corporation
    "PEY.TO",     # Peyto Exploration & Development Corp.
    "PMZ-UN.TO",  # Primaris Real Estate Investment Trust
    "POW.TO",     # Power Corporation of Canada
    "PPL.TO",     # Pembina Pipeline Corporation
    "PSK.TO",     # PrairieSky Royalty Ltd.
    "PWF-PP.TO",  # Power Financial Corporation
    "QBR-B.TO",   # Quebecor Inc.
    "QSR.TO",     # Restaurant Brands International Inc.
    "RBA.TO",     # RB Global, Inc.
    "REI-UN.TO",  # RioCan Real Estate Investment Trust
    "RUS.TO",     # Russel Metals Inc.
    "RY.TO",      # Royal Bank of Canada
    "SAP.TO",     # Saputo Inc.
    "SHOP.TO",    # Shopify Inc.
    "SLF.TO",     # Sun Life Financial Inc.
    "SOBO.TO",    # South Bow Corporation
    "SRU-UN.TO",  # SmartCentres Real Estate Investment Trust
    "SU.TO",      # Suncor Energy Inc.
    "TA.TO",      # TransAlta Corporation
    "TD.TO",      # The Toronto-Dominion Bank
    "TECK-B.TO",  # Teck Resources Limited
    "TIH.TO",     # Toromont Industries Ltd.
    "TKO.TO",     # Trekor Metals Limited
    "TOU.TO",     # Tourmaline Oil Corp.
    "TRP.TO",     # TC Energy Corporation
    "TVE.TO",     # Tamarack Valley Energy Ltd.
    "WCN.TO",     # Waste Connections, Inc.
    "WCP.TO",     # Whitecap Resources Inc.
    "WDO.TO",     # Wesdome Gold Mines Ltd.
    "WN.TO",      # George Weston Limited
    "WPM.TO",     # Wheaton Precious Metals Corp.
    "WTE.TO",     # Westshore Terminals Investment Corporation
    # US companies
    "ABBV",       # AbbVie Inc.
    "AMAT",       # Applied Materials, Inc.
    "AMD",        # Advanced Micro Devices, Inc.
    "AMT",        # American Tower Corporation
    "AU",         # AngloGold Ashanti plc
    "AVGO",       # Broadcom Inc.
    "BAC",        # Bank of America Corporation
    "CAT",        # Caterpillar Inc.
    "CBOE",       # Cboe Global Markets, Inc.
    "CFG",        # Citizens Financial Group, Inc.
    "CME",        # CME Group Inc.
    "COR",        # Cencora, Inc.
    "CRWD",       # CrowdStrike Holdings, Inc.
    "CSCO",       # Cisco Systems, Inc.
    "CVX",        # Chevron Corporation
    "DELL",       # Dell Technologies Inc.
    "ED",         # Consolidated Edison, Inc.
    "FITB",       # Fifth Third Bancorp
    "GEN",        # Gen Digital Inc.
    "GFI",        # Gold Fields Limited
    "GLW",        # Corning Incorporated
    "JNJ",        # Johnson & Johnson
    "JPM",        # JPMorgan Chase & Co.
    "KMI",        # Kinder Morgan, Inc.
    "LLY",        # Eli Lilly and Company
    "LNG",        # Cheniere Energy, Inc.
    "LRCX",       # Lam Research Corporation
    "MA",         # Mastercard Incorporated
    "META",       # Meta Platforms, Inc.
    "MRK",        # Merck & Co., Inc.
    "MRVL",       # Marvell Technology, Inc.
    "MS",         # Morgan Stanley
    "MSI",        # Motorola Solutions, Inc.
    "MTB",        # M&T Bank Corporation
    "MU",         # Micron Technology, Inc.
    "NEM",        # Newmont Corporation
    "NET",        # Cloudflare, Inc.
    "NGG",        # National Grid plc
    "OKE",        # ONEOK, Inc.
    "PM",         # Philip Morris International Inc.
    "PNC",        # The PNC Financial Services Group, Inc.
    "QCOM",       # QUALCOMM Incorporated
    "RF",         # Regions Financial Corporation
    "RGLD",       # Royal Gold, Inc.
    "SNOW",       # Snowflake Inc.
    "SRE",        # Sempra
    "T",          # AT&T Inc.
    "TDY",        # Teledyne Technologies Incorporated
    "TRGP",       # Targa Resources Corp.
    "TSLA",       # Tesla, Inc.
    "UBER",       # Uber Technologies, Inc.
    "USB",        # U.S. Bancorp
    "V",          # Visa Inc.
    "VZ",         # Verizon Communications Inc.
    "WFC",        # Wells Fargo & Company
    "WMB",        # The Williams Companies, Inc.
    "XOM",        # ExxonMobil Holdings Corporation
    # International companies
    "000660.KS",  # SK Hynix Inc
    "005930.KS",  # Samsung Electronics Co Ltd
    "0700.HK",    # Tencent Holdings Limited
    "0939.HK",    # China Construction Bank Corporation
    "2308.TW",    # Delta Electronics, Inc.
    "2330.TW",    # Taiwan Semiconductor Manufacturing Company Limited
    "2454.TW",    # MediaTek Inc.
    "7203.T",     # Toyota Motor Corporation
    "8306.T",     # Mitsubishi UFJ Financial Group, Inc.
    "9988.HK",    # Alibaba Group Holding Limited
    "ALV.DE",     # Allianz SE
    "ASML.AS",    # ASML Holding N.V.
    "AZN.L",      # AstraZeneca PLC
    "BHP.AX",     # BHP Group Limited
    "D05.SI",     # DBS Group Holdings Ltd
    "ENEL.MI",    # Enel SpA
    "HSBA.L",     # HSBC Holdings plc
    "ISP.MI",     # Intesa Sanpaolo S.p.A.
    "NESN.SW",    # Nestlé S.A.
    "NOVN.SW",    # Novartis AG
    "ROP.SW",     # Roche Holding AG
    "SAN.MC",     # Banco Santander, S.A.
    "SAP.DE",     # SAP SE
    "SHEL.L",     # Shell plc
    "SIE.DE",     # Siemens Aktiengesellschaft
    "TTE.PA",     # TotalEnergies SE
]
