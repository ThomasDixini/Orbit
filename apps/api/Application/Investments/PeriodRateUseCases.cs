using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

public sealed record SavePeriodRateCommand(PeriodRateKind Kind, string Month, int BasisPoints);

/// <summary>Stores the rate of a kind for a month; saving again replaces it, so retries are harmless.</summary>
public sealed class SavePeriodRate(IPeriodRateRepository rates)
{
    /// <summary>
    /// Validates the rate and stores it.
    /// </summary>
    /// <example><code>await savePeriodRate.ExecuteAsync(new SavePeriodRateCommand(PeriodRateKind.Selic, "2026-10", 1300), ct);</code></example>
    public async Task<PeriodRate> ExecuteAsync(SavePeriodRateCommand command, CancellationToken cancellationToken)
    {
        var rate = PeriodRate.Create(command.Kind, command.Month, command.BasisPoints);
        await rates.SaveAsync(rate, cancellationToken);
        return rate;
    }
}

/// <summary>Removes the rate of a kind for a month; removing one already gone succeeds.</summary>
public sealed class DeletePeriodRate(IPeriodRateRepository rates)
{
    /// <summary>
    /// Validates the month and removes the rate if it exists.
    /// </summary>
    /// <example><code>await deletePeriodRate.ExecuteAsync(PeriodRateKind.Selic, "2026-10", ct);</code></example>
    public Task ExecuteAsync(PeriodRateKind kind, string month, CancellationToken cancellationToken) =>
        rates.DeleteAsync(kind, PeriodRate.RequireMonth(month), cancellationToken);
}

/// <summary>Lists every rate the user typed.</summary>
public sealed class ListPeriodRates(IPeriodRateRepository rates)
{
    /// <summary>
    /// The rates, newest month first.
    /// </summary>
    /// <example><code>var all = await listPeriodRates.ExecuteAsync(ct);</code></example>
    public Task<IReadOnlyList<PeriodRate>> ExecuteAsync(CancellationToken cancellationToken) =>
        rates.ListAsync(cancellationToken);
}
