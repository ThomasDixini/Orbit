namespace Orbit.Api.Domain.Investments;

/// <summary>What a fundamental analysis holds besides its identity: the parts the user filled in.</summary>
/// <param name="Recommendation">The conclusion, if one was reached.</param>
/// <param name="Company">The company's texts and numbers (business, management, risks, macro, sector, indicators).</param>
/// <param name="Peers">The competitors and sector averages it was compared with.</param>
/// <param name="Scenarios">At most one scenario of each kind.</param>
public sealed record AnalysisContent(
    AnalysisRecommendation? Recommendation,
    AnalysisEntries Company,
    IReadOnlyList<PeerComparison> Peers,
    IReadOnlyList<AnalysisScenario> Scenarios);

/// <summary>
/// A fundamental analysis of one investment as it stood on a day. Each one is kept apart, so the analysis of
/// January and the one of June can be read side by side to see what changed.
/// </summary>
public sealed class InvestmentAnalysis
{
    public const int MaxPeers = 5;

    public string Id { get; }
    public string InvestmentId { get; }
    public DateOnly Date { get; }
    public AnalysisContent Content { get; }

    private InvestmentAnalysis(string id, string investmentId, DateOnly date, AnalysisContent content)
    {
        Id = id;
        InvestmentId = investmentId;
        Date = date;
        Content = content;
    }

    /// <summary>
    /// Builds a valid analysis: a known recommendation (or none), up to five peers and at most one scenario of
    /// each kind. The parts themselves were already checked against their catalogs.
    /// </summary>
    /// <example><code>InvestmentAnalysis.Create("a1", "totvs3", day, new AnalysisContent(AnalysisRecommendation.Buy, company, [], []));</code></example>
    public static InvestmentAnalysis Create(string id, string investmentId, DateOnly date, AnalysisContent content)
    {
        RequireRecommendation(content.Recommendation);
        RequirePeers(content.Peers);
        RequireDistinctScenarios(content.Scenarios);
        return new InvestmentAnalysis(
            EntityId.Require(id, "investment analysis id"), EntityId.Require(investmentId, "investment id"), date, content);
    }

    /// <summary>Rebuilds a stored analysis as it was saved, without today's rules.</summary>
    /// <example><code>InvestmentAnalysis.Restore("a1", "totvs3", day, content);</code></example>
    internal static InvestmentAnalysis Restore(string id, string investmentId, DateOnly date, AnalysisContent content) =>
        new(id, investmentId, date, content);

    private static void RequireRecommendation(AnalysisRecommendation? recommendation)
    {
        if (recommendation is not { } known || Enum.IsDefined(known)) return;
        throw new DomainRuleException(
            $"Expected the recommendation to be buy, hold or sell, received {(int)known}");
    }

    private static void RequirePeers(IReadOnlyList<PeerComparison> peers)
    {
        if (peers.Count <= MaxPeers) return;
        throw new DomainRuleException($"Expected at most {MaxPeers} peers, received {peers.Count}");
    }

    private static void RequireDistinctScenarios(IReadOnlyList<AnalysisScenario> scenarios)
    {
        var repeated = scenarios.GroupBy(scenario => scenario.Kind).FirstOrDefault(group => group.Count() > 1);
        if (repeated is null) return;
        throw new DomainRuleException(
            $"Expected at most one scenario of each kind, received {repeated.Count()} of kind {repeated.Key}");
    }
}
