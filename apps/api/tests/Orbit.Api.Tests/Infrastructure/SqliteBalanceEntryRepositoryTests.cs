using Orbit.Api.Domain.Investments;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>Balance-tracked investments and their statement lines over a throwaway database.</summary>
public sealed class SqliteBalanceEntryRepositoryTests : IAsyncLifetime, IDisposable
{
    private static readonly DateOnly December1 = new(2025, 12, 1);

    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteInvestmentRepository _investments;

    public SqliteBalanceEntryRepositoryTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _investments = new SqliteInvestmentRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await TestUsers.CreateSchemaAsync(_connections, TestUsers.DefaultId, TestUsers.OtherId);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private static Investment Rdb() =>
        Investment.Create("rdb", "RDB Nubank", InvestmentKind.FixedIncome, null, null, InvestmentTracking.Balance);

    [Fact]
    public async Task Investment_KeepsHowItIsTracked()
    {
        await _investments.SaveAsync(Rdb(), CancellationToken.None);
        await _investments.SaveAsync(
            Investment.Create("petr4", "PETR4", InvestmentKind.Stock, null), CancellationToken.None);

        var all = await _investments.ListAsync(CancellationToken.None);

        all.Select(investment => investment.Tracking).ShouldBe([InvestmentTracking.Balance, InvestmentTracking.Trades]);
    }

    [Fact]
    public async Task BalanceEntries_AreReadBackOldestFirstAndReplacedOnTheNextSave()
    {
        await _investments.SaveAsync(Rdb(), CancellationToken.None);
        await _investments.SaveBalanceEntryAsync(
            BalanceEntry.Create("b2", "rdb", December1.AddDays(8), BalanceEntryKind.Deposit, 88_400), CancellationToken.None);
        await _investments.SaveBalanceEntryAsync(
            BalanceEntry.Create("b1", "rdb", December1, BalanceEntryKind.Opening, 237_351), CancellationToken.None);

        await _investments.SaveBalanceEntryAsync(
            BalanceEntry.Create("b2", "rdb", December1.AddDays(8), BalanceEntryKind.Withdrawal, 5_000), CancellationToken.None);

        var stored = await _investments.ListBalanceEntriesAsync(CancellationToken.None);
        stored.Select(entry => (entry.Id, entry.Kind, entry.AmountCents)).ShouldBe([
            ("b1", BalanceEntryKind.Opening, 237_351L), ("b2", BalanceEntryKind.Withdrawal, 5_000L),
        ]);
    }

    [Fact]
    public async Task BalanceEntries_CountAsActivityUntilTheyAreRemoved()
    {
        await _investments.SaveAsync(Rdb(), CancellationToken.None);
        await _investments.SaveBalanceEntryAsync(
            BalanceEntry.Create("b1", "rdb", December1, BalanceEntryKind.Opening, 237_351), CancellationToken.None);
        var hadActivity = await _investments.HasActivityAsync("rdb", CancellationToken.None);

        await _investments.DeleteBalanceEntryAsync("b1", CancellationToken.None);
        await _investments.DeleteBalanceEntryAsync("b1", CancellationToken.None);

        (hadActivity, await _investments.HasActivityAsync("rdb", CancellationToken.None)).ShouldBe((true, false));
    }

    [Fact]
    public async Task Entries_BelongToTheirOwnerAlone()
    {
        await _investments.SaveAsync(Rdb(), CancellationToken.None);
        await _investments.SaveBalanceEntryAsync(
            BalanceEntry.Create("b1", "rdb", December1, BalanceEntryKind.Opening, 237_351), CancellationToken.None);
        var other = new SqliteInvestmentRepository(TestUsers.FactoryFor(_database, TestUsers.OtherId));

        (await other.ListBalanceEntriesAsync(CancellationToken.None)).ShouldBeEmpty();
    }
}
