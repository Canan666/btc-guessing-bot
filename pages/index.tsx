// pages/index.tsx
import { useState, useEffect } from 'react';
import { Card, Table, Button } from '@/components';

interface Prediction {
  time: string;
  price: number;
  timeframe: string;
  recommendation: string;
  predictedPrice: number | null;
  endTime: number;
  actualPrice?: number;
  result?: string;
  profit?: number;
}

const timeframeToMs: Record<string, number> = {
  '1m': 60000,
  '5m': 300000,
  '15m': 900000,
};

const profitRates: Record<string, number> = {
  '1m': 1,
  '5m': 2,
  '15m': 3,
};

export default function Home() {
  const [price, setPrice] = useState<number | null>(null);
  const [status, setStatus] = useState('观望中');
  const [history, setHistory] = useState<Prediction[]>([]);
  const [timeframe, setTimeframe] = useState('1m');

  useEffect(() => {
    const interval = setInterval(async () => {
      let rate: number | null = null;
      let suggestion: string = '观望';
      try {
        const resDepth = await fetch('/api/btc-depth');
        if (resDepth.ok) {
          const depthJson = await resDepth.json();
          suggestion = depthJson.suggestion || '观望';
        }

        const resPrice = await fetch('/api/btc-price');
        if (resPrice.ok) {
          const priceJson = await resPrice.json();
          if (typeof priceJson.rate === 'number') {
            rate = priceJson.rate;
            setPrice(rate);
          }
        }
      } catch (e) {
        console.error('Fetch error', e);
      }

      if (rate == null) {
        setStatus('价格异常');
        return;
      }

      if (suggestion === '买入看涨' || suggestion === '买入看跌') {
        const reco = suggestion === '买入看涨' ? '看涨' : '看跌';
        setStatus(reco);
        const now = Date.now();
        const duration = timeframeToMs[timeframe] || 0;
        const newEntry: Prediction = {
          time: new Date(now).toLocaleTimeString(),
          price: rate,
          timeframe,
          recommendation: reco,
          predictedPrice: rate,
          endTime: now + duration,
        };
        setHistory((prev) => [...prev, newEntry]);
      } else {
        setStatus('观望中');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timeframe]);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      setHistory((prev) =>
        prev.map((h) => {
          if (h.predictedPrice != null && h.actualPrice == null && now >= h.endTime && price != null) {
            const correct =
              (h.recommendation === '看涨' && price > h.predictedPrice) ||
              (h.recommendation === '看跌' && price < h.predictedPrice);
            const result = correct ? '正确' : '错误';
            const profit = correct ? 5 * profitRates[h.timeframe] : -5;
            return { ...h, actualPrice: price, result, profit };
          }
          return h;
        })
      );
    }, 1000);
    return () => clearInterval(iv);
  }, [price]);

  return (
    <div>
      <h1>BTC 预测工具</h1>
      <Card>
        <p>当前价格: {price ? price.toFixed(2) : '加载中...'}</p>
        <p>状态: {status}</p>
        <Table data={history} />
        <Button onClick={() => setTimeframe('1m')}>1分钟</Button>
        <Button onClick={() => setTimeframe('5m')}>5分钟</Button>
        <Button onClick={() => setTimeframe('15m')}>15分钟</Button>
      </Card>
    </div>
  );
}
