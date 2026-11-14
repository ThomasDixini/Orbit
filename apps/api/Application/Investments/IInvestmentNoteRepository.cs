using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

/// <summary>Port to the storage of the notes the user wrote about investments.</summary>
public interface IInvestmentNoteRepository
{
    /// <summary>Every note, newest day first.</summary>
    Task<IReadOnlyList<InvestmentNote>> ListAsync(CancellationToken cancellationToken);

    /// <summary>Stores the note, replacing a stored one with the same id.</summary>
    Task SaveAsync(InvestmentNote note, CancellationToken cancellationToken);

    /// <summary>Removes the note; an unknown id is ignored.</summary>
    Task DeleteAsync(string noteId, CancellationToken cancellationToken);
}
