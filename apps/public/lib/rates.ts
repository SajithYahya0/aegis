export const PRODUCTS = ['motor', 'health', 'property', 'life'] as const;

export type Product = (typeof PRODUCTS)[number];

export const PRODUCT_LABEL: Record<Product, string> = {
  motor: 'Motor',
  health: 'Health',
  property: 'Property',
  life: 'Life',
};

export interface RateCard {
  publishedAt: string;
  perMille: Record<Product, number>;
}

const FILED_RATE: Record<Product, number> = {
  motor: 24.5,
  health: 31,
  property: 4.5,
  life: 6.4,
};

const MARKET_SWING = [1, 1.02, 1.05, 1.03, 0.98, 0.96, 0.99, 1.04];
const LONG_TERM_DISCOUNT = 0.05;
const LONG_TERM_MONTHS = 24;
const HOUR_MS = 3_600_000;

export function topOfTheHour(now = Date.now()): Date {
  return new Date(Math.floor(now / HOUR_MS) * HOUR_MS);
}

export async function currentRateCard(): Promise<RateCard> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const published = topOfTheHour();
  const swing = MARKET_SWING[published.getUTCHours() % MARKET_SWING.length];
  const perMille = Object.fromEntries(
    PRODUCTS.map((product) => [product, Number((FILED_RATE[product] * swing).toFixed(2))]),
  ) as Record<Product, number>;
  return { publishedAt: published.toISOString(), perMille };
}

export function quotePremium(
  card: RateCard,
  product: Product,
  sumInsured: number,
  termMonths: number,
): number {
  const base = (card.perMille[product] * sumInsured) / 1000;
  const adjusted = termMonths >= LONG_TERM_MONTHS ? base * (1 - LONG_TERM_DISCOUNT) : base;
  return Math.round(adjusted / 10) * 10;
}

export function formatRupees(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}
