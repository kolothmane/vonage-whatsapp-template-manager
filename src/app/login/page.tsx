import { LockKeyhole } from "lucide-react";
import { signIn } from "@/auth";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

function safeRedirectPath(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = safeRedirectPath(params.callbackUrl);
  const accessDenied = params.error === "AccessDenied";

  async function loginWithGoogle() {
    "use server";
    await signIn("google", { redirectTo });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f4] px-4 py-10">
      <section className="w-full max-w-[420px] rounded-lg border border-[#c9c9c9] bg-white px-7 py-8 shadow-sm">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#111] text-white">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-2xl font-semibold">Sign in to WABA BR</h1>
        <p className="mt-2 text-sm leading-6 text-[#5f5f5f]">
          Use your company Google account to access the WhatsApp Template Manager.
        </p>

        {accessDenied ? (
          <div role="alert" className="mt-5 rounded-md border border-[#e0a3a3] bg-[#fff4f4] px-4 py-3 text-sm text-[#9b1c1c]">
            Access denied. Only verified <strong>@baybridgedigital.com</strong> and{" "}
            <strong>@bayretail.io</strong> accounts are authorized.
          </div>
        ) : null}

        <form action={loginWithGoogle} className="mt-6">
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[#a9a9a9] bg-white px-4 text-sm font-medium transition-colors hover:bg-[#f7f7f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#963cff]"
          >
            <span className="text-base font-semibold text-[#4285f4]" aria-hidden="true">
              G
            </span>
            Continue with Google
          </button>
        </form>

        <p className="mt-5 text-xs leading-5 text-[#727272]">
          Your Google password is never shared with this application.
        </p>
      </section>
    </main>
  );
}
