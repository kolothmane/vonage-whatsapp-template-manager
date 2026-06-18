import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import type { Role } from "@/lib/domain/types";

const roleRank: Record<Role, number> = {
  Viewer: 1,
  Operator: 2,
  Admin: 3,
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required for authenticated API access.");
  }

  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSessionToken(payload: { sub: string; email: string; role: Role }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getJwtSecret());
}

export async function readSession(request: NextRequest) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : request.cookies.get("session")?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, getJwtSecret());
    return verified.payload as { sub: string; email: string; role: Role };
  } catch {
    return null;
  }
}

export function assertRole(currentRole: Role | undefined, requiredRole: Role) {
  if (!currentRole || roleRank[currentRole] < roleRank[requiredRole]) {
    throw new Error(`Role ${requiredRole} required.`);
  }
}

export function maskSecret(value?: string) {
  if (!value) {
    return "not configured";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
