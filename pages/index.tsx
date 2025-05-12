// pages/index.tsx

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableBody,
} from "@/components/ui/table";

const timeframeToMs: Record<string, number> = {
  "10分钟": 10 * 60 * 1000,
  "30分钟": 30 * 60 * 1000,
  "1小时": 60 * 60 * 1000,
  "1天": 24 * 60 * 60 * 1000,
};

const profitRates: Record<string, number> = {
  "10分钟": 0.8,
  "30分钟": 0.85,
  "1小时": 0.85,
  "1天": 0.85,
};

interface Prediction {
  time: string;
  price: number;
  timeframe: string;
  recommendation: string;
  predictedPrice: number;
  endTime: number;
  actualPrice?: number;
  result?: "正确" | "错误" | "未知";
  profit?: number;
}

export default function BTCGuessingTool() {
  const [price, setPrice] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState("10分钟");
  const [history, setHistory] = useState<Prediction[]>([]);

  useEffect(() => {
    const ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@ticker");
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      const last = parseFloat(msg.c);
      if (!isNaN(last)) setPrice(last);
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setHistory((prev) =>
        prev.map((h) => {
          if (!h.actualPrice && now >= h.endTime && price != null) {
            const correct = 
              (h.recommendation === "看涨" && price > h.predictedPrice) ||
              (h.recommendation === "看跌" && price < h.predictedPrice);
            const result = correct ? "正确" : "错误";
            const profit = correct ? 5 * profitRates[h.timeframe] : -5;
            return { ...h, actualPrice: price, result, profit };
          }
          return h;
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [price]);

  const autoTrade = (recommendation: string) => {
    const now = Date.now();
    const duration = timeframeToMs[timeframe] ?? 0;
    const newPrediction: Prediction = {
      time: new Date(now).toLocaleString(),
      price: price!,
      timeframe,
      recommendation,
      predictedPrice: price!,
      endTime: now + duration,
    };
    setHistory((prev) => [...prev, newPrediction]);
  };

  const handleAnalyze = async () => {
    if (!price) return;
    try {
      const res = await fetch("/api/btc-depth");
      const json = await res.json();
      if (!res.ok) return;
      
      const { recommendation } = json;
      autoTrade(recommendation);  // 自动交易
    } catch (e) {
      console.error("分析失败:", e);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 bg-gray-50 min-h-screen">
      <Card>
        <CardContent>
          <h2 className="text-2xl font-bold">BTC 模拟交易工具</h2>
          <p>当前价格：{price ? `$${price.toFixed(2)}` : "加载中..."}</p>
          
          <label>预测周期：</label>
          <RadioGroup value={timeframe} onValueChange={setTimeframe}>
            <RadioGroupItem value="10分钟">10分钟</RadioGroupItem>
            <RadioGroupItem value="30分钟">30分钟</RadioGroupItem>
            <RadioGroupItem value="1小时">1小时</RadioGroupItem>
            <RadioGroupItem value="1天">1天</RadioGroupItem>
          </RadioGroup>

          <Button onClick={handleAnalyze}>开始分析</Button>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent>
            <h3>交易历史</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>时间</TableCell>
                  <TableCell>价格</TableCell>
                  <TableCell>周期</TableCell>
                  <TableCell>推荐</TableCell>
                  <TableCell>预测价</TableCell>
                  <TableCell>实际价</TableCell>
                  <TableCell>结果</TableCell>
                  <TableCell>收益</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{h.time}</TableCell>
                    <TableCell>${h.price.toFixed(2)}</TableCell>
                    <TableCell>{h.timeframe}</TableCell>
                    <TableCell>{h.recommendation}</TableCell>
                    <TableCell>${h.predictedPrice.toFixed(2)}</TableCell>
                    <TableCell>{h.actualPrice ? `$${h.actualPrice.toFixed(2)}` : "等待"}</TableCell>
                    <TableCell>{h.result ?? "进行中"}</TableCell>
                    <TableCell>{h.profit !== undefined ? `${h.profit.toFixed(2)} U` : "计算中"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
