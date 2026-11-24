using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Finance changes to tables that already existed: categories gained a kind (money that only moves between
/// accounts is a transfer), and a card invoice may be paid by someone else, from no account of the
/// person's. Every step checks the shape of the database first, so it runs on every start and is a no-op
/// once done.
/// </summary>
internal static class SqliteFinanceMigration
{
    private const string OldPaymentsTable = "card_payments_old";

    /// <summary>
    /// Adds the <c>kind</c> column to categories that predate it; they stay regular (income or expense).
    /// </summary>
    /// <example><code>await SqliteFinanceMigration.AddCategoryKindAsync(connection, ct);</code></example>
    public static async Task AddCategoryKindAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        if (await SqliteMigrations.HasColumnAsync(connection, "finance_categories", "kind", cancellationToken)) return;
        await SqliteCommands.ExecuteAsync(
            connection,
            "ALTER TABLE finance_categories ADD COLUMN kind TEXT NOT NULL DEFAULT 'Regular'",
            cancellationToken);
    }

    /// <summary>
    /// Rebuilds <c>card_payments</c> so the account a payment comes from may be empty and who paid it can be
    /// kept (SQLite cannot drop a NOT NULL constraint in place). Every stored payment keeps its account.
    /// Must run before the tables are created, which adds the index.
    /// </summary>
    /// <example><code>await SqliteFinanceMigration.AllowPaymentsByOthersAsync(connection, ct);</code></example>
    public static async Task AllowPaymentsByOthersAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        if (!await NeedsPaymentsRebuildAsync(connection, cancellationToken)) return;
        // Takes the write lock up front and checks again, so two starts at once cannot both rebuild it.
        await using var transaction = connection.BeginTransaction(deferred: false);
        if (!await NeedsPaymentsRebuildAsync(connection, cancellationToken)) return;
        await SqliteCommands.ExecuteAsync(
            connection, $"ALTER TABLE card_payments RENAME TO {OldPaymentsTable}", cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, SqliteSchema.CardPaymentsTable, cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, CopyPaymentsStatement, cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, $"DROP TABLE {OldPaymentsTable}", cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    // Recognised by lacking the paid_by column; a database without the table gets it from CREATE TABLE.
    private static async Task<bool> NeedsPaymentsRebuildAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var tables = await SqliteCommands.QueryAsync(
            connection,
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'card_payments'",
            reader => reader.GetInt64(0),
            cancellationToken);
        if (tables[0] == 0) return false;
        return !await SqliteMigrations.HasColumnAsync(connection, "card_payments", "paid_by", cancellationToken);
    }

    // rowid is copied too: payments of one day are listed in the order they were recorded.
    private const string CopyPaymentsStatement = $"""
        INSERT INTO card_payments (rowid, user_id, id, card_id, from_account_id, date, amount_cents)
        SELECT rowid, user_id, id, card_id, from_account_id, date, amount_cents FROM {OldPaymentsTable}
        """;
}
