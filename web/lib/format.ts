const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function formatFiatMinor(amountMinor: string | number | null | undefined, currency = "USD") {
  if (amountMinor == null || amountMinor === "") return "--";
  const n = typeof amountMinor === "string" ? Number(amountMinor) : amountMinor;
  if (!Number.isFinite(n)) return "--";
  if (n === 0) return currency === "USD" ? "$0.00" : "0.00";
  const major = n / 100;
  if (currency !== "USD") {
    return `${major.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
  }
  return usd.format(major);
}

export function formatDateUtc(iso: string | null | undefined) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function shortHash(value: string | null | undefined) {
  if (!value) return "--";
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function explorerTx(txHash: string) {
  return `https://coston2-explorer.flare.network/tx/${txHash}`;
}
