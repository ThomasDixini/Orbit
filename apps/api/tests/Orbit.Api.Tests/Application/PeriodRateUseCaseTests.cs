using Orbit.Api.Application.Investments;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public class PeriodRateUseCaseTests
{
    private readonly InMemoryPeriodRateRepository _rates = new();

    private Task Save(PeriodRateKind kind, string month, int basisPoints) =>
        new SavePeriodRate(_rates).ExecuteAsync(new SavePeriodRateCommand(kind, month, basisPoints), CancellationToken.None);

    [Fact]
    public async Task Save_StoresTheRateAndReplacesTheOneOfTheSameKindAndMonth()
    {
        await Save(PeriodRateKind.Selic, "2026-10", 1300);
        await Save(PeriodRateKind.Selic, "2026-10", 1350);
        await Save(PeriodRateKind.Ipca, "2026-10", 52);

        var all = await new ListPeriodRates(_rates).ExecuteAsync(CancellationToken.None);

        all.Select(rate => (rate.Kind, rate.BasisPoints)).ShouldBe([(PeriodRateKind.Selic, 1350), (PeriodRateKind.Ipca, 52)]);
    }

    [Fact]
    public async Task List_ReturnsTheNewestMonthFirst()
    {
        await Save(PeriodRateKind.Selic, "2026-09", 1300);
        await Save(PeriodRateKind.Selic, "2026-11", 1300);

        var all = await new ListPeriodRates(_rates).ExecuteAsync(CancellationToken.None);

        all.Select(rate => rate.Month).ShouldBe(["2026-11", "2026-09"]);
    }

    [Fact]
    public async Task Save_AnInvalidRateIsRejectedAndStoresNothing()
    {
        await Should.ThrowAsync<DomainRuleException>(() => Save(PeriodRateKind.Selic, "2026-13", 1300));

        (await _rates.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Delete_RemovesOnlyThatKindAndSucceedsWhenItIsAlreadyGone()
    {
        await Save(PeriodRateKind.Selic, "2026-10", 1300);
        await Save(PeriodRateKind.Ipca, "2026-10", 52);
        var delete = new DeletePeriodRate(_rates);

        await delete.ExecuteAsync(PeriodRateKind.Selic, "2026-10", CancellationToken.None);
        await delete.ExecuteAsync(PeriodRateKind.Selic, "2026-10", CancellationToken.None);

        (await _rates.ListAsync(CancellationToken.None)).Select(rate => rate.Kind).ShouldBe([PeriodRateKind.Ipca]);
    }

    [Fact]
    public async Task Delete_ABadMonthIsRejected()
    {
        await Should.ThrowAsync<DomainRuleException>(
            () => new DeletePeriodRate(_rates).ExecuteAsync(PeriodRateKind.Selic, "oct", CancellationToken.None));
    }
}
