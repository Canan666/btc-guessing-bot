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

interface Prediction {
  time: string;
  price: number;
  timeframe: string;
  recommendation: string;
  riskIndex: string;
  analysisDetail: string;
  predictedPrice: number;
  endTime: number;
  actualPrice?: number;
  result?: "正确" | "错误" | "未知";
}

export default function BTCGuessingTool() {
  const [price, setPrice] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState("10分钟");
  const [history, setHistory] = useState<Prediction[]>([]);

  // 用 WS 获取实时价格
  useEffect(() => {
    const ws = new WebSocket(
      "wss://stream.binance.com:9443/ws/btcusdt@ticker"
    );
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      const last = parseFloat(msg.c);
      if (!isNaN(last)) setPrice(last);
    };
    return () => ws.close();
  }, []);

  // 验证到期预测
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      setHistory((prev) =>
        prev.map((h) => {
          if (h.actualPrice == null && now >= h.endTime && price != null) {
            let result: "正确" | "错误" | "未知" = "未知";
            if (h.recommendation === "看涨") {
              result = price > h.predictedPrice ? "正确" : "错误";
            } else if (h.recommendation === "看跌") {
              result = price < h.predictedPrice ? "正确" : "错误";
            }
            return { ...h, actualPrice: price, result };
          }
          return h;
        })
      );
    }, 1000);
    return () => clearInterval(iv);
  }, [price]);

  // 点击分析 —— 串调用深度分析接口
  const handleAnalyze = async () => {
  console.log("🚀 handleAnalyze called, price =", price);
  if (price == null) {
    console.warn("⚠️ 当前 price 为空，无法分析");
    return;
  }

  try {
    console.log("🌐 Fetching /api/btc-depth …");
    const res = await fetch("/api/btc-depth");
    console.log("⬇️ /api/btc-depth status:", res.status);
    const json = await res.json();
    console.log("📊 /api/btc-depth response:", json);

    if (!res.ok || (json as any).error) {
      console.error("❌ 深度分析失败：", (json as any).error);
      return;
    }

    const { recommendation, riskIndex, analysisDetail } = json as {
      recommendation: string;
      riskIndex: string;
      analysisDetail: string;
    };

    const now = Date.now();
    const duration = timeframeToMs[timeframe] ?? 0;
    const newPred: Prediction = {
      time: new Date(now).toLocaleString(),
      price,
      timeframe,
      recommendation,
      riskIndex,
      analysisDetail,
      predictedPrice: price,
      endTime: now + duration,
    };
    console.log("✅ 推入历史记录：", newPred);
    setHistory((prev) => [...prev, newPred]);
  } catch (e) {
    console.error("🔥 handleAnalyze exception:", e);
  }
};


  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 bg-gray-50 min-h-screen">
      <Card className="shadow-xl border border-gray-200">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-2xl font-bold text-gray-800">
            BTC 模拟竞猜工具
          </h2>
          <div className="text-base text-gray-600">
            当前价格：{" "}
            <span className="text-green-600 font-semibold">
              {price != null ? `$${price.toFixed(2)} USD` : "加载中..."}
            </span>
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
            开始深度分析预测
          </Button>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="shadow-md border border-gray-200">
          <CardContent className="space-y-3 p-6">
            <h3 className="text-lg font-semibold text-gray-800">
              竞猜历史记录
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell>时间</TableCell>
                    <TableCell>预测价</TableCell>
                    <TableCell>周期</TableCell>
                    <TableCell>推荐</TableCell>
                    <TableCell>风险指数</TableCell>
                    <TableCell>分析详情</TableCell>
                    <TableCell>剩余时间</TableCell>
                    <TableCell>实际价</TableCell>
                    <TableCell>结果</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, idx) => {
                    const remaining =
                      h.actualPrice != null
                        ? "已结束"
                        : `${Math.max(
                            0,
                            Math.floor((h.endTime - Date.now()) / 1000)
                          )} 秒`;
                    return (
                      <TableRow key={idx}>
                        <TableCell>{h.time}</TableCell>
                        <TableCell>${h.predictedPrice}</TableCell>
                        <TableCell>{h.timeframe}</TableCell>
                        <TableCell>{h.recommendation}</TableCell>
                        <TableCell>{h.riskIndex}</TableCell>
                        <TableCell>
                          <span title={h.analysisDetail}>
                            {h.analysisDetail}
                          </span>
                        </TableCell>
                        <TableCell>{remaining}</TableCell>
                        <TableCell>
                          {h.actualPrice != null
                            ? `$${h.actualPrice}`
                            : "等待中..."}
                        </TableCell>
                        <TableCell>
                          {h.result ? (
                            <span
                              className={
                                h.result === "正确"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {h.result}
                            </span>
                          ) : (
                            "等待中..."
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
