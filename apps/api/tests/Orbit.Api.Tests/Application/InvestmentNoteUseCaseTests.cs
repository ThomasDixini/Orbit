using Orbit.Api.Application;
using Orbit.Api.Application.Investments;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public class InvestmentNoteUseCaseTests
{
    private static readonly DateOnly January2 = new(2026, 1, 2);

    private readonly InMemoryInvestmentRepository _investments = new();
    private readonly InMemoryInvestmentNoteRepository _notes = new();

    private SaveInvestmentNote SaveNote => new(_investments, _notes);

    private static SaveInvestmentNoteCommand Note(string id = "n1", string text = "Solid balance sheet") =>
        new(id, "petr4", InvestmentNoteKind.Analysis, January2, text);

    private Task SavePetr4(InvestmentRisk? risk = null) =>
        new SaveInvestment(_investments).ExecuteAsync(
            new SaveInvestmentCommand("petr4", "PETR4", InvestmentKind.Stock, null, null, risk), CancellationToken.None);

    [Fact]
    public async Task SaveInvestment_KeepsTheRiskItWasGiven()
    {
        await SavePetr4(InvestmentRisk.Moderate);

        (await _investments.FindAsync("petr4", CancellationToken.None))!.Risk.ShouldBe(InvestmentRisk.Moderate);
    }

    [Fact]
    public async Task SaveNote_StoresItAndReplacesItOnTheNextSave()
    {
        await SavePetr4();

        await SaveNote.ExecuteAsync(Note(), CancellationToken.None);
        await SaveNote.ExecuteAsync(Note(text: "Debt is growing"), CancellationToken.None);

        var stored = await _notes.ListAsync(CancellationToken.None);
        stored.Select(note => note.Text).ShouldBe(["Debt is growing"]);
    }

    [Fact]
    public async Task SaveNote_ForAnUnknownInvestmentIsNotFoundAndStoresNothing()
    {
        await Should.ThrowAsync<ResourceNotFoundException>(() => SaveNote.ExecuteAsync(Note(), CancellationToken.None));

        (await _notes.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task SaveNote_WithABlankTextIsRejected()
    {
        await SavePetr4();

        await Should.ThrowAsync<DomainRuleException>(() => SaveNote.ExecuteAsync(Note(text: " "), CancellationToken.None));
    }

    [Fact]
    public async Task DeleteNote_RemovesItAndSucceedsWhenItIsAlreadyGone()
    {
        await SavePetr4();
        await SaveNote.ExecuteAsync(Note(), CancellationToken.None);
        var delete = new DeleteInvestmentNote(_notes);

        await delete.ExecuteAsync("n1", CancellationToken.None);
        await delete.ExecuteAsync("n1", CancellationToken.None);

        (await new ListInvestmentNotes(_notes).ExecuteAsync(CancellationToken.None)).ShouldBeEmpty();
    }
}
