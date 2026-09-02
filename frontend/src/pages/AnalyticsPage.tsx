import React, { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Download,
  Filter,
  Layers,
  Building2,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Subsidiary } from "@/types";

interface AnalyticsPageProps {
  selectedSubsidiary: Subsidiary | "ALL";
}

export function AnalyticsPage({ selectedSubsidiary }: AnalyticsPageProps) {
  const [metricCategory, setMetricCategory] = useState<"coal" | "overburden" | "reserves">("coal");

  const subsidiaryComparisonData = [
    { subsidiary: "SECL", actual: 167.0, target: 160.0, underground: 14.5, opencast: 152.5 },
    { subsidiary: "MCL", actual: 193.2, target: 185.0, underground: 3.2, opencast: 190.0 },
    { subsidiary: "NCL", actual: 131.0, target: 128.0, underground: 0.0, opencast: 131.0 },
    { subsidiary: "CCL", actual: 84.5, target: 80.0, underground: 2.1, opencast: 82.4 },
    { subsidiary: "BCCL", actual: 41.2, target: 40.0, underground: 7.8, opencast: 33.4 },
    { subsidiary: "WCL", actual: 64.3, target: 62.0, underground: 6.4, opencast: 57.9 },
    { subsidiary: "ECL", actual: 36.8, target: 38.0, underground: 8.9, opencast: 27.9 },
  ];

  const yoyComparison = [
    { year: "FY 21-22", production: 622.6, target: 600.0, growth: "+4.4%" },
    { year: "FY 22-23", production: 703.2, target: 670.0, growth: "+12.9%" },
    { year: "FY 23-24", production: 773.6, target: 780.0, growth: "+10.0%" },
    { year: "FY 24-25 (Proj)", production: 838.0, target: 825.0, growth: "+8.3%" },
  ];

  const mineralShare = [
    { name: "Non-Coking (Thermal G7-G14)", value: 84, color: "#38bdf8" },
    { name: "Prime & Medium Coking Coal", value: 11, color: "#10b981" },
    { name: "Lignite & Other", value: 5, color: "#f59e0b" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            Production & Geological Analytics Studio
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Aggregated cross-subsidiary extraction metrics, YoY trajectory & mechanized mining splits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <span>FY 2023-2024 Audit</span>
          </Button>
          <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            <span>Export Analytics CSV</span>
          </Button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5">
          <span className="text-[11px] text-zinc-400">Total CIL Production</span>
          <div className="mt-1 text-xl font-bold font-mono text-zinc-100">773.60 MT</div>
          <span className="text-[11px] text-emerald-400 font-mono mt-0.5 block">+10.0% YoY Growth</span>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5">
          <span className="text-[11px] text-zinc-400">Opencast Mechanized Share</span>
          <div className="mt-1 text-xl font-bold font-mono text-sky-400">93.8%</div>
          <span className="text-[11px] text-zinc-500 font-mono mt-0.5 block">Dragline & Surface Miners</span>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5">
          <span className="text-[11px] text-zinc-400">Underground Continuous Miners</span>
          <div className="mt-1 text-xl font-bold font-mono text-amber-400">6.2%</div>
          <span className="text-[11px] text-zinc-500 font-mono mt-0.5 block">Prime Coking Coal Focus</span>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5">
          <span className="text-[11px] text-zinc-400">Aggregate Stripping Ratio</span>
          <div className="mt-1 text-xl font-bold font-mono text-emerald-400">1:1.82</div>
          <span className="text-[11px] text-zinc-500 font-mono mt-0.5 block">Overburden Efficiency</span>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Subsidiary Breakdown Bar Chart (8 cols) */}
        <Card className="lg:col-span-8 border-zinc-800 bg-zinc-900/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-100">
                Coal Production by Subsidiary (Actual vs Planned Target)
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">
                Million Tonnes (MT) extracted per CIL subsidiary during FY 2023-24.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-sky-400" /> Actual</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-400" /> Target</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subsidiaryComparisonData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="subsidiary" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}M`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "6px", fontSize: "12px" }}
                  />
                  <Bar dataKey="actual" name="Actual (MT)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="target" name="Target (MT)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Mineral Category Donut Chart (4 cols) */}
        <Card className="lg:col-span-4 border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-100">
              Mineral Classification Distribution
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Breakdown by grade across CMPDI audited blocks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mineralShare}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {mineralShare.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 mt-2 pt-2 border-t border-zinc-800 text-xs">
              {mineralShare.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="font-mono text-zinc-400">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* YoY Multi-Year Production Trajectory */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-zinc-100">
            Multi-Year National Coal Production Trajectory (CIL Total)
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400 mt-0.5">
            Demonstrates transition to 1-Billion Tonne national production mandate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yoyComparison} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="year" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} MT`} />
                <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", fontSize: "12px" }} />
                <Line type="monotone" dataKey="production" name="Actual (MT)" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 4, fill: "#38bdf8" }} />
                <Line type="monotone" dataKey="target" name="Target (MT)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3, fill: "#10b981" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
