import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone?: "green" | "blue" | "amber" | "red";
};

const tones = {
  green: "text-emerald-700 bg-emerald-50 border-emerald-200",
  blue: "text-sky-700 bg-sky-50 border-sky-200",
  amber: "text-amber-700 bg-amber-50 border-amber-200",
  red: "text-red-700 bg-red-50 border-red-200",
};

export function MetricCard({ title, value, detail, icon: Icon, tone = "green" }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md border", tones[tone])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="font-mono text-2xl font-semibold">{formatNumber(value)}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
