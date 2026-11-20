using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class PeriodRateTests
{
    [Fact]
    public void Rate_KeepsItsKindMonthAndValue()
    {
        var rate = PeriodRate.Create(PeriodRateKind.Selic, "2026-10", 1300);

        (rate.Kind, rate.Month, rate.BasisPoints).ShouldBe((PeriodRateKind.Selic, "2026-10", 1300));
    }

    [Theory]
    [InlineData("2026-13")]
    [InlineData("2026-00")]
    [InlineData("2026-1")]
    [InlineData("202610")]
    [InlineData("2026-10-01")]
    [InlineData("")]
    public void Rate_RejectsAMonthNotWrittenYyyyMm(string month)
    {
        var error = Should.Throw<DomainRuleException>(() => PeriodRate.Create(PeriodRateKind.Ipca, month, 50));
        error.Message.ShouldContain("YYYY-MM");
    }

    [Theory]
    [InlineData(-1000)]
    [InlineData(0)]
    [InlineData(10_000)]
    public void Rate_AcceptsTheLimitsOfTheRange(int basisPoints)
    {
        PeriodRate.Create(PeriodRateKind.IncomeTax, "2026-10", basisPoints).BasisPoints.ShouldBe(basisPoints);
    }

    [Theory]
    [InlineData(-1001)]
    [InlineData(10_001)]
    public void Rate_RejectsAValueOutsideTheRange(int basisPoints)
    {
        var error = Should.Throw<DomainRuleException>(
            () => PeriodRate.Create(PeriodRateKind.Selic, "2026-10", basisPoints));
        error.Message.ShouldContain($"received {basisPoints}");
    }

    [Fact]
    public void Rate_RejectsAnUnknownKind()
    {
        var error = Should.Throw<DomainRuleException>(() => PeriodRate.Create((PeriodRateKind)9, "2026-10", 100));
        error.Message.ShouldContain("received 9");
    }

    [Fact]
    public void Create_ACustomRateHasTheNameTheUserGaveIt()
    {
        var rate = PeriodRate.Create(PeriodRateKind.Custom, "2026-10", 60, "  Poupança ");

        (rate.Kind, rate.Name).ShouldBe((PeriodRateKind.Custom, "Poupança"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("Selic")]
    [InlineData("ipca")]
    public void Create_ACustomRateNeedsANameOfItsOwn(string name)
    {
        Should.Throw<DomainRuleException>(() => PeriodRate.Create(PeriodRateKind.Custom, "2026-10", 60, name));
    }

    [Fact]
    public void StorageKey_KeepsTheNameOfACustomRateAndReadsItBack()
    {
        var key = PeriodRate.StorageKey(PeriodRateKind.Custom, "Poupança");

        (key, PeriodRate.FromStorageKey(key), PeriodRate.FromStorageKey("Ipca")).ShouldBe(
            ("Custom:Poupança", (PeriodRateKind.Custom, "Poupança"), (PeriodRateKind.Ipca, "")));
    }
}
