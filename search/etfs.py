"""The ETFs in the database, grouped by type (build them with build_database(ETFS)).

TSX listings, each checked to have a year of prices on Yahoo and a composition
(top holdings, or a bond fund's split by credit rating).
"""

ETFS = [
    # All-in-one portfolios
    "XEQT.TO",    # iShares Core Equity ETF Portfolio
    "XGRO.TO",    # iShares Core Growth ETF Portfolio
    "XBAL.TO",    # iShares Core Balanced ETF Portfolio
    "XCNS.TO",    # iShares Core Conservative Balanced ETF Portfolio
    "XINC.TO",    # iShares Core Income Balanced ETF Portfolio
    "VEQT.TO",    # Vanguard All-Equity ETF Portfolio
    "VGRO.TO",    # Vanguard Growth ETF Portfolio
    "VBAL.TO",    # Vanguard Balanced ETF Portfolio
    "VCNS.TO",    # Vanguard Conservative ETF Portfolio
    "VCIP.TO",    # Vanguard Conservative Income ETF Portfolio
    "VRIF.TO",    # Vanguard Retirement Income ETF Portfolio
    "ZEQT.TO",    # BMO All-Equity ETF
    "ZGRO.TO",    # BMO Growth ETF
    "ZBAL.TO",    # BMO Balanced ETF
    "ZCON.TO",    # BMO Conservative ETF
    "ZMI.TO",     # BMO Monthly Income ETF
    "HEQT.TO",    # Global X All-Equity Asset Allocation ETF
    "HBAL.TO",    # Global X Balanced Asset Allocation ETF
    "HCON.TO",    # Global X Conservative Asset Allocation ETF
    "TGRO.TO",    # TD Growth ETF Portfolio
    # Canadian equity
    "XIU.TO",     # iShares S&P/TSX 60 Index ETF
    "XIC.TO",     # iShares Core S&P/TSX Capped Composite Index ETF
    "VCN.TO",     # Vanguard FTSE Canada All Cap Index ETF
    "ZCN.TO",     # BMO S&P/TSX Capped Composite Index ETF
    "XCS.TO",     # iShares S&P/TSX Small Cap Index ETF
    "XMD.TO",     # iShares S&P/TSX Completion Index ETF
    "ZLB.TO",     # BMO Low Volatility Canadian Equity ETF
    "XDV.TO",     # iShares Canadian Select Dividend Index ETF
    "CDZ.TO",     # iShares S&P/TSX Canadian Dividend Aristocrats Index ETF Common Class
    "VDY.TO",     # Vanguard FTSE Canadian High Dividend Yield Index ETF
    "ZDV.TO",     # BMO Canadian Dividend ETF
    "XEI.TO",     # iShares S&P/TSX Composite High Dividend Index ETF
    "XCV.TO",     # iShares Canadian Value Index ETF
    "QCN.TO",     # Mackenzie Canadian Equity Index ETF
    "TTP.TO",     # TD Canadian Equity Index ETF
    "CDIV.TO",    # Manulife Smart Dividend ETF
    "FCCD.TO",    # Fidelity Canadian High Dividend ETF
    "XCG.TO",     # iShares Canadian Growth Index ETF
    # Canadian sectors & income
    "XFN.TO",     # iShares S&P/TSX Capped Financials Index ETF
    "ZEB.TO",     # BMO Equal Weight Banks Index ETF
    "XEG.TO",     # iShares S&P/TSX Capped Energy Index ETF
    "XGD.TO",     # iShares S&P/TSX Global Gold Index ETF
    "XMA.TO",     # iShares S&P/TSX Capped Materials Index ETF
    "XRE.TO",     # iShares S&P/TSX Capped REIT Index ETF
    "ZRE.TO",     # BMO Equal Weight REITs Index ETF
    "VRE.TO",     # Vanguard FTSE Canadian Capped REIT Index ETF
    "XIT.TO",     # iShares S&P/TSX Capped Information Technology Index ETF
    "XUT.TO",     # iShares S&P/TSX Capped Utilities Index ETF
    "ZUT.TO",     # BMO Equal Weight Utilities Index ETF
    "XST.TO",     # iShares S&P/TSX Capped Consumer Staples Index ETF
    "ZWB.TO",     # BMO Covered Call Canadian Banks ETF
    "ZWC.TO",     # BMO CA High Dividend Covered Call ETF
    "ZWU.TO",     # BMO Covered Call Utilities ETF
    "ZWH.TO",     # BMO US High Dividend Covered Call ETF
    "ZWK.TO",     # BMO Covered Call US Banks ETF
    "ZIN.TO",     # BMO Equal Weight Industrials Index ETF
    "ZGI.TO",     # BMO Global Infrastructure Index ETF
    # US equity
    "VFV.TO",     # Vanguard S&P 500 Index ETF
    "ZSP.TO",     # BMO S&P 500 Index ETF (CAD)
    "XUS.TO",     # iShares Core S&P 500 Index ETF
    "XSP.TO",     # iShares Core S&P 500 Index ETF (CAD-Hedged)
    "XUU.TO",     # iShares Core S&P U.S. Total Market Index ETF
    "VUN.TO",     # Vanguard Morningstar U.S. Total Market Index ETF
    "XQQ.TO",     # iShares NASDAQ 100 Index ETF (CAD-Hedged)
    "ZQQ.TO",     # BMO Nasdaq 100 Equity Hedged to CAD Index ETF
    "VGG.TO",     # Vanguard U.S. Dividend Appreciation Index ETF
    "ZUQ.TO",     # BMO MSCI USA High Quality Index ETF
    "ZDY.TO",     # BMO US Dividend ETF (CAD)
    "XSU.TO",     # iShares U.S. Small Cap Index ETF (CAD-Hedged)
    "ZNQ.TO",     # BMO NASDAQ 100 Equity Index ETF
    "TPU.TO",     # TD U.S. Equity Index ETF
    "QUU.TO",     # Mackenzie US Large Cap Equity Index ETF
    "VSP.TO",     # Vanguard S&P 500 Index ETF (CAD-hedged)
    "ZLU.TO",     # BMO Low Volatility US Equity ETF (CAD)
    "XMTM.TO",    # iShares MSCI USA Momentum Factor Index ETF
    # International & global
    "XEF.TO",     # iShares Core MSCI EAFE IMI Index ETF
    "VIU.TO",     # Vanguard FTSE Developed All Cap ex North Amer Idx ETF
    "ZEA.TO",     # BMO MSCI EAFE Index ETF
    "XAW.TO",     # iShares Core MSCI All Country World ex Canada Index ETF
    "VXC.TO",     # Vanguard FTSE Global All Cap ex Canada Index ETF
    "XEC.TO",     # iShares Core MSCI Emerging Markets IMI Index ETF
    "VEE.TO",     # Vanguard FTSE Emerging Markets All Cap Index ETF
    "ZEM.TO",     # BMO MSCI Emerging Markets Index ETF
    "XWD.TO",     # iShares MSCI World Index ETF
    "XEH.TO",     # iShares MSCI Europe IMI Index ETF (CAD-Hedged)
    "ZDI.TO",     # BMO International Dividend ETF
    "QDX.TO",     # Mackenzie International Equity Index ETF
    "TPE.TO",     # TD International Equity Index ETF
    "VIDY.TO",    # Vanguard FTSE Developed ex North America High Dividend Yield Index ETF
    "ZWG.TO",     # BMO Global High Dividend Covered Call ETF
    # Bonds
    "ZCS.TO",     # BMO Short Corporate Bond Index ETF
    "XBB.TO",     # iShares Core Canadian Universe Bond Index ETF
    "ZAG.TO",     # BMO Aggregate Bond Index ETF
    "VAB.TO",     # Vanguard Canadian Aggregate Bond Index ETF
    "XSB.TO",     # iShares Core Canadian Short Term Bond Index ETF
    "VSB.TO",     # Vanguard Canadian Short-Term Bond Index ETF
    "XSH.TO",     # iShares Core Canadian Short Term Corporate Bond Index ETF
    "XCB.TO",     # iShares Core Canadian Corporate Bond Index ETF
    "VSC.TO",     # Vanguard Canadian Short-Term Corporate Bond Index ETF
    "ZCM.TO",     # BMO Mid Corporate Bond Index ETF
    "XGB.TO",     # iShares Core Canadian Government Bond Index ETF
    "ZGB.TO",     # BMO Government Bond Index ETF
    "XLB.TO",     # iShares Core Canadian Long Term Bond Index ETF
    "VLB.TO",     # Vanguard Canadian Long-Term Bond Index ETF
    "ZFL.TO",     # BMO Long Federal Bond Index ETF
    "ZFS.TO",     # BMO Short Federal Bond Index ETF
    "XHY.TO",     # iShares U.S. High Yield Bond Index ETF (CAD-Hedged)
    "ZHY.TO",     # BMO High Yield US Corporate Bond Hedged to CAD Index ETF
    "XQB.TO",     # iShares High Quality Canadian Bond Index ETF Common Class
    "XRB.TO",     # iShares Canadian Real Return Bond Index ETF
    "ZPR.TO",     # BMO Laddered Preferred Share Index ETF
    "CPD.TO",     # iShares S&P/TSX Canadian Preferred Share Index ETF Common Class
    "ZST.TO",     # BMO Ultra Short-Term Bond ETF
    "ZDB.TO",     # BMO Discount Bond Index ETF
    "HBB.TO",     # Global X Canadian Select Universe Bond Index Corporate Class ETF
    "QBB.TO",     # Mackenzie Canadian Aggregate Bond Index ETF
    "TDB.TO",     # TD Canadian Aggregate Bond Index ETF
    # Themes (ESG, technology, health care)
    "XESG.TO",    # iShares ESG Aware MSCI Canada Index ETF
    "TEC.TO",     # TD Global Technology Leaders Index ETF
    "XHC.TO",     # iShares Global Healthcare Index ETF (CAD-Hedged)
]
