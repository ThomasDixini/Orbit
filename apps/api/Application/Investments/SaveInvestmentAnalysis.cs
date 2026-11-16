using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

public sealed record SaveInvestmentAnalysisCommand(
    string Id, string InvestmentId, DateOnly Date, AnalysisContent Content);

/// <summary>Creates or replaces a fundamental analysis; saving twice leaves the same state.</summary>
public sealed class SaveInvestmentAnalysis(IInvestmentRepository investments, IInvestmentAnalysisRepository analyses)
{
    /// <summary>
    /// Validates the analysis and stores it; the investment it is about must exist.
    /// </summary>
    /// <example><code>await saveAnalysis.ExecuteAsync(new SaveInvestmentAnalysisCommand("a1", "totvs3", day, content), ct);</code></example>
    public async Task<InvestmentAnalysis> ExecuteAsync(
        SaveInvestmentAnalysisCommand command, CancellationToken cancellationToken)
    {
        var analysis = InvestmentAnalysis.Create(command.Id, command.InvestmentId, command.Date, command.Content);
        if (await investments.FindAsync(analysis.InvestmentId, cancellationToken) is null)
        {
            throw ResourceNotFoundException.For("investment", analysis.InvestmentId);
        }
        await analyses.SaveAsync(analysis, cancellationToken);
        return analysis;
    }
}
