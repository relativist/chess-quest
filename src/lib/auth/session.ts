import { cookies } from "next/headers";
import { getUserById } from "@/lib/auth/auth-store";
import {
  createOpaqueSessionToken,
  createSignedSessionToken,
  hashSessionToken,
  verifySignedSessionToken,
} from "@/lib/auth/session-token";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { randomBytes } from "node:crypto";

const SESSION_COOKIE = "chess_quest_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
let developmentSessionSecret: string | undefined;

function shouldUseSecureCookie() {
  return process.env.CHESS_QUEST_COOKIE_SECURE === "true";
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  let cookieToken: string;

  if (isDatabaseConfigured()) {
    cookieToken = createOpaqueSessionToken();
    await getPrisma().authSession.create({
      data: {
        tokenHash: hashSessionToken(cookieToken),
        expiresAt,
        userId,
      },
    });
  } else {
    cookieToken = createSignedSessionToken(userId, expiresAt, getSessionSecret());
  }

  cookieStore.set(SESSION_COOKIE, cookieToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token && isDatabaseConfigured()) {
    try {
      await getPrisma().authSession.deleteMany({
        where: { tokenHash: hashSessionToken(token) },
      });
    } catch {
      // Cookie removal must still succeed if the database is temporarily unavailable.
    }
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  if (!isDatabaseConfigured()) {
    return getUserById(verifySignedSessionToken(token, getSessionSecret()) ?? undefined);
  }

  const tokenHash = hashSessionToken(token);
  const session = await getPrisma().authSession.findUnique({
    where: { tokenHash },
    select: { expiresAt: true, userId: true },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    try {
      await getPrisma().authSession.delete({ where: { tokenHash } });
    } catch {
      // An expired session is invalid even if cleanup races or fails.
    }
    return null;
  }

  return getUserById(session.userId);
}

function getSessionSecret() {
  const configuredSecret = process.env.CHESS_QUEST_SESSION_SECRET;
  if (configuredSecret) return configuredSecret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("CHESS_QUEST_SESSION_SECRET must be set in production.");
  }

  developmentSessionSecret ??= randomBytes(32).toString("base64url");
  return developmentSessionSecret;
}
