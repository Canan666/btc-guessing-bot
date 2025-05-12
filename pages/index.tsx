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

  // WebSocket: subscribe to trade stream for real-time price
  useEffect(() => {
    const ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

    ws.onopen = () => {
      console.log("WebSocket 已连接 (trade stream)");
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        // Trade stream: msg.p is the latest price
        const last = parseFloat(msg.p);
        if (!isNaN(last)) {
          setPrice(last);
        }
      } catch (err) {
        console.error("解析 WebSocket 数据失败", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket 错误：", err);
    };

    ws.onclose = () => {
      console.warn("WebSocket 已关闭");
    };

    return () => {
      ws.close();
    };
  }, []);

  // 每秒检查是否有到期预测需要结算
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
    if (price == null) return;
    const now = Date.now();
    const duration = timeframeToMs[timeframe] ?? 0;
    const newPrediction: Prediction = {
      time: new Date(now).toLocaleString(),
      price,
      timeframe,
      recommendation,
      predictedPrice: price,
      endTime: now + duration,
    };
    setHistory((prev) => [...prev, newPrediction]);
  };

  const handleAnalyze = async () => {
    if (!price) return;
    try {
      const res = await fetch("/api/btc-depth");
      if (!res.ok) {
        console.error("深度分析接口出错", await res.text());
        return;
      }
      const { suggestion } = await res.json();
      // suggestion should be "买入看涨" or "买入看跌" or "观望"
      if (suggestion === "买入看涨" || suggestion === "买入看跌") {
        // normalize to just "看涨" / "看跌"
        autoTrade(suggestion === "买入看涨" ? "看涨" : "看跌");
      }
    } catch (e) {
      console.error("分析失败:", e);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 bg-gray-50 min-h-screen">
      <Card className="shadow-xl border border-gray-200">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-2xl font-bold text-gray-800">BTC 模拟交易工具</h2>
          <div className="text-base text-gray-600">
            当前价格：{" "}
            {price !== null ? (
              <span className="text-green-600 font-semibold">
                ${price.toFixed(2)} USD
              </span>
            ) : (
              "加载中…"
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              选择预测周期：
            </label>
            <RadioGroup
              value={timeframe}
              onValueChange={setTimeframe}
              className="flex gap-4"
            >
              <RadioGroupItem value="10分钟">10分钟</RadioGroupItem>
              <RadioGroupItem value="30分钟">30分钟</RadioGroupItem>
              <RadioGroupItem value="1小时">1小时</RadioGroupItem>
              <RadioGroupItem value="1天">1天</RadioGroupItem>
            </RadioGroup>
          </div>

          <Button onClick={handleAnalyze} className="mt-4 w-full">
            开始分析并自动下单
          </Button>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="shadow-md border border-gray-200">
          <CardContent className="space-y-3 p-6">
            <h3 className="text-lg font-semibold text-gray-800">交易历史</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell>时间</TableCell>
                    <TableCell>周期</TableCell>
                    <TableCell>推荐</TableCell>
                    <TableCell>买入价</TableCell>
                    <TableCell>实际价</TableCell>
                    <TableCell>结果</TableCell>
                    <TableCell>收益 (U)</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{h.time}</TableCell>
                      <TableCell>{h.timeframe}</TableCell>
                      <TableCell>{h.recommendation}</TableCell>
                      <TableCell>${h.predictedPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        {h.actualPrice !== undefined
                          ? `$${h.actualPrice.toFixed(2)}`
                          : "等待"}
                      </TableCell>
                      <TableCell>{h.result ?? "进行中"}</TableCell>
                      <TableCell>
                        {h.profit !== undefined
                          ? h.profit.toFixed(2)
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
