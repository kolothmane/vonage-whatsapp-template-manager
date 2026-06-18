"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge,
  FileClock,
  History,
  Menu,
  MessageSquareText,
  ScrollText,
  Settings,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const sections = [
  {
    label: "MANAGE",
    items: [
      { href: "/", label: "Dashboard", icon: Gauge },
      { href: "/wabas", label: "WABAs", icon: ShieldCheck },
      { href: "/templates", label: "Templates", icon: MessageSquareText },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { href: "/import", label: "Import Wizard", icon: Upload },
      { href: "/imports", label: "Imports", icon: FileClock },
    ],
  },
  {
    label: "MONITOR",
    items: [
      { href: "/logs", label: "Logs", icon: ScrollText, badge: "live" },
      { href: "/history", label: "History", icon: History },
    ],
  },
  {
    label: "CONTROL",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
] as const;

function ProductBrand() {
  return (
    <div>
      <div className="text-[21px] font-semibold leading-7">WABA BR</div>
      <div className="text-[13px] text-[#454545]">WhatsApp Template Manager</div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-[#dadada] bg-white px-5 lg:hidden">
        <button
          type="button"
          className="mr-4 inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#b8b8b8]"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-lg font-semibold">WABA BR</div>
      </header>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(272px,88vw)] flex-col bg-[#f4f4f4] transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="px-5 pb-4 pt-6">
          <ProductBrand />

          <div className="mt-6 text-[15px]">Import mode</div>
          <div className="mt-1 inline-flex rounded-[5px] bg-[#963cff] px-2.5 py-1 text-[13px] font-semibold text-white">
            STRICT MODE
          </div>

        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-transparent px-5 pb-4 pt-3 [scrollbar-color:#8d8d8d_transparent] [scrollbar-width:auto]">
          {sections.map((section) => (
            <div key={section.label} className="mb-5">
              <div className="mb-2 text-[12px] font-semibold text-[#777]">{section.label}</div>
              <nav className="grid gap-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center gap-3 border-l-[3px] border-transparent px-3.5 text-[15px] text-[#2f2f2f] transition-colors hover:bg-white",
                        active && "border-[#963cff] bg-white font-medium",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0 stroke-[1.7]" />
                      <span className="truncate">{item.label}</span>
                      {"badge" in item ? (
                        <span className="ml-auto rounded-full bg-[#caefd2] px-2 py-0.5 text-[11px] font-semibold text-[#294c32]">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

      </aside>

      <main className="min-h-screen w-full min-w-0 overflow-x-hidden pt-16 lg:ml-[272px] lg:w-[calc(100%-272px)] lg:pt-0">
        <div className="w-full min-w-0 max-w-full px-5 py-7 sm:px-7 lg:px-10 lg:py-8 xl:px-12">{children}</div>
      </main>
    </div>
  );
}
