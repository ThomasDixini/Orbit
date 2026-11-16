using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

/// <summary>Port to the storage of the fundamental analyses written about investments.</summary>
public interface IInvestmentAnalysisRepository
{
    /// <summary>Every analysis, newest day first.</summary>
    Task<IReadOnlyList<InvestmentAnalysis>> ListAsync(CancellationToken cancellationToken);

    /// <summary>Stores the analysis, replacing a stored one with the same id.</summary>
    Task SaveAsync(InvestmentAnalysis analysis, CancellationToken cancellationToken);

    /// <summary>Removes the analysis; an unknown id is ignored.</summary>
    Task DeleteAsync(string analysisId, CancellationToken cancellationToken);
}
