using Orbit.Api.Application;
using Orbit.Api.Application.Investments;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public class InvestmentAnalysisUseCaseTests
{
    private static readonly DateOnly January2 = new(2026, 1, 2);

    private readonly InMemoryInvestmentRepository _investments = new();
    private readonly InMemoryInvestmentAnalysisRepository _analyses = new();

    private SaveInvestmentAnalysis SaveAnalysis => new(_investments, _analyses);

    private static SaveInvestmentAnalysisCommand Analysis(
        string id = "a1", DateOnly? date = null, string thesis = "Leader in ERP") =>
        new(id, "totvs3", date ?? January2, new AnalysisContent(
            AnalysisRecommendation.Buy,
            AnalysisEntries.Create(
                new Dictionary<string, string> { ["thesis"] = thesis }, new Dictionary<string, decimal>(),
                AnalysisFields.Company),
            [],
            []));

    private Task SaveTotvs() =>
        new SaveInvestment(_investments).ExecuteAsync(
            new SaveInvestmentCommand("totvs3", "TOTS3", InvestmentKind.Stock, null, null, null), CancellationToken.None);

    [Fact]
    public async Task Save_StoresItAndReplacesItOnTheNextSave()
    {
        await SaveTotvs();

        await SaveAnalysis.ExecuteAsync(Analysis(), CancellationToken.None);
        await SaveAnalysis.ExecuteAsync(Analysis(thesis: "Margins under pressure"), CancellationToken.None);

        var stored = await _analyses.ListAsync(CancellationToken.None);
        stored.Single().Content.Company.Texts["thesis"].ShouldBe("Margins under pressure");
    }

    [Fact]
    public async Task Save_KeepsAnalysesOfDifferentDaysApartNewestFirst()
    {
        await SaveTotvs();

        await SaveAnalysis.ExecuteAsync(Analysis("january"), CancellationToken.None);
        await SaveAnalysis.ExecuteAsync(Analysis("june", new DateOnly(2026, 6, 1)), CancellationToken.None);

        var listed = await new ListInvestmentAnalyses(_analyses).ExecuteAsync(CancellationToken.None);
        listed.Select(analysis => analysis.Id).ShouldBe(["june", "january"]);
    }

    [Fact]
    public async Task Save_ForAnUnknownInvestmentIsNotFoundAndStoresNothing()
    {
        await Should.ThrowAsync<ResourceNotFoundException>(
            () => SaveAnalysis.ExecuteAsync(Analysis(), CancellationToken.None));

        (await _analyses.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Save_WithABlankIdIsRejected()
    {
        await SaveTotvs();

        await Should.ThrowAsync<DomainRuleException>(
            () => SaveAnalysis.ExecuteAsync(Analysis(id: " "), CancellationToken.None));
    }

    [Fact]
    public async Task Delete_RemovesItAndSucceedsWhenItIsAlreadyGone()
    {
        await SaveTotvs();
        await SaveAnalysis.ExecuteAsync(Analysis(), CancellationToken.None);
        var delete = new DeleteInvestmentAnalysis(_analyses);

        await delete.ExecuteAsync("a1", CancellationToken.None);
        await delete.ExecuteAsync("a1", CancellationToken.None);

        (await _analyses.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }
}
