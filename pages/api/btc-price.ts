import type { NextApiRequest, NextApiResponse } from 'next';

type Success = { rate: number };
type Failure = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Success | Failure>
) {
  try {
    // 1. 调用币安现货 REST 接口
    const binanceRes = await fetch(
      'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'
    );

    const text = await binanceRes.text();
    console.log('[btc-price] raw Binance response:', text);

    // 2. 检查 HTTP 状态
    if (!binanceRes.ok) {
      console.error('[btc-price] Binance returned status', binanceRes.status);
      return res
        .status(binanceRes.status)
        .json({ error: `Binance API status ${binanceRes.status}` });
    }

    // 3. 解析 JSON 并校验 price 字段
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('[btc-price] JSON.parse failed:', e);
      return res.status(502).json({ error: 'Invalid JSON from Binance' });
    }

    const priceStr = data?.price;
    const rate = parseFloat(priceStr);
    if (typeof priceStr !== 'string' || isNaN(rate)) {
      console.error('[btc-price] price 字段非法:', data);
      return res.status(502).json({ error: 'Invalid price field' });
    }

    // 4. 缓存策略，Vercel 会缓存 5 秒
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');

    return res.status(200).json({ rate });
  } catch (err: any) {
    console.error('[btc-price] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
