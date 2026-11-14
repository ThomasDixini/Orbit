using Orbit.Api.Application.Investments;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Tests.Fakes;

/// <summary>Investment note storage kept in a list, for use case tests.</summary>
internal sealed class InMemoryInvestmentNoteRepository : IInvestmentNoteRepository
{
    private readonly List<InvestmentNote> _notes = [];

    public Task<IReadOnlyList<InvestmentNote>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<InvestmentNote>>(_notes.OrderByDescending(note => note.Date).ToList());

    public Task SaveAsync(InvestmentNote note, CancellationToken cancellationToken)
    {
        _notes.RemoveAll(stored => stored.Id == note.Id);
        _notes.Add(note);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string noteId, CancellationToken cancellationToken)
    {
        _notes.RemoveAll(note => note.Id == noteId);
        return Task.CompletedTask;
    }
}
