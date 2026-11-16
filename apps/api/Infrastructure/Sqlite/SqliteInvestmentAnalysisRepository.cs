using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Data.Sqlite;
using Orbit.Api.Application.Investments;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Fundamental analyses stored in the <c>investment_analyses</c> table. The day is <c>YYYY-MM-DD</c> text so
/// date order and text order agree; what was filled in is one JSON document, since its fields come from
/// catalogs that grow and are only ever read whole, never queried one by one.
/// </summary>
public sealed class SqliteInvestmentAnalysisRepository(SqliteConnectionFactory connections) : IInvestmentAnalysisRepository
{
    private const string DateFormat = "yyyy-MM-dd";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    public async Task<IReadOnlyList<InvestmentAnalysis>> ListAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            """
            SELECT id, investment_id, date, content FROM investment_analyses
            WHERE user_id = $user ORDER BY date DESC, rowid DESC
            """,
            ToAnalysis,
            cancellationToken,
            ("$user", connections.UserId));
    }

    public async Task SaveAsync(InvestmentAnalysis analysis, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO investment_analyses (user_id, id, investment_id, date, content)
            VALUES ($user, $id, $investmentId, $date, $content)
            ON CONFLICT (user_id, id) DO UPDATE SET
                investment_id = excluded.investment_id, date = excluded.date, content = excluded.content
            """,
            cancellationToken,
            ("$user", connections.UserId), ("$id", analysis.Id), ("$investmentId", analysis.InvestmentId),
            ("$date", analysis.Date.ToString(DateFormat, CultureInfo.InvariantCulture)),
            ("$content", JsonSerializer.Serialize(StoredContent.From(analysis.Content), Json)));
    }

    public async Task DeleteAsync(string analysisId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection, "DELETE FROM investment_analyses WHERE user_id = $user AND id = $id", cancellationToken,
            ("$id", analysisId), ("$user", connections.UserId));
    }

    private static InvestmentAnalysis ToAnalysis(SqliteDataReader reader)
    {
        var content = JsonSerializer.Deserialize<StoredContent>(reader.GetString(3), Json)
            ?? throw new InvalidOperationException(
                $"Expected the content of investment analysis {reader.GetString(0)} to be a JSON object, received null");
        return InvestmentAnalysis.Restore(
            reader.GetString(0), reader.GetString(1),
            DateOnly.ParseExact(reader.GetString(2), DateFormat, CultureInfo.InvariantCulture), content.ToContent());
    }

    private sealed record StoredEntries(Dictionary<string, string> Texts, Dictionary<string, decimal> Metrics)
    {
        public static StoredEntries From(AnalysisEntries entries) =>
            new(new Dictionary<string, string>(entries.Texts), new Dictionary<string, decimal>(entries.Metrics));

        public AnalysisEntries ToEntries() => AnalysisEntries.Restore(Texts, Metrics);
    }

    private sealed record StoredPeer(string Name, StoredEntries Entries);

    private sealed record StoredScenario(ScenarioKind Kind, StoredEntries Entries);

    private sealed record StoredContent(
        AnalysisRecommendation? Recommendation, StoredEntries Company, List<StoredPeer> Peers,
        List<StoredScenario> Scenarios)
    {
        public static StoredContent From(AnalysisContent content) =>
            new(content.Recommendation, StoredEntries.From(content.Company),
                content.Peers.Select(peer => new StoredPeer(peer.Name, StoredEntries.From(peer.Entries))).ToList(),
                content.Scenarios
                    .Select(scenario => new StoredScenario(scenario.Kind, StoredEntries.From(scenario.Entries)))
                    .ToList());

        public AnalysisContent ToContent() =>
            new(Recommendation, Company.ToEntries(),
                Peers.Select(peer => PeerComparison.Restore(peer.Name, peer.Entries.ToEntries())).ToList(),
                Scenarios.Select(scenario => AnalysisScenario.Restore(scenario.Kind, scenario.Entries.ToEntries()))
                    .ToList());
    }
}
