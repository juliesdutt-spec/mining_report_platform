import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat, StatGroup } from "@/components/shared/StatGroup";
import { useChartColors, tooltipStyle } from "@/lib/chart";
import { Subsidiary } from "@/types";
import { fetchPlatformStats } from "@/services/analytics";
import { BackendStats } from "@/services/api";

interface AnalyticsPageProps {
  selectedSubsidiary: Subsidiary | "ALL";
}

export function AnalyticsPage({ selectedSubsidiary }: AnalyticsPageProps) {
  const colors = useChartColors();
  const [stats, setStats] = useState<BackendStats | null>(null);

  // Everything on this page comes from GET /stats — real aggregates over the
  // indexed reports. The backend has no production time series or per-
  // subsidiary targets, so no such chart is shown.
  useEffect(() => {
    fetchPlatformStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const palette = [colors.primary, colors.teal, colors["muted-foreground"]];

  // Documents per mineral type, as extracted from the uploaded reports.
  const mineralShare = Object.entries(stats?.mineral_distribution ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }));

  // Documents per location, as extracted from the uploaded reports.
  const locationCounts = Object.entries(stats?.location_distribution ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([location, documents]) => ({ location, documents }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Aggregates over the indexed report corpus, computed by the backend."
        actions={
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        }
      />

      <StatGroup>
        <Stat
          label="Documents indexed"
          value={stats ? stats.total_reports.toLocaleString("en-IN") : "\u2014"}
          hint="Reports in the database"
        />
        <Stat
          label="Extracted successfully"
          value={stats ? stats.completed.toLocaleString("en-IN") : "\u2014"}
          tone="success"
          hint="Entities parsed from source"
        />
        <Stat
          label="Distinct minerals"
          value={stats ? Object.keys(stats.mineral_distribution).length : "\u2014"}
          tone="teal"
          hint="Identified across the corpus"
        />
        <Stat
          label="Distinct locations"
          value={stats ? Object.keys(stats.location_distribution).length : "\u2014"}
          hint="Sites referenced in reports"
        />
      </StatGroup>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Section
            title="Documents by location"
            description="How many indexed reports reference each site."
          >
            <Card className="p-5">
              <div className="h-72 w-full">
                {stats === null ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={locationCounts} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={colors.border} vertical={false} />
                    <XAxis dataKey="location" stroke={colors["muted-foreground"]} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={colors["muted-foreground"]} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipStyle(colors)} cursor={{ fill: colors.border, opacity: 0.3 }} />
                    <Bar dataKey="documents" name="Documents" fill={colors.primary} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>

              <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: colors.primary }} />
                  Indexed documents
                </span>
              </div>
            </Card>
          </Section>
        </div>

        <div className="lg:col-span-4">
          <Section title="Mineral classification" description="Indexed documents per extracted mineral type.">
            <Card className="p-5">
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
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </Section>
        </div>
      </div>

    </div>
  );
}
