using System.Globalization;
using Orbit.Api.Domain.Goals;
using Orbit.Api.Domain.Users;
using Orbit.Api.Infrastructure.Sqlite;
using Microsoft.Data.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>A database created before the current schema is brought up to date, each step once.</summary>
public sealed class SqliteMigrationTests : IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly MovableCurrentUser _user = new();
    private readonly SqliteConnectionFactory _connections;

    public SqliteMigrationTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString, _user);
    }

    public void Dispose() => _database.Dispose();

    /// <summary>The goals table as it was when progress was one number on the goal.</summary>
    private async Task CreateOldDatabaseAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL);
            INSERT INTO categories VALUES ('study', 'Study', '#7DD3FC');
            CREATE TABLE goals (
                id TEXT PRIMARY KEY,
                category_id TEXT NOT NULL REFERENCES categories (id),
                title TEXT NOT NULL, type TEXT NOT NULL, period TEXT NOT NULL,
                target INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, unit TEXT NULL, deadline TEXT NULL
            );
            INSERT INTO goals (id, category_id, title, type, period, target, done)
                VALUES ('g1', 'study', 'Study', 'frequency', 'weekly', 5, 3),
                       ('g2', 'study', 'Rest', 'frequency', 'weekly', 5, 0);
            """,
            CancellationToken.None);
    }

    private async Task MigrateAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        var owners = await SqliteCommands.QueryAsync(
            connection, "SELECT id FROM users", reader => reader.GetString(0), CancellationToken.None);
        if (owners.Count == 1) _user.Id = owners[0];
    }

    private async Task<long> CountAsync(string sql)
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        return (await SqliteCommands.QueryAsync(connection, sql, reader => reader.GetInt64(0), CancellationToken.None))[0];
    }

    /// <summary>
    /// The day SQLite dated the legacy entry on. Read back instead of taken from the test's clock, so the
    /// test cannot fail when midnight (or a Monday) falls between the migration and the check.
    /// </summary>
    private async Task<DateOnly> MigrationDayAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        var days = await SqliteCommands.QueryAsync(
            connection, "SELECT date FROM goal_progress WHERE event_id = 'legacy:g1'",
            reader => DateOnly.ParseExact(reader.GetString(0), "yyyy-MM-dd", CultureInfo.InvariantCulture),
            CancellationToken.None);
        return days.Single();
    }

    [Fact]
    public async Task OldGoals_KeepTheirProgressAsOneManualEntry_AndCountBlocksFromNowOn()
    {
        await CreateOldDatabaseAsync();

        await MigrateAsync();

        var goals = new SqliteGoalRepository(_connections);
        var goal = (await goals.FindAsync("g1", await MigrationDayAsync(), CancellationToken.None))!;
        (goal.Definition.Tracking, goal.Done).ShouldBe((GoalTracking.Blocks, 3));
        (await CountAsync("SELECT COUNT(*) FROM goal_progress")).ShouldBe(1);
    }

    [Fact]
    public async Task TheVersionIsRecorded_SoAStepNeverRunsTwice()
    {
        await CreateOldDatabaseAsync();
        await MigrateAsync();
        var goals = new SqliteGoalRepository(_connections);
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(connection, "DELETE FROM goal_progress", CancellationToken.None);
        }

        await MigrateAsync();

        (await CountAsync("SELECT COUNT(*) FROM goal_progress")).ShouldBe(0);
        (await CountAsync("PRAGMA user_version")).ShouldBe(SqliteSchema.CurrentVersion);
        (await goals.ListAsync(TestDays.Today, CancellationToken.None))
            .Select(goal => goal.Done).ShouldBe([0, 0]);
    }

    [Fact]
    public async Task AFreshDatabase_IsCreatedAtTheCurrentVersionWithNothingToMigrate()
    {
        await MigrateAsync();

        (await CountAsync("PRAGMA user_version")).ShouldBe(SqliteSchema.CurrentVersion);
        (await CountAsync("SELECT COUNT(*) FROM pragma_table_info('goals') WHERE name = 'tracking'")).ShouldBe(1);
    }

    [Fact]
    public async Task OldAccounts_GainAnOpeningBalanceAndCardsGetTheStarterTerms()
    {
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                """
                CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL);
                INSERT INTO accounts VALUES ('checking-account', 'Checking account', 'BankAccount'),
                                            ('credit-card', 'Credit card', 'CreditCard');
                PRAGMA user_version = 2;
                """,
                CancellationToken.None);
        }

        await MigrateAsync();

        var accounts = await new SqliteAccountRepository(_connections).ListAsync(CancellationToken.None);
        accounts.Select(account => (account.OpeningBalanceCents, account.Card))
            .ShouldBe([(0L, null), (0L, FinanceStarterSeed.CardTerms)]);
    }

    [Fact]
    public async Task StoredGoals_GetTheTrackingTheirTypeImplies()
    {
        await CreateOldDatabaseAsync();
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                """
                ALTER TABLE goals ADD COLUMN tracking TEXT NOT NULL DEFAULT 'manual';
                INSERT INTO goals (id, category_id, title, type, period, target, unit, deadline, tracking)
                    VALUES ('g3', 'study', 'Course', 'objective', 'custom', 12, 'modules', '2026-12-15', 'blocks');
                UPDATE goals SET tracking = 'tasks' WHERE id = 'g2';
                PRAGMA user_version = 1;
                """,
                CancellationToken.None);
        }

        await MigrateAsync();

        (await CountAsync("SELECT COUNT(*) FROM goals WHERE id = 'g2' AND tracking = 'blocks'")).ShouldBe(1);
        (await CountAsync("SELECT COUNT(*) FROM goals WHERE id = 'g3' AND tracking = 'manual'")).ShouldBe(1);
    }

    [Fact]
    public async Task AnInvestmentsTableWithoutRisk_GainsTheColumnAndKeepsItsRows()
    {
        await MigrateAsync();
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                """
                PRAGMA foreign_keys = OFF;
                DROP TABLE investment_notes;
                ALTER TABLE investments DROP COLUMN risk;
                INSERT INTO investments (user_id, id, name, kind) VALUES ('u1', 'petr4', 'PETR4', 'Stock');
                """,
                CancellationToken.None);
        }

        await MigrateAsync();

        (await CountAsync("SELECT COUNT(*) FROM pragma_table_info('investments') WHERE name = 'risk'")).ShouldBe(1);
        (await CountAsync("SELECT COUNT(*) FROM investments WHERE id = 'petr4' AND risk IS NULL")).ShouldBe(1);
    }

    // The shape before history was kept: outcomes cascaded with their routine and goals had no archive day.
    private async Task GoBackToHistoryThatCascadesAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            PRAGMA foreign_keys = OFF;
            DROP TABLE block_outcomes;
            CREATE TABLE block_outcomes (
                user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                routine_id TEXT NOT NULL, block_id TEXT NOT NULL, date TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL,
                PRIMARY KEY (user_id, routine_id, block_id, date),
                FOREIGN KEY (user_id, routine_id) REFERENCES routines (user_id, id) ON DELETE CASCADE
            );
            CREATE INDEX ix_block_outcomes_date ON block_outcomes (user_id, date);
            ALTER TABLE goals DROP COLUMN archived_on;
            INSERT INTO users (id, email, name, password_hash) VALUES ('u1', 'u1@example.com', 'U', '');
            INSERT INTO routines (user_id, id, name, days, start_time, end_time) VALUES ('u1', 'weekdays', 'Weekdays', '0', '08:00', '17:00');
            INSERT INTO routine_blocks (user_id, routine_id, id, position, name, start_time, end_time, category_id)
                VALUES ('u1', 'weekdays', 'work', 0, 'Work', '08:00', '12:00', NULL);
            INSERT INTO block_outcomes VALUES ('u1', 'weekdays', 'work', '2026-10-27', 'done', '11:20'),
                                              ('u1', 'weekdays', 'removed', '2026-10-27', 'done', '12:00');
            """,
            CancellationToken.None);
    }

    [Fact]
    public async Task OutcomesThatCascadedWithTheirRoutine_AreRebuiltWithoutItAndNamedAfterTheirBlock()
    {
        await MigrateAsync();
        await GoBackToHistoryThatCascadesAsync();

        await MigrateAsync();

        (await CountAsync("SELECT COUNT(*) FROM pragma_foreign_key_list('block_outcomes') WHERE \"table\" = 'routines'"))
            .ShouldBe(0);
        (await CountAsync("SELECT COUNT(*) FROM block_outcomes")).ShouldBe(2);
        (await CountAsync("SELECT COUNT(*) FROM block_outcomes WHERE block_id = 'work' AND block_name = 'Work' AND routine_name = 'Weekdays'"))
            .ShouldBe(1);
        (await CountAsync("SELECT COUNT(*) FROM block_outcomes WHERE block_id = 'removed' AND block_name IS NULL")).ShouldBe(1);
        (await CountAsync("SELECT COUNT(*) FROM sqlite_master WHERE name = 'ix_block_outcomes_date'")).ShouldBe(1);
        (await CountAsync("SELECT COUNT(*) FROM pragma_table_info('goals') WHERE name = 'archived_on'")).ShouldBe(1);
    }

    [Fact]
    public async Task AfterTheRebuild_DeletingTheRoutineKeepsItsOutcomes()
    {
        await MigrateAsync();
        await GoBackToHistoryThatCascadesAsync();
        await MigrateAsync();

        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(
                connection, "DELETE FROM routines WHERE id = 'weekdays'", CancellationToken.None);
        }

        (await CountAsync("SELECT COUNT(*) FROM block_outcomes")).ShouldBe(2);
    }

    [Fact]
    public async Task OldRecords_BelongToAPlaceholderOwnerNobodyCanSignInTo()
    {
        await CreateOldDatabaseAsync();

        await MigrateAsync();

        (await CountAsync("SELECT COUNT(*) FROM users WHERE password_hash = ''")).ShouldBe(1);
        (await CountAsync("SELECT COUNT(*) FROM categories WHERE user_id = (SELECT id FROM users)")).ShouldBe(1);
        (await CountAsync("SELECT COUNT(*) FROM goals WHERE user_id = (SELECT id FROM users)")).ShouldBe(2);
    }

    [Fact]
    public async Task TheOldStarterMarkers_AreDropped_BecauseNewAccountsStartEmpty()
    {
        await CreateOldDatabaseAsync();

        await MigrateAsync();

        (await CountAsync(
            "SELECT COUNT(*) FROM sqlite_master WHERE name IN ('sample_seed', 'finance_seed')")).ShouldBe(0);
    }

    [Fact]
    public async Task TheFirstAccount_TakesOverTheOldRecordsAndTheSecondOneStartsEmpty()
    {
        await CreateOldDatabaseAsync();
        await MigrateAsync();
        var users = new SqliteUserRepository(_connections);

        var first = await users.AddAsync(User.Register("ana@mail.com", "Ana"), "hash-a", CancellationToken.None);
        var second = await users.AddAsync(User.Register("bia@mail.com", "Bia"), "hash-b", CancellationToken.None);

        first!.Id.ShouldBe(_user.Id);
        second!.Id.ShouldNotBe(first.Id);
        (await CountAsync("SELECT COUNT(*) FROM users")).ShouldBe(2);
        (await CountAsync($"SELECT COUNT(*) FROM goals WHERE user_id = '{second.Id}'")).ShouldBe(0);
    }
}
