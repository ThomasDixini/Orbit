using System.Globalization;
using Microsoft.Data.Sqlite;
using Orbit.Api.Application.Investments;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Notes about investments stored in the <c>investment_notes</c> table; kind as the enum name and the day
/// as <c>YYYY-MM-DD</c> text so date order and text order agree.
/// </summary>
public sealed class SqliteInvestmentNoteRepository(SqliteConnectionFactory connections) : IInvestmentNoteRepository
{
    private const string DateFormat = "yyyy-MM-dd";

    public async Task<IReadOnlyList<InvestmentNote>> ListAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            """
            SELECT id, investment_id, kind, date, text FROM investment_notes
            WHERE user_id = $user ORDER BY date DESC, rowid DESC
            """,
            ToNote,
            cancellationToken,
            ("$user", connections.UserId));
    }

    public async Task SaveAsync(InvestmentNote note, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO investment_notes (user_id, id, investment_id, kind, date, text)
            VALUES ($user, $id, $investmentId, $kind, $date, $text)
            ON CONFLICT (user_id, id) DO UPDATE SET
                investment_id = excluded.investment_id, kind = excluded.kind,
                date = excluded.date, text = excluded.text
            """,
            cancellationToken,
            ("$user", connections.UserId), ("$id", note.Id), ("$investmentId", note.InvestmentId),
            ("$kind", note.Kind.ToString()), ("$date", note.Date.ToString(DateFormat, CultureInfo.InvariantCulture)),
            ("$text", note.Text));
    }

    public async Task DeleteAsync(string noteId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection, "DELETE FROM investment_notes WHERE user_id = $user AND id = $id", cancellationToken,
            ("$id", noteId), ("$user", connections.UserId));
    }

    private static InvestmentNote ToNote(SqliteDataReader reader) =>
        InvestmentNote.Restore(
            reader.GetString(0), reader.GetString(1), Enum.Parse<InvestmentNoteKind>(reader.GetString(2)),
            DateOnly.ParseExact(reader.GetString(3), DateFormat, CultureInfo.InvariantCulture), reader.GetString(4));
}
