/**
 * Return Calculations
 * Calculate daily returns, total returns, and performance rankings
 */

const TRADING_DAYS_PER_YEAR = 252;

/**
 * Calculate daily returns from price array
 * Daily return = (today_price - yesterday_price) / yesterday_price
 */
export function calculateDailyReturns(prices: number[]): number[] {
  if (prices.length < 2) {
    return [];
  }

  const dailyReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
    dailyReturns.push(dailyReturn);
  }

  return dailyReturns;
}

/**
 * Calculate total return percentage
 * Total Return = (End Price - Start Price) / Start Price * 100
 */
export function calculateTotalReturn(prices: number[]): number {
  if (prices.length < 2) {
    return 0;
  }

  const startPrice = prices[0];
  const endPrice = prices[prices.length - 1];
  return ((endPrice - startPrice) / startPrice) * 100;
}

/**
 * Calculate annualized return
 * Annualized Return = ((1 + Total Return) ^ (252 / Trading Days)) - 1
 * Trading Days = prices.length - 1 (number of days between first and last price)
 */
export function calculateAnnualizedReturn(prices: number[]): number {
  if (prices.length < 2) {
    return 0;
  }

  const totalReturn = calculateTotalReturn(prices) / 100; // Convert to decimal
  const tradingDays = prices.length - 1;
  const annualizedReturn = Math.pow(1 + totalReturn, TRADING_DAYS_PER_YEAR / tradingDays) - 1;

  return annualizedReturn * 100; // Convert back to percentage
}

/**
 * Calculate performance ranking
 * Rank by total return (highest = 1)
 */
export function calculatePerformanceRanking(
  returns: Map<string, number>
): Map<string, number> {
  const rankings = new Map<string, number>();

  // Sort tickers by return (descending)
  const sorted = [...returns.entries()].sort((a, b) => b[1] - a[1]);

  // Assign ranks
  sorted.forEach(([ticker], index) => {
    rankings.set(ticker, index + 1);
  });

  return rankings;
}

/**
 * Calculate contribution to portfolio return
 * Contribution = (ticker_return * ticker_weight)
 */
export function calculateContribution(
  totalReturn: number,
  weight: number
): number {
  return totalReturn * weight;
}

/**
 * Calculate portfolio total return (weighted)
 */
export function calculatePortfolioReturn(
  tickerReturns: Map<string, number>,
  weights: number[]
): number {
  let portfolioReturn = 0;

  const tickers = [...tickerReturns.keys()];
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    const weight = weights[i] !== undefined ? weights[i] : 1 / tickers.length;
    const returnPct = tickerReturns.get(ticker) || 0;
    portfolioReturn += returnPct * weight;
  }

  return portfolioReturn;
}
