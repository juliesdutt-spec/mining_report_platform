import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { Stat, StatGroup } from "@/components/shared/StatGroup";
import { useChartColors, tooltipStyle } from "@/lib/chart";
import { Subsidiary } from "@/types";

interface AnalyticsPageProps {
  selectedSubsidiary: Subsidiary | "ALL";
}

const SUBSIDIARY_PRODUCTION = [
  { subsidiary: "MCL", actual: 193.2, target: 185.0 },
  { subsidiary: "SECL", actual: 167.0, target: 160.0 },
  { subsidiary: "NCL", actual: 131.0, target: 128.0 },
  { subsidiary: "CCL", actual: 84.5, target: 80.0 },
  { subsidiary: "WCL", actual: 64.3, target: 62.0 },
  { subsidiary: "BCCL", actual: 41.2, target: 40.0 },
  { subsidiary: "ECL", actual: 36.8, target: 38.0 },
];

const YOY = [
  { year: "FY 21-22", production: 622.6, target: 600.0 },
  { year: "FY 22-23", production: 703.2, target: 670.0 },
  { year: "FY 23-24", production: 773.6, target: 780.0 },
  { year: "FY 24-25", production: 838.0, target: 825.0 },
];

export function AnalyticsPage({ selectedSubsidiary }: AnalyticsPageProps) {
  const colors = useChartColors();

  // Mineral split shares the chart palette so the whole page reads as one system.
  const mineralShare = [
    { name: "Non-coking (thermal G7–G14)", value: 84, color: colors.primary },
    { name: "Prime & medium coking", value: 11, color: colors.teal },
    { name: "Lignite & other", value: 5, color: colors["muted-foreground"] },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Cross-subsidiary extraction metrics, year-on-year trajectory and mechanised mining splits."
        actions={
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        }
      />

      <StatGroup>
        <Stat label="Total CIL production" value="773.60" hint="Million tonnes, FY 23-24" delta="+10.0%" deltaType="positive" />
        <Stat label="Opencast share" value="93.8%" tone="teal" hint="Dragline & surface miners" />
        <Stat label="Underground share" value="6.2%" hint="Prime coking focus" />
        <Stat label="Stripping ratio" value="1:1.82" hint="Aggregate overburden" />
      </StatGroup>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Section
            title="Production by subsidiary"
            description="Actual output against planned target, in million tonnes."
          >
            <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={SUBSIDIARY_PRODUCTION} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={colors.border} vertical={false} />
                    <XAxis dataKey="subsidiary" stroke={colors["muted-foreground"]} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={colors["muted-foreground"]} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipStyle(colors)} cursor={{ fill: colors.border, opacity: 0.3 }} />
                    <Bar dataKey="actual" name="Actual (MT)" fill={colors.primary} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="target" name="Target (MT)" fill={colors.teal} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: colors.primary }} />
                  Actual
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: colors.teal }} />
                  Target
                </span>
              </div>
            </div>
          </Section>
        </div>

        <div className="lg:col-span-4">
          <Section title="Mineral classification" description="Share of audited output by grade.">
            <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mineralShare}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {mineralShare.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle(colors)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <dl className="mt-3 divide-y divide-border border-t border-border">
                {mineralShare.map((item) => (
                  <div key={item.name} className="flex items-baseline justify-between gap-3 py-2">
                    <dt className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate">{item.name}</span>
                    </dt>
                    <dd className="shrink-0 font-mono text-xs tabular-nums font-medium text-foreground">
                      {item.value}%
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Section>
        </div>
      </div>

      <Section
        title="Multi-year trajectory"
        description="Progress toward the one-billion-tonne national production mandate."
      >
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={YOY} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={colors.border} vertical={false} />
                <XAxis dataKey="year" stroke={colors["muted-foreground"]} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={colors["muted-foreground"]} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle(colors)} />
                <Line
                  type="monotone"
                  dataKey="production"
                  name="Actual (MT)"
                  stroke={colors.primary}
                  strokeWidth={2}
                  dot={{ r: 3, fill: colors.primary, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Target (MT)"
                  stroke={colors.teal}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: colors.teal, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>
    </div>
  );
}
