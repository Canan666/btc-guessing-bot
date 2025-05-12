import type { NextApiRequest, NextApiResponse } from 'next';
import { RSI, MACD } from 'technicalindicators';

// BOLL指标计算
function calculateBOLL(closePrices: number[], period: number = 20) {
  const sliced = closePrices.slice(-period);
  const mean = sliced.reduce((a, b) => a + b, 0) / sliced.length;
  const stddev = Math.sqrt(sliced.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / sliced.length);
  const upper = mean + 2 * stddev;
  const lower = mean - 2 * stddev;
  return { mean, upper, lower };
}

// KDJ指标计算
function calculateKDJ(closePrices: number[], lowPrices: number[], highPrices: number[], period: number = 9) {
  const slicedClose = closePrices.slice(-period);
  const slicedLow = lowPrices.slice(-period);
  const slicedHigh = highPrices.slice(-period);
  const lowestLow = Math.min(...slicedLow);
  const highestHigh = Math.max(...slicedHigh);
  const rsv = ((slicedClose[slicedClose.length - 1] - lowestLow) / (highestHigh - lowestLow)) * 100;
  const k = (2 / 3) * (50) + (1 / 3) * rsv;
  const d = (2 / 3) * (50) + (1 / 3) * k;
  const j = 3 * k - 2 * d;
  return { k, d, j };
}

// 获取K线数据
async function getKline(symbol: string, interval: string, limit: number) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance 返回 ${res.status}`);
  const data = await res.json();
  return data.map((item: any[]) => ({
    close: parseFloat(item[4]),
    low: parseFloat(item[3]),
    high: parseFloat(item[2]),
  }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const klines = await getKline('BTCUSDT', '1h', 100);
    const closePrices = klines.map(k => k.close);
    const lowPrices = klines.map(k => k.low);
    const highPrices = klines.map(k => k.high);

    const rsi = RSI.calculate({ values: closePrices, period: 14 }).slice(-1)[0];
    const boll = calculateBOLL(closePrices);
    const kdj = calculateKDJ(closePrices, lowPrices, highPrices);

    let suggestion = '观望';
    if (boll.lower > closePrices[closePrices.length - 1] && kdj.j < 20 && rsi < 30) suggestion = '买入看涨';
    if (boll.upper < closePrices[closePrices.length - 1] && kdj.j > 80 && rsi > 70) suggestion = '买入看跌';

    return res.status(200).json({
      rsi: rsi.toFixed(2),
      boll,
      kdj,
      suggestion,
    });
  } catch (error: any) {
    return res.status(500).json({ error: '分析失败：' + error.message });
  }
}
