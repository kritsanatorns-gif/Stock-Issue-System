namespace StockIssueSystem.Api.Services;

public static class VatCalculator
{
    public static decimal Money(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    public static decimal Allocate(decimal line, decimal subtotal, decimal vat, ref decimal running, ref decimal allocated)
    {
        running += line;
        var cumulative = subtotal <= 0 ? 0 : Money(vat * running / subtotal);
        var result = cumulative - allocated;
        allocated = cumulative;
        return result;
    }

    public static decimal AllocatedQuantityVat(decimal vat, int originalQty, int alreadyUsed, int quantity)
        => originalQty <= 0 ? 0 : Money(vat * (alreadyUsed + quantity) / originalQty) - Money(vat * alreadyUsed / originalQty);
}
