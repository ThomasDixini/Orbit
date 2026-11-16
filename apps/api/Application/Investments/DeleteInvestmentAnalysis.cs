using Orbit.Api.Domain;

namespace Orbit.Api.Application.Investments;

/// <summary>Deletes a fundamental analysis; deleting one already gone succeeds, so retries are harmless.</summary>
public sealed class DeleteInvestmentAnalysis(IInvestmentAnalysisRepository analyses)
{
    /// <summary>
    /// Validates the id and removes the analysis if it exists.
    /// </summary>
    /// <example><code>await deleteAnalysis.ExecuteAsync("a1", ct);</code></example>
    public Task ExecuteAsync(string analysisId, CancellationToken cancellationToken) =>
        analyses.DeleteAsync(EntityId.Require(analysisId, "investment analysis id"), cancellationToken);
}
