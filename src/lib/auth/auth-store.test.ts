import { randomBytes, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { registerUser, verifyPassword } from "./auth-store";

describe("shared auth registration limits", () => {
  it("limits new login and password to 128 Unicode code points", async () => {
    const longLogin = await registerUser({ login: "😀".repeat(129), password: "valid" });
    expect(longLogin).toMatchObject({ ok: false, error: "Логин должен быть не длиннее 128 символов." });

    const longPassword = await registerUser({ login: "valid-login", password: "😀".repeat(129) });
    expect(longPassword).toMatchObject({ ok: false, error: "Пароль должен быть не длиннее 128 символов." });
  });
});

describe("shared password hash verification", () => {
  it("accepts Chess Quest legacy salt:hex scrypt hashes", async () => {
    const password = "  exact password  ";
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    await expect(verifyPassword(password, `${salt}:${hash}`)).resolves.toBe(true);
    await expect(verifyPassword("exact password", `${salt}:${hash}`)).resolves.toBe(false);
  });

  it("accepts Foxy scrypt v1 base64url hashes", async () => {
    const password = "foxy-compatible";
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
    const encoded = `scrypt$v1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrong", encoded)).resolves.toBe(false);
  });

  it("rejects malformed and oversized encodings safely", async () => {
    await expect(verifyPassword("x", "scrypt$v1$%%%$%%%" )).resolves.toBe(false);
    await expect(verifyPassword("x", `scrypt$v1$${"A".repeat(500)}$AAAA`)).resolves.toBe(false);
    await expect(verifyPassword("x", "not-a-hash")).resolves.toBe(false);
  });
});
