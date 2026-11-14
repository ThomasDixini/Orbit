namespace Orbit.Api.Domain.Investments;

/// <summary>
/// Free text the user wrote about one investment (an analysis, an important event, a macro fact), dated
/// by the day it refers to. Notes never change the portfolio's numbers.
/// </summary>
public sealed class InvestmentNote
{
    public const int MaxTextLength = 4000;

    public string Id { get; }
    public string InvestmentId { get; }
    public InvestmentNoteKind Kind { get; }
    public DateOnly Date { get; }
    public string Text { get; }

    private InvestmentNote(string id, string investmentId, InvestmentNoteKind kind, DateOnly date, string text)
    {
        Id = id;
        InvestmentId = investmentId;
        Kind = kind;
        Date = date;
        Text = text;
    }

    /// <summary>
    /// Builds a valid note: a known kind and a non-blank text of up to 4000 characters, kept as typed.
    /// </summary>
    /// <example><code>InvestmentNote.Create("n1", "petr4", InvestmentNoteKind.Event, day, "Dividend cut").Text; // "Dividend cut"</code></example>
    public static InvestmentNote Create(
        string id, string investmentId, InvestmentNoteKind kind, DateOnly date, string text)
    {
        return new InvestmentNote(
            EntityId.Require(id, "investment note id"),
            EntityId.Require(investmentId, "investment id"),
            RequireKind(kind),
            date,
            RequireText(text));
    }

    /// <summary>Rebuilds a stored note as it was saved, without today's rules.</summary>
    /// <example><code>InvestmentNote.Restore("n1", "petr4", InvestmentNoteKind.Analysis, day, "Solid");</code></example>
    internal static InvestmentNote Restore(
        string id, string investmentId, InvestmentNoteKind kind, DateOnly date, string text) =>
        new(id, investmentId, kind, date, text);

    private static InvestmentNoteKind RequireKind(InvestmentNoteKind kind)
    {
        if (Enum.IsDefined(kind)) return kind;
        throw new DomainRuleException($"Expected the investment note kind to be a known one, received {(int)kind}");
    }

    private static string RequireText(string text)
    {
        if (!string.IsNullOrWhiteSpace(text) && text.Length <= MaxTextLength) return text;
        throw new DomainRuleException(
            $"Expected the investment note text to have 1-{MaxTextLength} characters, received {ReceivedValue.Quote(text)}");
    }
}
