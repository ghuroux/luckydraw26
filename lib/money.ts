/**
 * Format a money value for display. Currency code + locale are hard-coded
 * to ZAR / en-ZA for now; Phase 6 introduces Organisation.currencyCode/locale
 * and this helper will read from there.
 */
export function formatMoney(
  value: string | number | null | undefined,
  options: { showDecimals?: boolean } = {},
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";

  const showDecimals = options.showDecimals ?? true;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
    currencyDisplay: "symbol",
  }).format(n);
}
