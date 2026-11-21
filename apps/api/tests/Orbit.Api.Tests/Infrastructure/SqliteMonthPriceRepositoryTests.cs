using Orbit.Api.Domain.Investments;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>The month-end prices typed by the user, over a throwaway database.</summary>
public sealed class SqliteMonthPriceRepositoryTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteInvestmentRepository _investments;

    public SqliteMonthPriceRepositoryTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _investments = new SqliteInvestmentRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await TestUsers.CreateSchemaAsync(_connections, TestUsers.DefaultId, TestUsers.OtherId);
        await _investments.SaveAsync(Investment.Create("tots3", "TOTS3", InvestmentKind.Stock, null), CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private Task SaveAsync(string month, long cents) =>
        _investments.SaveMonthPriceAsync(InvestmentMonthPrice.Create("tots3", month, cents), CancellationToken.None);

    [Fact]
    public async Task MonthPrices_AreReadBackOldestMonthFirstAndReplacedOnTheNextSave()
    {
        await SaveAsync("2026-03", 4_200);
        await SaveAsync("2026-02", 3_100);

        await SaveAsync("2026-03", 2_800);

        var stored = await _investments.ListMonthPricesAsync(CancellationToken.None);
        stored.Select(price => (price.Month, price.Cents)).ShouldBe([("2026-02", 3_100L), ("2026-03", 2_800L)]);
    }

    [Fact]
    public async Task DeleteMonthPrice_RemovesOnlyThatMonthAndIsHarmlessWhenRepeated()
    {
        await SaveAsync("2026-02", 3_100);
        await SaveAsync("2026-03", 4_200);

        await _investments.DeleteMonthPriceAsync("tots3", "2026-02", CancellationToken.None);
        await _investments.DeleteMonthPriceAsync("tots3", "2026-02", CancellationToken.None);

        var stored = await _investments.ListMonthPricesAsync(CancellationToken.None);
        stored.Select(price => price.Month).ShouldBe(["2026-03"]);
    }

    [Fact]
    public async Task DeleteInvestment_TakesItsMonthPricesWithIt()
    {
        await SaveAsync("2026-02", 3_100);

        await _investments.DeleteAsync("tots3", CancellationToken.None);

        (await _investments.ListMonthPricesAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task MonthPrices_BelongToTheirOwnerAlone()
    {
        await SaveAsync("2026-02", 3_100);
        var other = new SqliteInvestmentRepository(TestUsers.FactoryFor(_database, TestUsers.OtherId));

        (await other.ListMonthPricesAsync(CancellationToken.None)).ShouldBeEmpty();
    }
}
