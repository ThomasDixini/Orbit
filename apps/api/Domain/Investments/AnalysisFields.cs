namespace Orbit.Api.Domain.Investments;

/// <summary>
/// The fields an analysis can fill, named as the web app spells them. A field left out of a catalog is
/// refused, so a typo never becomes a value nobody reads.
/// </summary>
public sealed class AnalysisFields
{
    /// <summary>What the company part of an analysis may hold: the stock template's text and numbers.</summary>
    public static readonly AnalysisFields Company = new(
        "analysis",
        texts:
        [
            "sector", "segment", "country", "businessDescription", "thesis",
            "revenueSources", "moat", "marketPosition", "whyItCaughtAttention", "predictability",
            "managementQuality", "executiveHistory", "shareholderAlignment", "sectorLeader",
            "marketSize", "competitors", "marketShare", "entryBarriers",
            "operationalRisks", "regulatoryRisks", "marketRisks", "financialRisks", "companyRisks",
            "growthExpectations", "newProducts", "sectorTrends", "corporateEvents", "previousReview",
            "interestRates", "exchangeRate", "inflation", "economicGrowth", "unemployment",
            "cycleExposure", "monetaryPolicy", "fiscalPolicy", "internationalExposure", "macroRisks",
            "riskMitigation", "diversification", "hedges",
            "sectorOverview", "sectorGrowth", "sectorDrivers", "sectorChallenges", "sectorRegulation",
            "sectorInnovation", "peerAdvantages", "peerDisadvantages",
        ],
        metrics:
        [
            "price", "targetPrice",
            "roe", "roa", "roic", "grossMargin", "ebitdaMargin", "netMargin",
            "assetTurnover", "receivableDays", "payableDays", "inventoryTurnover",
            "netDebtToEbitda", "netDebtToEquity", "currentRatio", "interestCoverage",
            "revenueCagr", "earningsCagr", "ebitdaGrowth",
            "priceToEarnings", "priceToBook", "evToEbitda", "priceToSales", "dividendYield", "earningsPerShare",
            "operatingCashFlow", "freeCashFlow", "capex",
            "wacc", "perpetualGrowth", "estimatedEps", "intrinsicValue",
        ]);

    /// <summary>What a competitor or the sector average is compared on.</summary>
    public static readonly AnalysisFields Peer = new(
        "peer",
        texts: [],
        metrics:
        [
            "priceToEarnings", "priceToBook", "evToEbitda", "dividendYield", "roe", "roic",
            "ebitdaMargin", "netMargin", "netDebtToEbitda", "revenueGrowth",
        ]);

    /// <summary>What each scenario (base, optimistic, pessimistic) may hold.</summary>
    public static readonly AnalysisFields Scenario = new(
        "scenario",
        texts: ["thesis", "growthAssumptions", "marginAssumptions", "risks", "triggers", "notes"],
        metrics:
        [
            "probability", "revenueGrowth", "ebitdaMargin", "capexShare", "netMargin", "wacc",
            "perpetualGrowth", "valuation",
        ]);

    private readonly HashSet<string> _texts;
    private readonly HashSet<string> _metrics;

    /// <summary>Names the part in error messages, like "scenario".</summary>
    public string Part { get; }

    private AnalysisFields(string part, string[] texts, string[] metrics)
    {
        Part = part;
        _texts = new HashSet<string>(texts, StringComparer.Ordinal);
        _metrics = new HashSet<string>(metrics, StringComparer.Ordinal);
    }

    /// <summary>Tells whether the text field belongs to this part.</summary>
    /// <example><code>AnalysisFields.Company.HasText("moat"); // true</code></example>
    public bool HasText(string key) => _texts.Contains(key);

    /// <summary>Tells whether the number belongs to this part.</summary>
    /// <example><code>AnalysisFields.Peer.HasMetric("roe"); // true</code></example>
    public bool HasMetric(string key) => _metrics.Contains(key);
}
