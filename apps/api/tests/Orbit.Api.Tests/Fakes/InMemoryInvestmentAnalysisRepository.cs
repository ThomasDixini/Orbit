using Orbit.Api.Application.Investments;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Tests.Fakes;

/// <summary>Investment analysis storage kept in a list, for use case tests.</summary>
internal sealed class InMemoryInvestmentAnalysisRepository : IInvestmentAnalysisRepository
{
    private readonly List<InvestmentAnalysis> _analyses = [];

    public Task<IReadOnlyList<InvestmentAnalysis>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<InvestmentAnalysis>>(
            _analyses.OrderByDescending(analysis => analysis.Date).ToList());

    public Task SaveAsync(InvestmentAnalysis analysis, CancellationToken cancellationToken)
    {
        _analyses.RemoveAll(stored => stored.Id == analysis.Id);
        _analyses.Add(analysis);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string analysisId, CancellationToken cancellationToken)
    {
        _analyses.RemoveAll(analysis => analysis.Id == analysisId);
        return Task.CompletedTask;
    }
}
