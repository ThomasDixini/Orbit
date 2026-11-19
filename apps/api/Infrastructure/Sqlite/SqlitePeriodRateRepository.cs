using Microsoft.Data.Sqlite;
using Orbit.Api.Application.Investments;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Rates stored in the <c>period_rates</c> table, one row per kind and month; kind as the enum name (or <c>Custom:</c> and the name of a custom rate) and
/// the month as <c>YYYY-MM</c> text, so month order and text order agree.
/// </summary>
public sealed class SqlitePeriodRateRepository(SqliteConnectionFactory connections) : IPeriodRateRepository
{
    public async Task<IReadOnlyList<PeriodRate>> ListAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT kind, month, basis_points FROM period_rates WHERE user_id = $user ORDER BY month DESC, kind",
            ToRate,
            cancellationToken,
            ("$user", connections.UserId));
    }

    public async Task SaveAsync(PeriodRate rate, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO period_rates (user_id, kind, month, basis_points)
            VALUES ($user, $kind, $month, $basisPoints)
            ON CONFLICT (user_id, kind, month) DO UPDATE SET basis_points = excluded.basis_points
            """,
            cancellationToken,
            ("$user", connections.UserId), ("$kind", PeriodRate.StorageKey(rate.Kind, rate.Name)), ("$month", rate.Month),
            ("$basisPoints", rate.BasisPoints));
    }

    public async Task DeleteAsync(PeriodRateKind kind, string? name, string month, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            "DELETE FROM period_rates WHERE user_id = $user AND kind = $kind AND month = $month",
            cancellationToken,
            ("$user", connections.UserId), ("$kind", PeriodRate.StorageKey(kind, name)), ("$month", month));
    }

    private static PeriodRate ToRate(SqliteDataReader reader)
    {
        var (kind, name) = PeriodRate.FromStorageKey(reader.GetString(0));
        return PeriodRate.Restore(kind, reader.GetString(1), reader.GetInt32(2), name);
    }
}
