using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Keeps the History tab intact when a routine or a goal is deleted. Outcomes of routine blocks used to
/// point at their routine with <c>ON DELETE CASCADE</c>, so deleting the routine erased every day it was
/// done; they now hold no such reference and carry the names they were recorded with. Goals are archived
/// (<c>archived_on</c>) instead of removed, so their progress stays. Every step checks the shape of the
/// database first, so it runs on every start and is a no-op once done.
/// </summary>
internal static class SqliteHistoryMigration
{
    private const string OldTable = "block_outcomes_old";

    /// <summary>
    /// Rebuilds <c>block_outcomes</c> without its foreign key to the routines when it still has one (it is
    /// recognised by lacking the name columns). Must run before the tables are created, which adds the index.
    /// </summary>
    /// <example><code>await SqliteHistoryMigration.DetachBlockOutcomesAsync(connection, ct);</code></example>
    public static async Task DetachBlockOutcomesAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        if (!await NeedsRebuildAsync(connection, cancellationToken)) return;
        // Takes the write lock up front and checks again, so two starts at once cannot both rebuild it.
        await using var transaction = connection.BeginTransaction(deferred: false);
        if (!await NeedsRebuildAsync(connection, cancellationToken)) return;
        await SqliteCommands.ExecuteAsync(connection, $"ALTER TABLE block_outcomes RENAME TO {OldTable}", cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, SqliteSchema.BlockOutcomesTable, cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            $"""
            INSERT INTO block_outcomes (user_id, routine_id, block_id, date, kind, at)
            SELECT user_id, routine_id, block_id, date, kind, at FROM {OldTable}
            """,
            cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, $"DROP TABLE {OldTable}", cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    /// <summary>
    /// Adds the <c>archived_on</c> column to goals that predate it, and gives the outcomes recorded before
    /// names were kept the names their routine and block have now, while those still exist.
    /// </summary>
    /// <example><code>await SqliteHistoryMigration.KeepHistoryAsync(connection, ct);</code></example>
    public static async Task KeepHistoryAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        if (!await SqliteMigrations.HasColumnAsync(connection, "goals", "archived_on", cancellationToken))
        {
            await SqliteCommands.ExecuteAsync(
                connection, "ALTER TABLE goals ADD COLUMN archived_on TEXT NULL", cancellationToken);
        }
        await SqliteCommands.ExecuteAsync(connection, NameOutcomesStatement, cancellationToken);
    }

    private static async Task<bool> NeedsRebuildAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var tables = await SqliteCommands.QueryAsync(
            connection,
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'block_outcomes'",
            reader => reader.GetInt64(0),
            cancellationToken);
        if (tables[0] == 0) return false;
        return !await SqliteMigrations.HasColumnAsync(connection, "block_outcomes", "block_name", cancellationToken);
    }

    private const string NameOutcomesStatement = """
        UPDATE block_outcomes SET
            block_name = (
                SELECT block.name FROM routine_blocks block
                WHERE block.user_id = block_outcomes.user_id AND block.routine_id = block_outcomes.routine_id
                    AND block.id = block_outcomes.block_id),
            routine_name = (
                SELECT routine.name FROM routines routine
                WHERE routine.user_id = block_outcomes.user_id AND routine.id = block_outcomes.routine_id),
            category_id = (
                SELECT block.category_id FROM routine_blocks block
                WHERE block.user_id = block_outcomes.user_id AND block.routine_id = block_outcomes.routine_id
                    AND block.id = block_outcomes.block_id)
        WHERE block_name IS NULL AND EXISTS (
            SELECT 1 FROM routine_blocks block
            WHERE block.user_id = block_outcomes.user_id AND block.routine_id = block_outcomes.routine_id
                AND block.id = block_outcomes.block_id)
        """;
}
