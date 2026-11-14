using Orbit.Api.Domain;

namespace Orbit.Api.Application.Investments;

/// <summary>Deletes a note about an investment; deleting one already gone succeeds, so retries are harmless.</summary>
public sealed class DeleteInvestmentNote(IInvestmentNoteRepository notes)
{
    /// <summary>
    /// Validates the id and removes the note if it exists.
    /// </summary>
    /// <example><code>await deleteNote.ExecuteAsync("n1", ct);</code></example>
    public Task ExecuteAsync(string noteId, CancellationToken cancellationToken) =>
        notes.DeleteAsync(EntityId.Require(noteId, "investment note id"), cancellationToken);
}
