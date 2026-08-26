"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";

type ChartProps = { type: "services" | "heatmap"; data: unknown };

export function IntelligenceChart({ type, data }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const option = type === "services" ? serviceOption(data as Array<{ label: string; revenue: number }>) : heatmapOption(data as Array<{ day: number; hour: number; count: number }>);
    chart.setOption(option);
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chart.dispose(); };
  }, [data, type]);
  return <div ref={ref} className="h-72 w-full" aria-label={type === "services" ? "Receita por serviço" : "Fluxo por dia e horário"} />;
}

function serviceOption(rows: Array<{ label: string; revenue: number }>) {
  return { grid: { left: 12, right: 20, top: 20, bottom: 55, containLabel: true }, tooltip: { trigger: "axis", valueFormatter: (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value) }, xAxis: { type: "category", data: rows.map((row) => row.label), axisLabel: { color: "#94a3b8", rotate: rows.length > 3 ? 20 : 0 } }, yAxis: { type: "value", axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "rgba(148,163,184,.12)" } } }, series: [{ type: "bar", data: rows.map((row) => row.revenue), barMaxWidth: 42, itemStyle: { color: "#22d3ee", borderRadius: [6, 6, 0, 0] } }] };
}

function heatmapOption(rows: Array<{ day: number; hour: number; count: number }>) {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const values = rows.map((row) => [row.hour, row.day, row.count]);
  return { grid: { left: 42, right: 18, top: 18, bottom: 38 }, tooltip: { position: "top", formatter: (params: { value: [number, number, number] }) => `${days[params.value[1]]} ${String(params.value[0]).padStart(2, "0")}h: ${params.value[2]} atendimento(s)` }, xAxis: { type: "category", data: Array.from({ length: 24 }, (_, hour) => `${hour}h`), splitArea: { show: true }, axisLabel: { color: "#94a3b8", interval: 2 } }, yAxis: { type: "category", data: days, splitArea: { show: true }, axisLabel: { color: "#94a3b8" } }, visualMap: { min: 0, max: Math.max(...rows.map((row) => row.count), 1), calculable: false, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#13202b", "#0e7490", "#22d3ee"] }, textStyle: { color: "#94a3b8" } }, series: [{ type: "heatmap", data: values, itemStyle: { borderColor: "#111827", borderWidth: 1 }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(34,211,238,.5)" } } }] };
}
