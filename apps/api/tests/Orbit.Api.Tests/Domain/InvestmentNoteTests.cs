using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class InvestmentNoteTests
{
    private static readonly DateOnly January2 = new(2026, 1, 2);

    [Fact]
    public void Note_KeepsItsTextExactlyAsTyped()
    {
        var note = InvestmentNote.Create("n1", "petr4", InvestmentNoteKind.Event, January2, "  Dividend cut\nby half ");

        note.Text.ShouldBe("  Dividend cut\nby half ");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Note_RejectsABlankText(string text)
    {
        Should.Throw<DomainRuleException>(
            () => InvestmentNote.Create("n1", "petr4", InvestmentNoteKind.Analysis, January2, text));
    }

    [Fact]
    public void Note_AcceptsTheLimitAndRejectsOneCharacterMore()
    {
        InvestmentNote.Create("n1", "petr4", InvestmentNoteKind.Macro, January2, new string('a', 4000));

        var error = Should.Throw<DomainRuleException>(
            () => InvestmentNote.Create("n1", "petr4", InvestmentNoteKind.Macro, January2, new string('a', 4001)));
        error.Message.ShouldContain("1-4000");
    }

    [Fact]
    public void Note_RejectsAnUnknownKind()
    {
        var error = Should.Throw<DomainRuleException>(
            () => InvestmentNote.Create("n1", "petr4", (InvestmentNoteKind)9, January2, "text"));
        error.Message.ShouldContain("received 9");
    }

    [Fact]
    public void Investment_HasNoRiskUntilOneIsChosenAndRejectsAnUnknownOne()
    {
        Investment.Create("petr4", "PETR4", InvestmentKind.Stock, null).Risk.ShouldBeNull();
        Investment.Create("petr4", "PETR4", InvestmentKind.Stock, null, InvestmentRisk.High).Risk
            .ShouldBe(InvestmentRisk.High);

        var error = Should.Throw<DomainRuleException>(
            () => Investment.Create("petr4", "PETR4", InvestmentKind.Stock, null, (InvestmentRisk)7));
        error.Message.ShouldContain("received 7");
    }
}
