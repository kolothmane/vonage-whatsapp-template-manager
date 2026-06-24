import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getActiveEnvironmentIdForUser, listEnvironmentsForUser } from "@/lib/server/environments";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vonage WhatsApp Template Manager",
  description: "Enterprise operations platform for WhatsApp template imports across Vonage WABAs.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const environments = session?.user?.email ? await listEnvironmentsForUser(session.user.email) : [];
  const activeEnvironmentId = session?.user?.email ? await getActiveEnvironmentIdForUser(session.user.email) : "";

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <AppShell user={session?.user} environments={environments} activeEnvironmentId={activeEnvironmentId}>{children}</AppShell>
      </body>
    </html>
  );
}
