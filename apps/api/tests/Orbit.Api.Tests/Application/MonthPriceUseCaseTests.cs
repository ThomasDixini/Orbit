using Orbit.Api.Application;
using Orbit.Api.Application.Investments;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public class MonthPriceUseCaseTests
{
    private readonly InMemoryInvestmentRepository _investments = new();

    private async Task SaveInvestmentAsync(InvestmentTracking tracking) =>
        await new SaveInvestment(_investments).ExecuteAsync(
            new SaveInvestmentCommand("tots3", "TOTS3", InvestmentKind.Stock, null, null, null, tracking),
            CancellationToken.None);

    private Task<InvestmentMonthPrice> SavePriceAsync(string month = "2026-02", long cents = 3_100) =>
        new SaveMonthPrice(_investments).ExecuteAsync(
            new SaveMonthPriceCommand("tots3", month, cents), CancellationToken.None);

    [Fact]
    public async Task SaveMonthPrice_StoresItAndReplacesItWhenTheSameMonthIsTypedAgain()
    {
        await SaveInvestmentAsync(InvestmentTracking.Trades);

        await SavePriceAsync(cents: 3_100);
        await SavePriceAsync(cents: 4_200);

        var stored = await _investments.ListMonthPricesAsync(CancellationToken.None);
        stored.Select(price => (price.InvestmentId, price.Month, price.Cents)).ShouldBe([("tots3", "2026-02", 4_200L)]);
    }

    [Fact]
    public async Task SaveMonthPrice_RefusesAnInvestmentFollowedByItsBalance()
    {
        await SaveInvestmentAsync(InvestmentTracking.Balance);

        await Should.ThrowAsync<ConflictException>(() => SavePriceAsync());
    }

    [Fact]
    public async Task SaveMonthPrice_RefusesAnUnknownInvestment()
    {
        await Should.ThrowAsync<ResourceNotFoundException>(() => SavePriceAsync());
    }

    [Theory]
    [InlineData("2026-13", 3_100)]
    [InlineData("26-02", 3_100)]
    [InlineData("2026-02", 0)]
    [InlineData("2026-02", -5)]
    public async Task SaveMonthPrice_RefusesAMonthThatIsNotYearMonthOrAPriceAboveZero(string month, long cents)
    {
        await SaveInvestmentAsync(InvestmentTracking.Trades);

        await Should.ThrowAsync<DomainRuleException>(() => SavePriceAsync(month, cents));
    }

    [Fact]
    public async Task DeleteMonthPrice_RemovesItAndIsHarmlessWhenRepeated()
    {
        await SaveInvestmentAsync(InvestmentTracking.Trades);
        await SavePriceAsync();
        var delete = new DeleteMonthPrice(_investments);

        await delete.ExecuteAsync("tots3", "2026-02", CancellationToken.None);
        await delete.ExecuteAsync("tots3", "2026-02", CancellationToken.None);

        (await _investments.ListMonthPricesAsync(CancellationToken.None)).ShouldBeEmpty();
    }
}
