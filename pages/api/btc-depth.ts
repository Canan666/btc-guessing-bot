// pages/api/btc-depth.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { RSI } from 'technicalindicators';

// 通用的 K 线条目
interface Kline {
  close: number;
  low: number;
  high: number;
}

// 从币安拉取 K 线
async function fetchBinanceKlines(symbol: string, interval: string, limit: number): Promise<Kline[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Binance 返回 ${res.status}: ${text}`);
    // 把状态挂到 Error 对象上
    // @ts-ignore
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.map((item: any[]) => ({
    close: parseFloat(item[4]),
    low: parseFloat(item[3]),
    high: parseFloat(item[2]),
  }));
}

// 从 CoinGecko 拉取 Market Chart（小时级）
// 返回近 limit 小时的收盘价（取每小时最后一个点）
async function fetchGeckoHourlyPrices(days: number, limit: number): Promise<Kline[]> {
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=hourly`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko 返回 ${res.status}`);
  const json = await res.json();
  // json.prices 是 [ [timestamp, price], ... ] 按时间升序
  const pts: [number, number][] = json.prices;
  // 取最后 limit 个点
  const slice = pts.slice(-limit);
  return slice.map(([_, price]) => ({
    close: price,
    low: price,   // CoinGecko 不区分高低，用同值
    high: price,
  }));
}

// 计算布林带
function calculateBOLL(closePrices: number[], period: number = 20) {
  const sliced = closePrices.slice(-period);
  const mean = sliced.reduce((a, b) => a + b, 0) / sliced.length;
  const stddev = Math.sqrt(
    sliced.reduce((a, b) => a + (b - mean) ** 2, 0) / sliced.length
  );
  return { upper: mean + 2 * stddev, lower: mean - 2 * stddev };
}

// 计算 KDJ（简化版，只用 RSV→K→D→J）
function calculateKDJ(close: number[], low: number[], high: number[], period = 9) {
  const sliceC = close.slice(-period),
        sliceL = low.slice(-period),
        sliceH = high.slice(-period);
  const lowest = Math.min(...sliceL),
        highest = Math.max(...sliceH);
  const rsv = ((sliceC.slice(-1)[0] - lowest) / (highest - lowest)) * 100;
  const k = (2/3)*50 + (1/3)*rsv;
  const d = (2/3)*50 + (1/3)*k;
  const j = 3*k - 2*d;
  return { k, d, j };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    let klines: Kline[];
    try {
      // 优先尝试 Binance
      klines = await fetchBinanceKlines("BTCUSDT", "1h", 100);
    } catch (binErr: any) {
      if (binErr.status === 451) {
        // 法律限制时，切到 CoinGecko 后备
        klines = await fetchGeckoHourlyPrices(5, 100);
      } else {
        throw binErr;
      }
    }

    const closes = klines.map(k => k.close),
          lows = klines.map(k => k.low),
          highs = klines.map(k => k.high);

    // RSI 
    const rsiArr = RSI.calculate({ values: closes, period: 14 });
    const rsi = rsiArr.slice(-1)[0];

    // BOLL & KDJ
    const boll = calculateBOLL(closes);
    const kdj = calculateKDJ(closes, lows, highs);

    let suggestion = '观望';
    const last = closes.slice(-1)[0];
    if (last > boll.lower && kdj.j < 20 && rsi < 30) suggestion = '买入看涨';
    if (last < boll.upper && kdj.j > 80 && rsi > 70) suggestion = '买入看跌';

    return res.status(200).json({ suggestion });
  } catch (err: any) {
    console.error("btc-depth 错误：", err);
    return res.status(500).json({ error: err.message });
  }
}
