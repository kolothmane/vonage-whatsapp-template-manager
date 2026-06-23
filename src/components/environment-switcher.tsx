"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SafeEnvironment } from "@/lib/server/environments";

export function EnvironmentSwitcher({ environments, activeId }: { environments: SafeEnvironment[]; activeId?: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  return (
    <label className="mt-4 grid gap-1 text-[11px] font-semibold text-[#666]">
      ENVIRONMENT
      <select
        className="h-9 w-full rounded-md border bg-white px-2 text-[12px] font-normal text-black"
        value={activeId ?? environments[0]?.id ?? ""}
        disabled={working || !environments.length}
        onChange={async (event) => {
          setWorking(true);
          await fetch("/api/environments/active", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: event.target.value }),
          });
          router.push("/");
          router.refresh();
          setWorking(false);
        }}
      >
        {!environments.length ? <option value="">No environment assigned</option> : null}
        {environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
      </select>
    </label>
  );
}
