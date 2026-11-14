using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

public sealed record SaveInvestmentNoteCommand(
    string Id, string InvestmentId, InvestmentNoteKind Kind, DateOnly Date, string Text);

/// <summary>Creates or replaces a note about an investment; saving twice leaves the same state.</summary>
public sealed class SaveInvestmentNote(IInvestmentRepository investments, IInvestmentNoteRepository notes)
{
    /// <summary>
    /// Validates the note and stores it; the investment it is about must exist.
    /// </summary>
    /// <example><code>await saveNote.ExecuteAsync(new SaveInvestmentNoteCommand("n1", "petr4", InvestmentNoteKind.Event, day, "Dividend cut"), ct);</code></example>
    public async Task<InvestmentNote> ExecuteAsync(
        SaveInvestmentNoteCommand command, CancellationToken cancellationToken)
    {
        var note = InvestmentNote.Create(command.Id, command.InvestmentId, command.Kind, command.Date, command.Text);
        if (await investments.FindAsync(note.InvestmentId, cancellationToken) is null)
        {
            throw ResourceNotFoundException.For("investment", note.InvestmentId);
        }
        await notes.SaveAsync(note, cancellationToken);
        return note;
    }
}
