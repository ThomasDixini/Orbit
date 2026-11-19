using Orbit.Api.Application;
using Orbit.Api.Application.Investments;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public class BalanceEntryUseCaseTests
{
    private static readonly DateOnly December1 = new(2025, 12, 1);

    private readonly InMemoryInvestmentRepository _investments = new();

    private async Task SaveRdbAsync(InvestmentTracking tracking) =>
        await new SaveInvestment(_investments).ExecuteAsync(
            new SaveInvestmentCommand("rdb", "RDB Nubank", InvestmentKind.FixedIncome, null, null, null, tracking),
            CancellationToken.None);

    private Task<BalanceEntry> SaveEntryAsync(string id = "b1", BalanceEntryKind kind = BalanceEntryKind.Deposit) =>
        new SaveBalanceEntry(_investments).ExecuteAsync(
            new SaveBalanceEntryCommand(id, "rdb", December1, kind, 88_400), CancellationToken.None);

    [Fact]
    public async Task SaveBalanceEntry_StoresItForAnInvestmentFollowedByItsBalanceAndReplacesItOnTheNextSave()
    {
        await SaveRdbAsync(InvestmentTracking.Balance);

        await SaveEntryAsync();
        await SaveEntryAsync(kind: BalanceEntryKind.Withdrawal);

        var stored = await _investments.ListBalanceEntriesAsync(CancellationToken.None);
        stored.Select(entry => (entry.Id, entry.Kind)).ShouldBe([("b1", BalanceEntryKind.Withdrawal)]);
    }

    [Fact]
    public async Task SaveBalanceEntry_RefusesAnInvestmentFollowedByTrades()
    {
        await SaveRdbAsync(InvestmentTracking.Trades);

        await Should.ThrowAsync<ConflictException>(() => SaveEntryAsync());
    }

    [Fact]
    public async Task SaveBalanceEntry_RefusesAnUnknownInvestment()
    {
        await Should.ThrowAsync<ResourceNotFoundException>(() => SaveEntryAsync());
    }

    [Fact]
    public async Task DeleteBalanceEntry_RemovesItAndIsHarmlessWhenRepeated()
    {
        await SaveRdbAsync(InvestmentTracking.Balance);
        await SaveEntryAsync();
        var delete = new DeleteBalanceEntry(_investments);

        await delete.ExecuteAsync("b1", CancellationToken.None);
        await delete.ExecuteAsync("b1", CancellationToken.None);

        (await _investments.ListBalanceEntriesAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task DeleteInvestment_KeepsOneThatHasBalanceEntries()
    {
        await SaveRdbAsync(InvestmentTracking.Balance);
        await SaveEntryAsync();

        await Should.ThrowAsync<ConflictException>(() =>
            new DeleteInvestment(_investments).ExecuteAsync("rdb", CancellationToken.None));
    }
}
