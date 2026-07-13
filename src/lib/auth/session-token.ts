import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";

type SignedSessionPayload = {
  sub: string;
  exp: number;
};

export function createOpaqueSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createSignedSessionToken(userId: string, expiresAt: Date, secret: string) {
  if (!userId || !secret || !Number.isFinite(expiresAt.getTime())) {
    throw new Error("Cannot create a session token from invalid input.");
  }

  const payload: SignedSessionPayload = {
    sub: userId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signedPart = `${TOKEN_VERSION}.${encodedPayload}`;
  const signature = sign(signedPart, secret);

  return `${signedPart}.${signature}`;
}

export function verifySignedSessionToken(token: string, secret: string, now = new Date()) {
  if (!secret || !Number.isFinite(now.getTime())) return null;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;

  const [version, encodedPayload, suppliedSignature] = parts;
  const expectedSignature = sign(`${version}.${encodedPayload}`, secret);
  const suppliedBuffer = Buffer.from(suppliedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<SignedSessionPayload>;
    const nowInSeconds = Math.floor(now.getTime() / 1000);

    if (
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      !Number.isSafeInteger(payload.exp) ||
      (payload.exp as number) <= nowInSeconds
    ) {
      return null;
    }

    return payload.sub;
  } catch {
    return null;
  }
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value, "utf8").digest("base64url");
}
