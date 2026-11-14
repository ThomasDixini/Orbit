using Orbit.Api.Application.Investments;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Tests.Fakes;

/// <summary>Period rate storage kept in a list, for use case tests.</summary>
internal sealed class InMemoryPeriodRateRepository : IPeriodRateRepository
{
    private readonly List<PeriodRate> _rates = [];

    public Task<IReadOnlyList<PeriodRate>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<PeriodRate>>(
            _rates.OrderByDescending(rate => rate.Month).ThenBy(rate => rate.Kind).ToList());

    public Task SaveAsync(PeriodRate rate, CancellationToken cancellationToken)
    {
        _rates.RemoveAll(stored => stored.Kind == rate.Kind && stored.Month == rate.Month);
        _rates.Add(rate);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(PeriodRateKind kind, string month, CancellationToken cancellationToken)
    {
        _rates.RemoveAll(rate => rate.Kind == kind && rate.Month == month);
        return Task.CompletedTask;
    }
}
