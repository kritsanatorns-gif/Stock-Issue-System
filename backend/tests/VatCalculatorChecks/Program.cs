using StockIssueSystem.Api.Services;

static void Equal(decimal expected, decimal actual)
{
    if (expected != actual) throw new Exception($"Expected {expected}, got {actual}");
}
Equal(8.40m, VatCalculator.Money(120m * 7 / 100));
Equal(0.01m, VatCalculator.Money(0.005m));
decimal running = 0, allocated = 0;
var parts = new[] { 0.05m, 0.05m, 0.05m }
    .Select(price => VatCalculator.Allocate(price, 0.15m, 0.01m, ref running, ref allocated)).ToArray();
Equal(0.01m, parts.Sum());
Equal(8.40m, Enumerable.Range(0, 13).Sum(index => VatCalculator.AllocatedQuantityVat(8.40m, 13, index, 1)));
Equal(8.40m, VatCalculator.AllocatedQuantityVat(8.40m, 13, 0, 3) + VatCalculator.AllocatedQuantityVat(8.40m, 13, 3, 10));
Equal(0, VatCalculator.AllocatedQuantityVat(0, 12, 0, 12));
Equal(12m, VatCalculator.AllocatedQuantityVat(7m, 10, 0, 10) + VatCalculator.AllocatedQuantityVat(5m, 10, 0, 10));
Console.WriteLine("VAT checks passed: rounding, invoice allocation, bonus quantities, split issues, zero VAT, mixed lots.");
