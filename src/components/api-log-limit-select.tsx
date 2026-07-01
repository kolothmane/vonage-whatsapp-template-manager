"use client";

import { useRouter, useSearchParams } from "next/navigation";

const LIMITS = [5, 10, 25, 100] as const;

export function ApiLogLimitSelect({ value }: { value: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Show</span>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams);
          params.set("limit", event.target.value);
          router.push(`/api-logs?${params.toString()}`);
        }}
      >
        {LIMITS.map((limit) => (
          <option key={limit} value={limit}>
            {limit}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground">last calls</span>
    </label>
  );
}
