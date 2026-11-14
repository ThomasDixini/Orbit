using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

/// <summary>Lists every note the user wrote about their investments.</summary>
public sealed class ListInvestmentNotes(IInvestmentNoteRepository notes)
{
    /// <summary>
    /// The notes, newest day first.
    /// </summary>
    /// <example><code>var all = await listNotes.ExecuteAsync(ct);</code></example>
    public Task<IReadOnlyList<InvestmentNote>> ExecuteAsync(CancellationToken cancellationToken) =>
        notes.ListAsync(cancellationToken);
}
