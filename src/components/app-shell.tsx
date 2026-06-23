"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge,
  FileClock,
  History,
  LogOut,
  Menu,
  MessageSquareText,
  ScrollText,
  Settings,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
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

type AppShellProps = {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === "/login") {
    return children;
  }

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
          "fixed inset-y-0 left-0 z-50 flex w-[min(232px,88vw)] flex-col bg-[#f4f4f4] transition-transform duration-200 lg:translate-x-0",
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

        <div className="px-4 pb-3 pt-5">
          <ProductBrand />

          <div className="mt-4 text-[13px]">Import mode</div>
          <div className="mt-1 inline-flex rounded-[5px] bg-[#963cff] px-2 py-0.5 text-[12px] font-semibold text-white">
            STRICT MODE
          </div>

        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-transparent px-4 pb-3 pt-2 [scrollbar-color:#8d8d8d_transparent] [scrollbar-width:auto]">
          {sections.map((section) => (
            <div key={section.label} className="mb-3">
              <div className="mb-1.5 text-[11px] font-semibold text-[#777]">{section.label}</div>
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
                        "flex h-9 items-center gap-2.5 border-l-[3px] border-transparent px-3 text-[13px] text-[#2f2f2f] transition-colors hover:bg-white",
                        active && "border-[#963cff] bg-white font-medium",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0 stroke-[1.7]" />
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

        {user ? (
          <div className="border-t border-[#d5d5d5] px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{user.name || "Authenticated user"}</div>
              <div className="truncate text-[11px] text-[#666]">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="mt-3 flex h-9 w-full items-center gap-2 rounded-md border border-[#b8b8b8] bg-white px-3 text-[13px] hover:bg-[#fafafa]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        ) : null}
      </aside>

      <main className="min-h-screen w-full min-w-0 overflow-x-hidden pt-16 lg:ml-[232px] lg:w-[calc(100%-232px)] lg:pt-0">
        <div className="w-full min-w-0 max-w-full px-4 py-5 sm:px-6 lg:px-7 lg:py-6 xl:px-8">{children}</div>
      </main>
    </div>
  );
}
