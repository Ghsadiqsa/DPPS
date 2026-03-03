/**
 * Currency conversion utility.
 * Maintains exchange rates (to USD base) and provides conversion functions.
 * In production, this would connect to an external FX API.
 */

// Static exchange rates (to USD). Updated periodically.
// These represent: 1 unit of [currency] = X USD
const EXCHANGE_RATES: Record<string, number> = {
    USD: 1.0,
    EUR: 1.08,
    GBP: 1.27,
    CHF: 1.12,
    SEK: 0.096,
    NOK: 0.094,
    DKK: 0.145,
    JPY: 0.0067,
    CAD: 0.74,
    AUD: 0.65,
    NZD: 0.61,
    SGD: 0.74,
    HKD: 0.128,
    CNY: 0.14,
    INR: 0.012,
    BRL: 0.20,
    MXN: 0.058,
    ZAR: 0.055,
    AED: 0.27,
    SAR: 0.27,
    KRW: 0.00075,
    TWD: 0.031,
    THB: 0.028,
    PLN: 0.25,
    CZK: 0.043,
    HUF: 0.0027,
    TRY: 0.031,
    ILS: 0.27,
    PHP: 0.018,
    IDR: 0.000063,
    MYR: 0.21,
    VND: 0.000040,
    NGN: 0.00065,
    KES: 0.0077,
    EGP: 0.021,
    PKR: 0.0036,
    BDT: 0.0091,
    COP: 0.00025,
    ARS: 0.0011,
    CLP: 0.0011,
    PEN: 0.27,
};

/**
 * Convert an amount from source currency to target currency.
 */
export function convertCurrency(amount: number, from: string, to: string = 'USD'): number {
    const fromRate = EXCHANGE_RATES[from.toUpperCase()];
    const toRate = EXCHANGE_RATES[to.toUpperCase()];

    if (!fromRate || !toRate) {
        // If unknown currency, return amount as-is
        return amount;
    }

    // Convert to USD first, then to target
    const usdAmount = amount * fromRate;
    return usdAmount / toRate;
}

/**
 * Get the exchange rate from one currency to another.
 */
export function getExchangeRate(from: string, to: string = 'USD'): number {
    const fromRate = EXCHANGE_RATES[from.toUpperCase()];
    const toRate = EXCHANGE_RATES[to.toUpperCase()];
    if (!fromRate || !toRate) return 1;
    return fromRate / toRate;
}

/**
 * Format an amount in a specific currency.
 */
export function formatCurrency(amount: number | string | null | undefined, currency: string = 'USD'): string {
    const numericAmount = typeof amount === 'number' ? amount : Number(amount || 0);
    const safeAmount = isNaN(numericAmount) ? 0 : numericAmount;

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase(),
            maximumFractionDigits: 0,
        }).format(safeAmount);
    } catch {
        return `${currency} ${safeAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
}

/**
 * Get all supported currencies.
 */
export function getSupportedCurrencies(): string[] {
    return Object.keys(EXCHANGE_RATES);
}

/**
 * Get all exchange rates.
 */
export function getAllExchangeRates(): Record<string, number> {
    return { ...EXCHANGE_RATES };
}
