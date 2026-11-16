using Orbit.Api.Domain.Investments;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>Fundamental analyses over a throwaway database.</summary>
public sealed class SqliteInvestmentAnalysisRepositoryTests : IAsyncLifetime, IDisposable
{
    private static readonly DateOnly January2 = new(2026, 1, 2);
    private static readonly Dictionary<string, string> NoTexts = [];

    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteInvestmentRepository _investments;
    private readonly SqliteInvestmentAnalysisRepository _analyses;

    public SqliteInvestmentAnalysisRepositoryTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _investments = new SqliteInvestmentRepository(_connections);
        _analyses = new SqliteInvestmentAnalysisRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await TestUsers.CreateSchemaAsync(_connections, TestUsers.DefaultId, TestUsers.OtherId);
        await _investments.SaveAsync(
            Investment.Create("totvs3", "TOTS3", InvestmentKind.Stock, null), CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private static InvestmentAnalysis Analysis(string id, DateOnly date, string thesis = "Thesis") =>
        InvestmentAnalysis.Create(id, "totvs3", date, new AnalysisContent(
            null,
            AnalysisEntries.Create(
                new Dictionary<string, string> { ["thesis"] = thesis }, new Dictionary<string, decimal>(),
                AnalysisFields.Company),
            [],
            []));

    private static InvestmentAnalysis FullAnalysis() =>
        InvestmentAnalysis.Create("full", "totvs3", January2, new AnalysisContent(
            AnalysisRecommendation.Hold,
            AnalysisEntries.Create(
                new Dictionary<string, string> { ["moat"] = "Switching costs\nand scale", ["inflation"] = "4.5%" },
                new Dictionary<string, decimal> { ["roe"] = 18.25m, ["netDebtToEbitda"] = -0.3m, ["price"] = 31.9m },
                AnalysisFields.Company),
            [PeerComparison.Create("SAP", AnalysisEntries.Create(
                NoTexts, new Dictionary<string, decimal> { ["priceToEarnings"] = 32.1m }, AnalysisFields.Peer))],
            [AnalysisScenario.Create(ScenarioKind.Pessimistic, AnalysisEntries.Create(
                new Dictionary<string, string> { ["triggers"] = "Recession" },
                new Dictionary<string, decimal> { ["probability"] = 20m, ["valuation"] = 24.5m },
                AnalysisFields.Scenario))]));

    [Fact]
    public async Task AnAnalysis_IsReadBackWholeWithItsPeersAndScenarios()
    {
        await _analyses.SaveAsync(FullAnalysis(), CancellationToken.None);

        var read = (await _analyses.ListAsync(CancellationToken.None)).Single();

        read.Date.ShouldBe(January2);
        read.Content.Recommendation.ShouldBe(AnalysisRecommendation.Hold);
        read.Content.Company.Texts["moat"].ShouldBe("Switching costs\nand scale");
        read.Content.Company.Metric("roe").ShouldBe(18.25m);
        read.Content.Company.Metric("netDebtToEbitda").ShouldBe(-0.3m);
        read.Content.Peers.Single().Name.ShouldBe("SAP");
        read.Content.Peers.Single().Entries.Metric("priceToEarnings").ShouldBe(32.1m);
        read.Content.Scenarios.Single().Kind.ShouldBe(ScenarioKind.Pessimistic);
        read.Content.Scenarios.Single().Entries.Texts["triggers"].ShouldBe("Recession");
        read.Content.Scenarios.Single().Entries.Metric("valuation").ShouldBe(24.5m);
    }

    [Fact]
    public async Task Analyses_AreListedNewestDayFirst()
    {
        await _analyses.SaveAsync(Analysis("january", January2), CancellationToken.None);
        await _analyses.SaveAsync(Analysis("june", new DateOnly(2026, 6, 1)), CancellationToken.None);

        var all = await _analyses.ListAsync(CancellationToken.None);

        all.Select(analysis => analysis.Id).ShouldBe(["june", "january"]);
    }

    [Fact]
    public async Task SavingAnAnalysisTwice_ReplacesItInsteadOfDuplicating()
    {
        await _analyses.SaveAsync(Analysis("a1", January2, "First"), CancellationToken.None);
        await _analyses.SaveAsync(Analysis("a1", January2, "Second"), CancellationToken.None);

        var all = await _analyses.ListAsync(CancellationToken.None);
        all.Single().Content.Company.Texts["thesis"].ShouldBe("Second");
    }

    [Fact]
    public async Task DeletingAnInvestment_RemovesItsAnalysesToo()
    {
        await _analyses.SaveAsync(Analysis("a1", January2), CancellationToken.None);

        await _investments.DeleteAsync("totvs3", CancellationToken.None);

        (await _analyses.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Analyses_OfTwoUsersNeverMix()
    {
        var other = TestUsers.FactoryFor(_database, TestUsers.OtherId);
        await new SqliteInvestmentRepository(other).SaveAsync(
            Investment.Create("totvs3", "TOTS3", InvestmentKind.Stock, null), CancellationToken.None);
        var theirs = new SqliteInvestmentAnalysisRepository(other);
        await _analyses.SaveAsync(Analysis("a1", January2, "Mine"), CancellationToken.None);
        await theirs.SaveAsync(Analysis("a1", January2, "Theirs"), CancellationToken.None);

        await _analyses.DeleteAsync("a1", CancellationToken.None);

        (await _analyses.ListAsync(CancellationToken.None)).ShouldBeEmpty();
        (await theirs.ListAsync(CancellationToken.None)).Single().Content.Company.Texts["thesis"].ShouldBe("Theirs");
    }
}
