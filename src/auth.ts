import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { hasAllowedCompanyDomain, isAdminEmail, normalizeEmail } from "@/lib/server/admin-access";
import { isWhitelistedEmail } from "@/lib/server/whitelist";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ profile }) {
      const googleProfile = profile as
        | { email?: string | null; email_verified?: boolean }
        | undefined;

      if (
        googleProfile?.email_verified !== true ||
        !hasAllowedCompanyDomain(googleProfile.email)
      ) {
        return false;
      }

      const email = normalizeEmail(googleProfile.email!);
      if (isAdminEmail(email)) {
        return true;
      }

      return isWhitelistedEmail(email);
    },
  },
});
