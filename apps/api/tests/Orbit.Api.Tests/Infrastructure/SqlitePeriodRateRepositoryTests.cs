using Orbit.Api.Domain.Investments;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>Period rates over a throwaway database.</summary>
public sealed class SqlitePeriodRateRepositoryTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqlitePeriodRateRepository _rates;

    public SqlitePeriodRateRepositoryTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _rates = new SqlitePeriodRateRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await TestUsers.CreateSchemaAsync(_connections, TestUsers.DefaultId, TestUsers.OtherId);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private static PeriodRate Rate(PeriodRateKind kind, string month, int basisPoints) =>
        PeriodRate.Create(kind, month, basisPoints);

    [Fact]
    public async Task Rates_AreListedNewestMonthFirstAndReadBackWhole()
    {
        await _rates.SaveAsync(Rate(PeriodRateKind.Ipca, "2026-09", -12), CancellationToken.None);
        await _rates.SaveAsync(Rate(PeriodRateKind.Selic, "2026-10", 1300), CancellationToken.None);

        var all = await _rates.ListAsync(CancellationToken.None);

        all.Select(rate => (rate.Kind, rate.Month, rate.BasisPoints)).ShouldBe(
            [(PeriodRateKind.Selic, "2026-10", 1300), (PeriodRateKind.Ipca, "2026-09", -12)]);
    }

    [Fact]
    public async Task SavingTheSameKindAndMonthTwice_ReplacesTheValue()
    {
        await _rates.SaveAsync(Rate(PeriodRateKind.Selic, "2026-10", 1300), CancellationToken.None);
        await _rates.SaveAsync(Rate(PeriodRateKind.Selic, "2026-10", 1375), CancellationToken.None);

        (await _rates.ListAsync(CancellationToken.None)).Select(rate => rate.BasisPoints).ShouldBe([1375]);
    }

    [Fact]
    public async Task Delete_RemovesOnlyTheKindAndMonthGiven()
    {
        await _rates.SaveAsync(Rate(PeriodRateKind.Selic, "2026-10", 1300), CancellationToken.None);
        await _rates.SaveAsync(Rate(PeriodRateKind.Ipca, "2026-10", 52), CancellationToken.None);

        await _rates.DeleteAsync(PeriodRateKind.Selic, "2026-10", CancellationToken.None);

        (await _rates.ListAsync(CancellationToken.None)).Select(rate => rate.Kind).ShouldBe([PeriodRateKind.Ipca]);
    }

    [Fact]
    public async Task Rates_OfTwoUsersNeverMix()
    {
        var theirs = new SqlitePeriodRateRepository(TestUsers.FactoryFor(_database, TestUsers.OtherId));
        await _rates.SaveAsync(Rate(PeriodRateKind.Selic, "2026-10", 1300), CancellationToken.None);
        await theirs.SaveAsync(Rate(PeriodRateKind.Selic, "2026-10", 999), CancellationToken.None);

        await _rates.DeleteAsync(PeriodRateKind.Selic, "2026-10", CancellationToken.None);

        (await _rates.ListAsync(CancellationToken.None)).ShouldBeEmpty();
        (await theirs.ListAsync(CancellationToken.None)).Select(rate => rate.BasisPoints).ShouldBe([999]);
    }
}
