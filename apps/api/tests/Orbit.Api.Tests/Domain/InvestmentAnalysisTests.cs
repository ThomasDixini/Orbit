using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class InvestmentAnalysisTests
{
    private static readonly DateOnly January2 = new(2026, 1, 2);
    private static readonly Dictionary<string, string> NoTexts = [];
    private static readonly Dictionary<string, decimal> NoMetrics = [];

    private static AnalysisEntries Company(
        Dictionary<string, string>? texts = null, Dictionary<string, decimal>? metrics = null) =>
        AnalysisEntries.Create(texts ?? NoTexts, metrics ?? NoMetrics, AnalysisFields.Company);

    private static AnalysisScenario Scenario(ScenarioKind kind, decimal? probability = null) =>
        AnalysisScenario.Create(kind, AnalysisEntries.Create(
            NoTexts, probability is { } value ? new() { ["probability"] = value } : NoMetrics, AnalysisFields.Scenario));

    private static InvestmentAnalysis Analysis(
        AnalysisEntries? company = null,
        IReadOnlyList<PeerComparison>? peers = null,
        IReadOnlyList<AnalysisScenario>? scenarios = null,
        AnalysisRecommendation? recommendation = null) =>
        InvestmentAnalysis.Create("a1", "totvs3", January2,
            new AnalysisContent(recommendation, company ?? Company(), peers ?? [], scenarios ?? []));

    [Fact]
    public void Entries_KeepTextsAsTypedAndDropBlankOnes()
    {
        var entries = Company(new() { ["moat"] = " Switching costs\nare high ", ["thesis"] = "   " });

        entries.Texts.ShouldBe(new Dictionary<string, string> { ["moat"] = " Switching costs\nare high " });
    }

    [Fact]
    public void Entries_KeepNumbersIncludingZeroAndNegatives()
    {
        var entries = Company(metrics: new() { ["roe"] = 18.5m, ["netDebtToEbitda"] = -0.4m, ["dividendYield"] = 0m });

        entries.Metric("roe").ShouldBe(18.5m);
        entries.Metric("netDebtToEbitda").ShouldBe(-0.4m);
        entries.Metric("dividendYield").ShouldBe(0m);
        entries.Metric("roic").ShouldBeNull();
    }

    [Fact]
    public void Entries_RejectAFieldTheirCatalogDoesNotKnow()
    {
        var text = Should.Throw<DomainRuleException>(() => Company(new() { ["mood"] = "good" }));
        var metric = Should.Throw<DomainRuleException>(
            () => AnalysisEntries.Create(NoTexts, new Dictionary<string, decimal> { ["wacc"] = 12 }, AnalysisFields.Peer));

        text.Message.ShouldContain("\"mood\"");
        metric.Message.ShouldContain("known peer number field");
    }

    [Fact]
    public void Entries_AcceptTheTextLimitAndRejectOneCharacterMore()
    {
        Company(new() { ["thesis"] = new string('a', 2000) });

        var error = Should.Throw<DomainRuleException>(() => Company(new() { ["thesis"] = new string('a', 2001) }));
        error.Message.ShouldContain("at most 2000");
    }

    [Fact]
    public void Entries_RejectANumberBeyondATrillion()
    {
        Company(metrics: new() { ["freeCashFlow"] = -1_000_000_000_000m });

        var error = Should.Throw<DomainRuleException>(
            () => Company(metrics: new() { ["freeCashFlow"] = 1_000_000_000_001m }));
        error.Message.ShouldContain("1000000000001");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(100)]
    public void Scenario_AcceptsAProbabilityFromZeroToAHundred(int probability)
    {
        Scenario(ScenarioKind.Base, probability).Entries.Metric("probability").ShouldBe(probability);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(100.5)]
    public void Scenario_RejectsAProbabilityOutsideZeroToAHundred(double probability)
    {
        var error = Should.Throw<DomainRuleException>(() => Scenario(ScenarioKind.Base, (decimal)probability));

        error.Message.ShouldContain("0-100");
    }

    [Fact]
    public void Analysis_RejectsTwoScenariosOfTheSameKind()
    {
        var error = Should.Throw<DomainRuleException>(() => Analysis(
            scenarios: [Scenario(ScenarioKind.Optimistic), Scenario(ScenarioKind.Optimistic)]));

        error.Message.ShouldContain("kind Optimistic");
    }

    [Fact]
    public void Analysis_AcceptsFivePeersAndRejectsASixth()
    {
        var peers = Enumerable.Range(1, 6)
            .Select(index => PeerComparison.Create($"Peer {index}", AnalysisEntries.Empty))
            .ToList();

        Analysis(peers: peers.Take(5).ToList()).Content.Peers.Count.ShouldBe(5);
        Should.Throw<DomainRuleException>(() => Analysis(peers: peers)).Message.ShouldContain("received 6");
    }

    [Fact]
    public void Peer_IsNamedTrimmedAndRejectsABlankName()
    {
        PeerComparison.Create(" SAP ", AnalysisEntries.Empty).Name.ShouldBe("SAP");

        Should.Throw<DomainRuleException>(() => PeerComparison.Create("  ", AnalysisEntries.Empty));
    }

    [Fact]
    public void Analysis_RejectsAnUnknownRecommendation()
    {
        var error = Should.Throw<DomainRuleException>(() => Analysis(recommendation: (AnalysisRecommendation)8));

        error.Message.ShouldContain("received 8");
    }

    [Fact]
    public void Analysis_MayBeSavedWithNothingFilledIn()
    {
        var analysis = Analysis();

        analysis.Content.Recommendation.ShouldBeNull();
        analysis.Content.Company.Texts.ShouldBeEmpty();
    }
}
