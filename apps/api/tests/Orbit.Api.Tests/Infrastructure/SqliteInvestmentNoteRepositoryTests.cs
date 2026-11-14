using Orbit.Api.Domain.Investments;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>Investment notes and risk over a throwaway database.</summary>
public sealed class SqliteInvestmentNoteRepositoryTests : IAsyncLifetime, IDisposable
{
    private static readonly DateOnly January2 = new(2026, 1, 2);

    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteInvestmentRepository _investments;
    private readonly SqliteInvestmentNoteRepository _notes;

    public SqliteInvestmentNoteRepositoryTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _investments = new SqliteInvestmentRepository(_connections);
        _notes = new SqliteInvestmentNoteRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await TestUsers.CreateSchemaAsync(_connections, TestUsers.DefaultId, TestUsers.OtherId);
        await _investments.SaveAsync(
            Investment.Create("petr4", "PETR4", InvestmentKind.Stock, null, InvestmentRisk.High), CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private static InvestmentNote Note(string id, DateOnly date, string text = "Text") =>
        InvestmentNote.Create(id, "petr4", InvestmentNoteKind.Event, date, text);

    [Fact]
    public async Task Risk_IsReadBackAndCanBeCleared()
    {
        (await _investments.FindAsync("petr4", CancellationToken.None))!.Risk.ShouldBe(InvestmentRisk.High);

        await _investments.SaveAsync(
            Investment.Create("petr4", "PETR4", InvestmentKind.Stock, null), CancellationToken.None);

        (await _investments.FindAsync("petr4", CancellationToken.None))!.Risk.ShouldBeNull();
    }

    [Fact]
    public async Task Notes_AreListedNewestDayFirstAndReadBackWhole()
    {
        await _notes.SaveAsync(Note("old", January2, "Line one\nLine two"), CancellationToken.None);
        await _notes.SaveAsync(Note("new", January2.AddDays(3)), CancellationToken.None);

        var all = await _notes.ListAsync(CancellationToken.None);

        all.Select(note => note.Id).ShouldBe(["new", "old"]);
        all[1].Text.ShouldBe("Line one\nLine two");
        all[1].Kind.ShouldBe(InvestmentNoteKind.Event);
    }

    [Fact]
    public async Task SavingANoteTwice_ReplacesItInsteadOfDuplicating()
    {
        await _notes.SaveAsync(Note("n1", January2, "First"), CancellationToken.None);
        await _notes.SaveAsync(Note("n1", January2, "Second"), CancellationToken.None);

        (await _notes.ListAsync(CancellationToken.None)).Select(note => note.Text).ShouldBe(["Second"]);
    }

    [Fact]
    public async Task DeletingAnInvestment_RemovesItsNotesToo()
    {
        await _notes.SaveAsync(Note("n1", January2), CancellationToken.None);

        await _investments.DeleteAsync("petr4", CancellationToken.None);

        (await _notes.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Notes_OfTwoUsersNeverMix()
    {
        var other = TestUsers.FactoryFor(_database, TestUsers.OtherId);
        await new SqliteInvestmentRepository(other).SaveAsync(
            Investment.Create("petr4", "PETR4", InvestmentKind.Stock, null), CancellationToken.None);
        var theirs = new SqliteInvestmentNoteRepository(other);
        await _notes.SaveAsync(Note("n1", January2, "Mine"), CancellationToken.None);
        await theirs.SaveAsync(Note("n1", January2, "Theirs"), CancellationToken.None);

        await _notes.DeleteAsync("n1", CancellationToken.None);

        (await _notes.ListAsync(CancellationToken.None)).ShouldBeEmpty();
        (await theirs.ListAsync(CancellationToken.None)).Select(note => note.Text).ShouldBe(["Theirs"]);
    }
}
