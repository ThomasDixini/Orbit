using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

/// <summary>Lists every fundamental analysis the user wrote about their investments.</summary>
public sealed class ListInvestmentAnalyses(IInvestmentAnalysisRepository analyses)
{
    /// <summary>
    /// The analyses, newest day first.
    /// </summary>
    /// <example><code>var all = await listAnalyses.ExecuteAsync(ct);</code></example>
    public Task<IReadOnlyList<InvestmentAnalysis>> ExecuteAsync(CancellationToken cancellationToken) =>
        analyses.ListAsync(cancellationToken);
}
