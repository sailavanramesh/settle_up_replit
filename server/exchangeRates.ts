import { db } from "./db";
import { conversionRates } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface RateResult {
  rate: number;
  source: "cache" | "api" | "fallback";
  date: string;
}

function normalizeDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date: string
): Promise<RateResult> {
  if (fromCurrency === toCurrency) {
    return { rate: 1.0, source: "cache", date };
  }

  const dateStr = date.split("T")[0];
  const normalizedDate = normalizeDate(dateStr);

  const cached = await getCachedRate(fromCurrency, toCurrency, normalizedDate);
  if (cached !== null) {
    return { rate: cached, source: "cache", date: dateStr };
  }

  const apiResult = await fetchRateFromPrimaryAPI(fromCurrency, toCurrency, dateStr);
  if (apiResult) {
    await cacheRate(fromCurrency, toCurrency, normalizedDate, apiResult);
    return { rate: apiResult, source: "api", date: dateStr };
  }

  const fallbackResult = await fetchRateFromFallbackAPI(fromCurrency, toCurrency);
  if (fallbackResult) {
    await cacheRate(fromCurrency, toCurrency, normalizedDate, fallbackResult);
    return { rate: fallbackResult, source: "fallback", date: dateStr };
  }

  const latestCached = await getLatestCachedRate(fromCurrency, toCurrency);
  if (latestCached) {
    return { rate: latestCached.rate, source: "fallback", date: latestCached.date };
  }

  return { rate: 1.0, source: "fallback", date: dateStr };
}

async function getCachedRate(
  fromCurrency: string,
  toCurrency: string,
  normalizedDate: Date
): Promise<number | null> {
  const results = await db.select().from(conversionRates).where(
    and(
      eq(conversionRates.fromCurrency, fromCurrency),
      eq(conversionRates.toCurrency, toCurrency)
    )
  );

  const match = results.find(r => {
    if (!r.date) return false;
    const rDateStr = formatDate(new Date(r.date));
    const targetDateStr = formatDate(normalizedDate);
    return rDateStr === targetDateStr;
  });

  return match ? Number(match.rate) : null;
}

async function getLatestCachedRate(
  fromCurrency: string,
  toCurrency: string
): Promise<{ rate: number; date: string } | null> {
  const results = await db.select().from(conversionRates).where(
    and(
      eq(conversionRates.fromCurrency, fromCurrency),
      eq(conversionRates.toCurrency, toCurrency)
    )
  );

  if (results.length === 0) return null;

  const validResults = results.filter(r => r.date);
  if (validResults.length === 0) return null;

  const sorted = validResults.sort((a, b) => 
    new Date(b.date!).getTime() - new Date(a.date!).getTime()
  );

  return {
    rate: Number(sorted[0].rate),
    date: formatDate(new Date(sorted[0].date!))
  };
}

async function fetchRateFromPrimaryAPI(
  fromCurrency: string,
  toCurrency: string,
  dateStr: string
): Promise<number | null> {
  const url = `https://api.exchangerate.host/convert?from=${fromCurrency}&to=${toCurrency}&date=${dateStr}&amount=1`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Primary exchange rate API error:", response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.success === false || !data.result) {
      return null;
    }

    return Number(data.result);
  } catch (error) {
    console.error("Failed to fetch from primary API:", error);
    return null;
  }
}

async function fetchRateFromFallbackAPI(
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  const url = `https://open.er-api.com/v6/latest/${fromCurrency}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Fallback exchange rate API error:", response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.result !== "success" || !data.rates || !data.rates[toCurrency]) {
      return null;
    }

    return Number(data.rates[toCurrency]);
  } catch (error) {
    console.error("Failed to fetch from fallback API:", error);
    return null;
  }
}

async function cacheRate(
  fromCurrency: string,
  toCurrency: string,
  normalizedDate: Date,
  rate: number
): Promise<void> {
  try {
    const existing = await getCachedRate(fromCurrency, toCurrency, normalizedDate);
    if (existing !== null) {
      return;
    }

    await db.insert(conversionRates).values({
      fromCurrency,
      toCurrency,
      rate: String(rate),
      date: normalizedDate
    });
  } catch (error) {
    console.error("Failed to cache exchange rate:", error);
  }
}
