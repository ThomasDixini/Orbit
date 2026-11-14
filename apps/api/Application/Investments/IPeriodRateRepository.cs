using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

/// <summary>Port to the storage of the rates the user typed for each month.</summary>
public interface IPeriodRateRepository
{
    /// <summary>Every rate, newest month first and, within a month, by kind.</summary>
    Task<IReadOnlyList<PeriodRate>> ListAsync(CancellationToken cancellationToken);

    /// <summary>Stores the rate, replacing the stored one of the same kind and month.</summary>
    Task SaveAsync(PeriodRate rate, CancellationToken cancellationToken);

    /// <summary>Removes the rate of this kind and month; one that is not there is ignored.</summary>
    Task DeleteAsync(PeriodRateKind kind, string month, CancellationToken cancellationToken);
}
