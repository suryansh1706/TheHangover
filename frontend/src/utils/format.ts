const numberFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const currencyFormats = new Map<string, Intl.NumberFormat>();

function formatCurrency(amount: number, currency: string) {
  let formatter = currencyFormats.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    currencyFormats.set(currency, formatter);
  }
  return formatter.format(amount);
}

export function money(min: number | null, max: number | null, currency: string | null) {
  if (min == null && max == null) return "Price not listed";
  if (currency) {
    const format = (amount: number) => formatCurrency(amount, currency);
    if (min != null && max != null) return `${format(min)}\u2013${format(max)}`;
    return `From ${format(min ?? max ?? 0)}`;
  }
  if (min != null && max != null)
    return `${numberFormat.format(min)}\u2013${numberFormat.format(max)} (currency unavailable)`;
  return `From ${numberFormat.format(min ?? max ?? 0)} (currency unavailable)`;
}

export function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function numOrNull(value: string) {
  return value ? Number(value) : null;
}
