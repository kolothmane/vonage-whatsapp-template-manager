import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Globe2,
  Languages,
  MessageSquareText,
  UploadCloud,
} from "lucide-react";
import { ImportCharts } from "@/components/charts/import-charts";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listImports, listTemplates, listWabas } from "@/lib/server/repository";
import { formatDateTime, formatNumber } from "@/lib/utils";

export default async function DashboardPage() {
  const [wabas, templates, imports] = await Promise.all([listWabas(), listTemplates(), listImports()]);
  const totalBrands = new Set(templates.map((template) => template.brand)).size;
  const totalLanguages = new Set(templates.map((template) => template.language)).size;
  const pendingImports = imports.filter((item) =>
    ["Queued", "Validating", "Processing", "Blocked"].includes(item.status),
  );
  const failedImports = imports.reduce((sum, item) => sum + item.failed, 0);
  const successfulImports = imports.reduce((sum, item) => sum + item.submitted, 0);
  const dashboardSeries = imports.slice(0, 7).reverse().map((item) => ({
    day: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(item.createdAt)),
    imports: item.total,
    success: item.submitted,
    errors: item.failed,
  }));
  const languageDistribution = Array.from(
    templates.reduce((counts, template) => {
      counts.set(template.language, (counts.get(template.language) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
    ([language, count]) => ({ language, count }),
  );
  const brandDistribution = Array.from(
    templates.reduce((counts, template) => {
      counts.set(template.brand, (counts.get(template.brand) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
    ([brand, count]) => ({ brand, count }),
  );
  const hasOperationalData = imports.length > 0 || templates.length > 0;

  return (
    <div className="grid gap-7">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold leading-tight">Operations Dashboard</h1>
        <p className="max-w-4xl break-words text-base text-[#333]">
          Manage validation, duplicate blocking, transformations and large-scale submissions across connected WABAs.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total WABAs" value={wabas.length} detail="Connected WhatsApp Business Accounts" icon={Building2} />
        <MetricCard
          title="Total Templates"
          value={templates.length}
          detail={`${formatNumber(wabas.reduce((sum, waba) => sum + waba.templateCount, 0))} synced in WABAs`}
          icon={MessageSquareText}
          tone="blue"
        />
        <MetricCard title="Brands" value={totalBrands} detail="AB, AD, BNT, CH and CLB supported" icon={Globe2} />
        <MetricCard title="Languages" value={totalLanguages} detail="EN, FR, ES, PT, IT and DE active" icon={Languages} tone="blue" />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="Pending Imports" value={pendingImports.length} detail="Validation or queue activity" icon={UploadCloud} tone="amber" />
        <MetricCard title="Failed Imports" value={failedImports} detail="Retry engine can target failed items" icon={AlertTriangle} tone="red" />
        <MetricCard title="Successful Imports" value={successfulImports} detail="Submitted or approved templates" icon={CheckCircle2} tone="green" />
      </section>

      {hasOperationalData ? (
        <ImportCharts
          series={dashboardSeries}
          languageDistribution={languageDistribution}
          brandDistribution={brandDistribution}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No operational data yet</CardTitle>
            <CardDescription>
              Connect PostgreSQL and synchronize WABAs to populate this dashboard.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Imports</CardTitle>
          <CardDescription>Strict mode blocks duplicates before any Vonage submission.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Import</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Duplicates</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.length ? (
                  imports.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.fileName}</TableCell>
                      <TableCell>{item.target}</TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="font-mono">{formatNumber(item.submitted)}</TableCell>
                      <TableCell className="font-mono">{formatNumber(item.failed)}</TableCell>
                      <TableCell className="font-mono">{formatNumber(item.duplicates)}</TableCell>
                      <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No imports available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
