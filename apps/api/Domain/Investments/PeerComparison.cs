namespace Orbit.Api.Domain.Investments;

/// <summary>A competitor (or the sector average) and the numbers the analysed company is compared with.</summary>
public sealed class PeerComparison
{
    public const int MaxNameLength = 80;

    public string Name { get; }
    public AnalysisEntries Entries { get; }

    private PeerComparison(string name, AnalysisEntries entries)
    {
        Name = name;
        Entries = entries;
    }

    /// <summary>Builds a peer with a non-blank name of up to 80 characters, kept trimmed.</summary>
    /// <example><code>PeerComparison.Create(" SAP ", AnalysisEntries.Create(noTexts, metrics, AnalysisFields.Peer)).Name; // "SAP"</code></example>
    public static PeerComparison Create(string name, AnalysisEntries entries) =>
        new(RequiredText.Require(name, MaxNameLength, "peer name"), entries);

    /// <summary>Rebuilds a stored peer as it was saved, without today's rules.</summary>
    /// <example><code>PeerComparison.Restore("SAP", entries);</code></example>
    internal static PeerComparison Restore(string name, AnalysisEntries entries) => new(name, entries);
}
