using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>Finance tables from before transfers and payments by others are brought up to date on start.</summary>
public sealed class SqliteFinanceMigrationTests : IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;

    public SqliteFinanceMigrationTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString, new MovableCurrentUser());
    }

    public void Dispose() => _database.Dispose();

    private async Task MigrateAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
    }

    private async Task RunAsync(string sql)
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteCommands.ExecuteAsync(connection, sql, CancellationToken.None);
    }

    private async Task<long> CountAsync(string sql)
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        return (await SqliteCommands.QueryAsync(connection, sql, reader => reader.GetInt64(0), CancellationToken.None))[0];
    }

    // The card_payments table as it was while every payment came from a bank account.
    private const string OldCardPayments = """
        INSERT INTO users (id, email, name, password_hash) VALUES ('u1', 'u1@example.com', 'U1', '');
        INSERT INTO accounts (user_id, id, name, kind) VALUES ('u1', 'checking', 'Checking', 'BankAccount');
        INSERT INTO accounts (user_id, id, name, kind, credit_limit_cents, closing_day, due_day)
            VALUES ('u1', 'visa', 'Visa', 'CreditCard', 500000, 3, 10);
        PRAGMA foreign_keys = OFF;
        DROP TABLE card_payments;
        CREATE TABLE card_payments (
            user_id TEXT NOT NULL, id TEXT NOT NULL, card_id TEXT NOT NULL, from_account_id TEXT NOT NULL,
            date TEXT NOT NULL, amount_cents INTEGER NOT NULL, PRIMARY KEY (user_id, id)
        );
        CREATE INDEX ix_card_payments_date ON card_payments (user_id, date);
        INSERT INTO card_payments VALUES ('u1', 'p1', 'visa', 'checking', '2026-11-10', 28640);
        """;

    [Fact]
    public async Task CategoriesWithoutAKind_GainTheColumnAndStayRegular()
    {
        await MigrateAsync();
        await RunAsync("""
            ALTER TABLE finance_categories DROP COLUMN kind;
            PRAGMA foreign_keys = OFF;
            INSERT INTO finance_categories (user_id, id, name) VALUES ('u1', 'food', 'Food');
            """);

        await MigrateAsync();

        (await CountAsync("SELECT COUNT(*) FROM finance_categories WHERE id = 'food' AND kind = 'Regular'")).ShouldBe(1);
    }

    [Fact]
    public async Task OldCardPayments_KeepTheirAccountAndGainWhoPaid()
    {
        await MigrateAsync();
        await RunAsync(OldCardPayments);

        await MigrateAsync();

        (await CountAsync("SELECT COUNT(*) FROM card_payments WHERE id = 'p1' AND from_account_id = 'checking' AND paid_by IS NULL"))
            .ShouldBe(1);
    }

    [Fact]
    public async Task AfterTheRebuild_APaymentWithoutAnAccountCanBeStored()
    {
        await MigrateAsync();
        await RunAsync(OldCardPayments);
        await MigrateAsync();

        await RunAsync("""
            PRAGMA foreign_keys = OFF;
            INSERT INTO card_payments (user_id, id, card_id, paid_by, date, amount_cents)
            VALUES ('u1', 'p2', 'visa', 'Sister', '2026-11-12', 1000);
            """);

        (await CountAsync("SELECT COUNT(*) FROM card_payments WHERE from_account_id IS NULL")).ShouldBe(1);
        (await CountAsync("SELECT COUNT(*) FROM sqlite_master WHERE name = 'ix_card_payments_date'")).ShouldBe(1);
    }

    [Fact]
    public async Task TheRebuild_RunsOnce()
    {
        await MigrateAsync();
        await RunAsync(OldCardPayments);

        await MigrateAsync();
        await MigrateAsync();

        (await CountAsync("SELECT COUNT(*) FROM card_payments")).ShouldBe(1);
        (await CountAsync("SELECT COUNT(*) FROM sqlite_master WHERE name = 'card_payments_old'")).ShouldBe(0);
    }
}
