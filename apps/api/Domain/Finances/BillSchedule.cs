namespace Orbit.Api.Domain.Finances;

/// <summary>Spreads a recurring bill into one bill per occurrence.</summary>
public static class BillSchedule
{
    public const int MinOccurrences = 2;
    public const int MaxOccurrences = 60;

    /// <summary>
    /// The first occurrence keeps the given id and the next ones are numbered after it (<c>b1</c>,
    /// <c>b1-2</c>, <c>b1-3</c>…), so repeating the same request yields the same ids. Due dates are
    /// counted from the first one, so a bill due on the 31st falls on each month's last day when it must.
    /// </summary>
    /// <example><code>BillSchedule.Occurrences("b1", BillKind.Payable, "Rent", "housing", 150000, due, BillRecurrence.Monthly, 12).Count; // 12</code></example>
    public static IReadOnlyList<Bill> Occurrences(
        string id, BillKind kind, string description, string categoryId, long amountCents,
        DateOnly firstDueDate, BillRecurrence recurrence, int count, bool amountIsTotal = false)
    {
        RequireCount(count);
        RequireInstallmentsForTotal(recurrence, amountIsTotal);
        var series = EntityId.Require(id, "bill id");
        return Enumerable.Range(1, count)
            .Select(number => Bill.Create(
                number == 1 ? series : EntityId.Require($"{series}-{number}", "bill id of the occurrence"),
                kind, description, categoryId, ShareOf(amountCents, count, number, amountIsTotal),
                DueDateOf(firstDueDate, recurrence, number - 1),
                new BillSeries(series, recurrence, number, count)))
            .ToList();
    }

    // A total is split in whole cents; the cents left over go one each to the first installments, so the
    // installments always add up to the total.
    private static long ShareOf(long amountCents, int count, int number, bool amountIsTotal)
    {
        if (!amountIsTotal) return amountCents;
        return amountCents / count + (number <= amountCents % count ? 1 : 0);
    }

    private static void RequireInstallmentsForTotal(BillRecurrence recurrence, bool amountIsTotal)
    {
        if (!amountIsTotal || recurrence == BillRecurrence.Installments) return;
        throw new DomainRuleException(
            $"Expected an amount that is a total to belong to installments, received a {recurrence} recurrence");
    }

    private static DateOnly DueDateOf(DateOnly first, BillRecurrence recurrence, int steps) =>
        recurrence == BillRecurrence.Yearly ? first.AddYears(steps) : first.AddMonths(steps);

    private static void RequireCount(int count)
    {
        if (count is >= MinOccurrences and <= MaxOccurrences) return;
        throw new DomainRuleException(
            $"Expected the number of occurrences to be from {MinOccurrences} to {MaxOccurrences}, received {count}");
    }
}
