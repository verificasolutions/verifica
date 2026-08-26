"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";

type ChartProps = { type: "services" | "heatmap" | "mix" | "flow" | "vehicles" | "finance" | "payments"; data: unknown };

export function IntelligenceChart({ type, data }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const option = type === "services" ? serviceOption(data as Array<{ label: string; revenue: number }>) : type === "mix" ? mixOption(data as Array<{ label: string; revenue: number }>) : type === "heatmap" ? heatmapOption(data as Array<{ day: number; hour: number; count: number }>) : type === "flow" ? flowOption(data as { weekday: Array<{ label: string; count: number }>; hour: Array<{ label: string; count: number }> }) : type === "vehicles" ? vehicleOption(data as Array<{ label: string; count: number; revenue: number }>) : type === "finance" ? financeOption(data as Array<{ label: string; amount: number }>) : paymentOption(data as Array<{ label: string; count: number; amount: number }>);
    chart.setOption(option);
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chart.dispose(); };
  }, [data, type]);
  return <div ref={ref} className="h-72 w-full" aria-label={type === "services" ? "Receita por serviço" : type === "mix" ? "Composição da receita" : type === "vehicles" ? "Ativos por categoria" : type === "payments" ? "Meios de pagamento" : "Fluxo por dia e horário"} />;
}

const commonTooltip = { backgroundColor: "rgba(10,15,24,.96)", borderColor: "rgba(103,232,249,.3)", textStyle: { color: "#e2e8f0" } };
const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function flowOption(input: { weekday: Array<{ label: string; count: number }>; hour: Array<{ label: string; count: number }> }) {
  return { backgroundColor: "transparent", animationDuration: 700, tooltip: { ...commonTooltip, trigger: "axis" }, legend: { top: 0, textStyle: { color: "#cbd5e1" } }, grid: { left: 18, right: 24, top: 42, bottom: 38, containLabel: true }, xAxis: { type: "category", data: input.weekday.map((item) => item.label.slice(0, 3)), axisLabel: { color: "#94a3b8" }, axisLine: { lineStyle: { color: "rgba(148,163,184,.16)" } } }, yAxis: { type: "value", axisLabel: { color: "#64748b" }, splitLine: { lineStyle: { color: "rgba(148,163,184,.1)", type: "dashed" } } }, series: [{ name: "Atendimentos por dia", type: "bar", barWidth: "42%", data: input.weekday.map((item, index) => ({ value: item.count, itemStyle: { color: ["#22d3ee", "#34d399", "#60a5fa", "#a78bfa", "#fbbf24", "#fb7185", "#2dd4bf"][index] }, emphasis: { itemStyle: { shadowBlur: 18, shadowColor: "rgba(34,211,238,.5)" } } })), itemStyle: { borderRadius: [8, 8, 2, 2] }, label: { show: true, position: "top", color: "#cbd5e1" } }] };
}

function vehicleOption(rows: Array<{ label: string; count: number; revenue: number }>) {
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  return { backgroundColor: "transparent", animationDuration: 700, tooltip: { ...commonTooltip, trigger: "axis", axisPointer: { type: "shadow" }, formatter: (items: Array<{ name: string; value: number }>) => { const item = sorted.find((row) => row.label === items[0]?.name); return `${items[0]?.name}<br/>${items[0]?.value} atendimentos<br/><strong>${brl(item?.revenue ?? 0)}</strong>`; } }, grid: { left: 20, right: 72, top: 18, bottom: 28, containLabel: true }, xAxis: { type: "value", axisLabel: { color: "#64748b" }, splitLine: { lineStyle: { color: "rgba(148,163,184,.1)", type: "dashed" } } }, yAxis: { type: "category", inverse: true, data: sorted.map((row) => row.label), axisLabel: { color: "#cbd5e1" } }, series: [{ type: "bar", data: sorted.map((row, index) => ({ value: row.revenue, itemStyle: { color: ["#22d3ee", "#34d399", "#a78bfa", "#fbbf24", "#fb7185", "#60a5fa"][index % 6], borderRadius: [0, 8, 8, 0] }, label: { show: true, position: "right", color: "#e2e8f0", formatter: brl(row.revenue) } })), barMaxWidth: 28 }] };
}

function financeOption(rows: Array<{ label: string; amount: number }>) {
  return { backgroundColor: "transparent", animationDuration: 700, tooltip: { ...commonTooltip, trigger: "item", valueFormatter: brl }, legend: { bottom: 0, textStyle: { color: "#94a3b8" } }, series: [{ type: "pie", radius: ["52%", "76%"], center: ["50%", "43%"], itemStyle: { borderColor: "#151a21", borderWidth: 5, borderRadius: 8 }, label: { color: "#e2e8f0", formatter: "{b}\n{d}%" }, data: rows.map((row, index) => ({ name: row.label, value: row.amount, itemStyle: { color: ["#34d399", "#fb7185", "#22d3ee"][index % 3] } })) }] };
}

function paymentOption(rows: Array<{ label: string; count: number; amount: number }>) {
  return { backgroundColor: "transparent", animationDuration: 700, tooltip: { ...commonTooltip, trigger: "axis", axisPointer: { type: "shadow" }, formatter: (items: Array<{ name: string; value: number }>) => `${items[0]?.name}<br/><strong>${brl(items[0]?.value ?? 0)}</strong>` }, grid: { left: 18, right: 24, top: 20, bottom: 40, containLabel: true }, xAxis: { type: "category", data: rows.map((row) => row.label), axisLabel: { color: "#94a3b8" }, axisLine: { lineStyle: { color: "rgba(148,163,184,.16)" } } }, yAxis: { type: "value", axisLabel: { color: "#64748b" }, splitLine: { lineStyle: { color: "rgba(148,163,184,.1)", type: "dashed" } } }, series: [{ type: "bar", data: rows.map((row, index) => ({ value: row.amount, itemStyle: { color: ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24"][index % 4], borderRadius: [8, 8, 2, 2] }, label: { show: true, position: "top", color: "#cbd5e1", formatter: brl(row.amount) } })), barMaxWidth: 58 }] };
}

function serviceOption(rows: Array<{ label: string; revenue: number }>) {
  const colors = ["#22d3ee", "#34d399", "#fbbf24", "#fb7185", "#60a5fa", "#a7f3d0", "#f97316", "#c4b5fd"];
  return { backgroundColor: "transparent", animationDuration: 700, grid: { left: 12, right: 26, top: 22, bottom: 60, containLabel: true }, tooltip: { trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(34,211,238,.06)" } }, backgroundColor: "rgba(10,15,24,.94)", borderColor: "rgba(103,232,249,.28)", textStyle: { color: "#e2e8f0" }, valueFormatter: (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value) }, xAxis: { type: "category", data: rows.map((row) => row.label), axisLabel: { color: "#94a3b8", rotate: rows.length > 3 ? 20 : 0, fontSize: 11 }, axisLine: { lineStyle: { color: "rgba(148,163,184,.16)" } }, axisTick: { show: false } }, yAxis: { type: "value", axisLabel: { color: "#64748b", fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(148,163,184,.10)", type: "dashed" } } }, series: [{ type: "bar", data: rows.map((row, index) => ({ value: row.revenue, itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: colors[index % colors.length] }, { offset: 1, color: "rgba(15,23,42,.45)" }]), borderRadius: [8, 8, 2, 2], shadowBlur: 14, shadowColor: `${colors[index % colors.length]}55` } })), barMaxWidth: 46, barGap: "25%", label: { show: true, position: "top", color: "#cbd5e1", fontSize: 10, formatter: (params: { value: number }) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(params.value) } }] };
}

function mixOption(rows: Array<{ label: string; revenue: number }>) {
  const colors = ["#22d3ee", "#34d399", "#fbbf24", "#fb7185", "#60a5fa", "#f97316"];
  return { backgroundColor: "transparent", animationDuration: 700, tooltip: { trigger: "item", backgroundColor: "rgba(10,15,24,.94)", borderColor: "rgba(103,232,249,.28)", textStyle: { color: "#e2e8f0" }, valueFormatter: (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value) }, legend: { bottom: 0, type: "scroll", textStyle: { color: "#94a3b8", fontSize: 11 } }, series: [{ type: "pie", radius: ["48%", "74%"], center: ["50%", "44%"], avoidLabelOverlap: true, itemStyle: { borderColor: "#111827", borderWidth: 4, borderRadius: 8 }, label: { color: "#e2e8f0", formatter: "{b}\n{d}%", fontSize: 11 }, labelLine: { lineStyle: { color: "rgba(148,163,184,.35)" } }, data: rows.map((row, index) => ({ name: row.label, value: row.revenue, itemStyle: { color: colors[index % colors.length] } })) }] };
}

function heatmapOption(rows: Array<{ day: number; hour: number; count: number }>) {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const values = rows.map((row) => [row.hour, row.day, row.count]);
  return { backgroundColor: "transparent", animationDuration: 700, grid: { left: 42, right: 18, top: 18, bottom: 44 }, tooltip: { position: "top", backgroundColor: "rgba(10,15,24,.94)", borderColor: "rgba(103,232,249,.28)", textStyle: { color: "#e2e8f0" }, formatter: (params: { value: [number, number, number] }) => `${days[params.value[1]]} ${String(params.value[0]).padStart(2, "0")}h: <strong>${params.value[2]}</strong> atendimento(s)` }, xAxis: { type: "category", data: Array.from({ length: 24 }, (_, hour) => `${hour}h`), splitArea: { show: true, areaStyle: { color: ["rgba(15,23,42,.16)", "rgba(30,41,59,.08)"] } }, axisLabel: { color: "#94a3b8", interval: 2 }, axisLine: { lineStyle: { color: "rgba(148,163,184,.16)" } } }, yAxis: { type: "category", data: days, splitArea: { show: true, areaStyle: { color: ["rgba(15,23,42,.16)", "rgba(30,41,59,.08)"] } }, axisLabel: { color: "#94a3b8" } }, visualMap: { min: 0, max: Math.max(...rows.map((row) => row.count), 1), calculable: false, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#0b1220", "#164e63", "#0891b2", "#67e8f9"] }, textStyle: { color: "#94a3b8" } }, series: [{ type: "heatmap", data: values, itemStyle: { borderColor: "#111827", borderWidth: 1, borderRadius: 3 }, emphasis: { itemStyle: { shadowBlur: 16, shadowColor: "rgba(34,211,238,.55)" } } }] };
}
