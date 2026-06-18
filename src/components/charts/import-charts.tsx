"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ImportPoint = {
  day: string;
  imports: number;
  success: number;
  errors: number;
};

type DistributionPoint = {
  language?: string;
  brand?: string;
  count: number;
};

export function ImportCharts({
  series,
  languageDistribution,
  brandDistribution,
}: {
  series: ImportPoint[];
  languageDistribution: DistributionPoint[];
  brandDistribution: DistributionPoint[];
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ChartSkeleton title="Import Throughput" height="h-72" />
        <div className="grid gap-4">
          <ChartSkeleton title="Templates per Language" height="h-40" />
          <ChartSkeleton title="Templates per Brand" height="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Import Throughput</CardTitle>
          <CardDescription>Daily import volume, success rate and validation errors.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ left: -18, right: 8 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} />
              <Tooltip
                cursor={{ stroke: "var(--color-border)" }}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                }}
              />
              <Line type="monotone" dataKey="imports" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="success" stroke="#15803d" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="errors" stroke="#dc2626" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <DistributionChart title="Templates per Language" data={languageDistribution} labelKey="language" />
        <DistributionChart title="Templates per Brand" data={brandDistribution} labelKey="brand" />
      </div>
    </div>
  );
}

function ChartSkeleton({ title, height }: { title: string; height: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Loading chart data</CardDescription>
      </CardHeader>
      <CardContent className={height}>
        <div className="h-full rounded-md border bg-secondary/40" />
      </CardContent>
    </Card>
  );
}

function DistributionChart({
  title,
  data,
  labelKey,
}: {
  title: string;
  data: DistributionPoint[];
  labelKey: "language" | "brand";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -24, right: 4 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey={labelKey} stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgb(150 60 255 / 0.08)" }}
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
              }}
            />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
