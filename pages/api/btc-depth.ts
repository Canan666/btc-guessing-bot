// pages/api/btc-depth.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { RSI } from 'technicalindicators';

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
    throw new Error(`Binance 返回 ${res.status}`);
  }
  const data = await res.json();
  return data.map((item: any[]) => ({
    close: parseFloat(item[4]),
    low: parseFloat(item[3]),
    high: parseFloat(item[2]),
  }));
}

// 计算布林带
function calculateBOLL(closePrices: number[], period = 20) {
  const slice = closePrices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const stddev = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length);
  return { upper: mean + 2 * stddev, lower: mean - 2 * stddev };
}

// 计算 KDJ
function calculateKDJ(close: number[], low: number[], high: number[], period = 9) {
  const c = close.slice(-period), l = low.slice(-period), h = high.slice(-period);
  const lowest = Math.min(...l), highest = Math.max(...h);
  const rsv = ((c[c.length - 1] - lowest) / (highest - lowest)) * 100;
  const k = (2 / 3) * 50 + (1 / 3) * rsv;
  const d = (2 / 3) * 50 + (1 / 3) * k;
  const j = 3 * k - 2 * d;
  return { k, d, j };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1. 拉取最近 100 根 1h K 线
    const klines = await fetchBinanceKlines("BTCUSDT", "1h", 100);
    const closes = klines.map(k => k.close);
    const lows   = klines.map(k => k.low);
    const highs  = klines.map(k => k.high);

    // 2. 计算 RSI
    const rsiArr = RSI.calculate({ values: closes, period: 14 });
    const rsi    = rsiArr.slice(-1)[0] ?? 50;  // 默认 50

    // 3. 计算 BOLL 和 KDJ
    const { upper, lower } = calculateBOLL(closes);
    const { j } = calculateKDJ(closes, lows, highs);

    // 4. 判断信号
    const last = closes[closes.length - 1];
    let suggestion = "观望";
    if (last > lower && j < 20 && rsi < 30)      suggestion = "买入看涨";
    else if (last < upper && j > 80 && rsi > 70) suggestion = "买入看跌";

    return res.status(200).json({ suggestion });
  } catch (err) {
    // 出现任何错误时都降级为观望
    console.error("btc-depth 接口错误：", err);
    return res.status(200).json({ suggestion: "观望" });
  }
}
