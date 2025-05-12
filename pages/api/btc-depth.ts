import type { NextApiRequest, NextApiResponse } from 'next';
import { RSI, MACD } from 'technicalindicators';

// 示例获取 Binance K线数据的函数（使用 fetch）
async function getKline(symbol: string, interval: string, limit: number) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Binance 返回 ${res.status}`);
  }

  const data = await res.json();
  return data.map((item: any[]) => ({
    openTime: item[0],
    open: parseFloat(item[1]),
    high: parseFloat(item[2]),
    low: parseFloat(item[3]),
    close: parseFloat(item[4]),
    volume: parseFloat(item[5]),
    closeTime: item[6],
  }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const klines = await getKline('BTCUSDT', '1h', 100); // 取最近100小时
    const closePrices = klines.map(k => k.close);

    if (closePrices.length < 26) {
      return res.status(500).json({ error: 'K线数据不足以计算指标' });
    }

    // RSI
    const rsi = RSI.calculate({ values: closePrices, period: 14 }).slice(-1)[0];

    // MACD
    const macd = MACD.calculate({
      values: closePrices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    }).slice(-1)[0];

    // 简单分析建议
    const histogram = macd?.histogram ?? 0;
    let suggestion = '观望';
    let riskLevel = '中';

    if (rsi > 70) {
      suggestion = '建议下跌';
      riskLevel = '高';
    } else if (rsi < 30) {
      suggestion = '建议上涨';
      riskLevel = '中高';
    } else if (histogram > 0) {
      suggestion = '可能上涨';
    } else if (histogram < 0) {
      suggestion = '可能下跌';
    }

    return res.status(200).json({
      rsi: rsi?.toFixed(2),
      macd: {
        histogram: histogram.toFixed(4),
        signal: macd?.signal?.toFixed(4),
        macd: macd?.MACD?.toFixed(4),
      },
      suggestion,
      riskLevel,
    });
  } catch (error: any) {
    console.error('分析失败：', error);
    return res.status(500).json({ error: '分析失败：' + error.message });
  }
}
