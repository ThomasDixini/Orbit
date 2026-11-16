using Orbit.Api.Application.Investments;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Endpoints;

/// <summary>A competitor in a request or response: its name and the numbers compared.</summary>
public sealed record PeerComparisonBody(string Name, IReadOnlyDictionary<string, decimal>? Metrics = null)
{
    public PeerComparison ToPeer() =>
        PeerComparison.Create(Name, AnalysisBodies.Entries(null, Metrics, AnalysisFields.Peer));

    public static PeerComparisonBody From(PeerComparison peer) => new(peer.Name, peer.Entries.Metrics);
}

/// <summary>A scenario in a request or response: its kind, texts and numbers.</summary>
public sealed record AnalysisScenarioBody(
    ScenarioKind Kind,
    IReadOnlyDictionary<string, string>? Texts = null,
    IReadOnlyDictionary<string, decimal>? Metrics = null)
{
    public AnalysisScenario ToScenario() =>
        AnalysisScenario.Create(Kind, AnalysisBodies.Entries(Texts, Metrics, AnalysisFields.Scenario));

    public static AnalysisScenarioBody From(AnalysisScenario scenario) =>
        new(scenario.Kind, scenario.Entries.Texts, scenario.Entries.Metrics);
}

/// <summary>Body of <c>PUT /investment-analyses/{analysisId}</c>; the id comes from the route.</summary>
public sealed record SaveInvestmentAnalysisRequest(
    string InvestmentId,
    DateOnly Date,
    AnalysisRecommendation? Recommendation = null,
    IReadOnlyDictionary<string, string>? Texts = null,
    IReadOnlyDictionary<string, decimal>? Metrics = null,
    IReadOnlyList<PeerComparisonBody>? Peers = null,
    IReadOnlyList<AnalysisScenarioBody>? Scenarios = null)
{
    public SaveInvestmentAnalysisCommand ToCommand(string analysisId) =>
        new(analysisId, InvestmentId, Date, new AnalysisContent(
            Recommendation,
            AnalysisBodies.Entries(Texts, Metrics, AnalysisFields.Company),
            (Peers ?? []).Select(peer => peer.ToPeer()).ToList(),
            (Scenarios ?? []).Select(scenario => scenario.ToScenario()).ToList()));
}

public sealed record InvestmentAnalysisResponse(
    string Id,
    string InvestmentId,
    DateOnly Date,
    AnalysisRecommendation? Recommendation,
    IReadOnlyDictionary<string, string> Texts,
    IReadOnlyDictionary<string, decimal> Metrics,
    IReadOnlyList<PeerComparisonBody> Peers,
    IReadOnlyList<AnalysisScenarioBody> Scenarios)
{
    public static InvestmentAnalysisResponse From(InvestmentAnalysis analysis) =>
        new(analysis.Id, analysis.InvestmentId, analysis.Date, analysis.Content.Recommendation,
            analysis.Content.Company.Texts, analysis.Content.Company.Metrics,
            analysis.Content.Peers.Select(PeerComparisonBody.From).ToList(),
            analysis.Content.Scenarios.Select(AnalysisScenarioBody.From).ToList());
}

/// <summary>Turns the optional maps of a body into the entries of one part of an analysis.</summary>
internal static class AnalysisBodies
{
    private static readonly IReadOnlyDictionary<string, string> NoTexts = new Dictionary<string, string>();
    private static readonly IReadOnlyDictionary<string, decimal> NoMetrics = new Dictionary<string, decimal>();

    /// <summary>The entries of a part, an absent map being an empty one.</summary>
    /// <example><code>AnalysisBodies.Entries(null, metrics, AnalysisFields.Scenario);</code></example>
    public static AnalysisEntries Entries(
        IReadOnlyDictionary<string, string>? texts, IReadOnlyDictionary<string, decimal>? metrics, AnalysisFields fields) =>
        AnalysisEntries.Create(texts ?? NoTexts, metrics ?? NoMetrics, fields);
}

/// <summary>HTTP routes for the fundamental analyses of investments.</summary>
public static class InvestmentAnalysisEndpoints
{
    /// <summary>
    /// Maps <c>GET /investment-analyses</c> and <c>PUT</c>/<c>DELETE /investment-analyses/{analysisId}</c>.
    /// </summary>
    /// <example><code>app.MapInvestmentAnalysisEndpoints();</code></example>
    public static IEndpointRouteBuilder MapInvestmentAnalysisEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/investment-analyses", ListAsync);
        routes.MapPut("/investment-analyses/{analysisId}", SaveAsync);
        routes.MapDelete("/investment-analyses/{analysisId}", DeleteAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(ListInvestmentAnalyses list, CancellationToken cancellationToken)
    {
        var analyses = await list.ExecuteAsync(cancellationToken);
        return Results.Ok(analyses.Select(InvestmentAnalysisResponse.From).ToList());
    }

    private static async Task<IResult> SaveAsync(
        string analysisId, SaveInvestmentAnalysisRequest request, SaveInvestmentAnalysis save,
        CancellationToken cancellationToken)
    {
        var saved = await save.ExecuteAsync(request.ToCommand(analysisId), cancellationToken);
        return Results.Ok(InvestmentAnalysisResponse.From(saved));
    }

    private static async Task<IResult> DeleteAsync(
        string analysisId, DeleteInvestmentAnalysis delete, CancellationToken cancellationToken)
    {
        await delete.ExecuteAsync(analysisId, cancellationToken);
        return Results.NoContent();
    }
}
