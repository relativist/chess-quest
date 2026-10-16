import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const integrationDescribe = process.env.SHARED_AUTH_INTEGRATION_DATABASE_URL ? describe : describe.skip;
const sharedId = "shared-auth-foxy-import";
const login = "shared-foxy-import";
let tempDir: string;
let prisma: Awaited<ReturnType<typeof import("@/lib/db/prisma").getPrisma>>;
let auth: typeof import("./auth-store");

integrationDescribe("shared auth PostgreSQL integration", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.SHARED_AUTH_INTEGRATION_DATABASE_URL!;
    tempDir = await mkdtemp(path.join(tmpdir(), "chess-shared-auth-"));
    process.env.CHESS_QUEST_DATA_DIR = tempDir;
    const db = await import("@/lib/db/prisma");
    prisma = db.getPrisma();
    auth = await import("./auth-store");
    const password = "  Foxy password  ";
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
    const encoded = `scrypt$v1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
    await prisma.$executeRaw`INSERT INTO public.auth_accounts (id, login, email, display_name, password_hash) VALUES (${sharedId}, ${login}, ${"foxy@example.test"}, ${"Foxy Player"}, ${encoded}) ON CONFLICT (id) DO NOTHING`;
  });

  afterAll(async () => {
    if (prisma) {
      const profiles = await prisma.user.findMany({
        where: { OR: [{ id: sharedId }, { id: "demo-map-editor" }, { login: { startsWith: "shared-concurrent-" } }, { login: { startsWith: "shared-registered-" } }] },
        select: { id: true },
      });
      await prisma.user.deleteMany({ where: { id: { in: profiles.map((profile) => profile.id) } } });
      await prisma.$executeRaw`DELETE FROM public.auth_accounts WHERE id IN (${sharedId}, ${"demo-map-editor"}) OR login LIKE 'shared-concurrent-%' OR login LIKE 'shared-registered-%'`;
      await prisma.$disconnect();
    }
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("logs into a Foxy-only identity and creates the game profile with its shared id", async () => {
    const result = await auth.loginUser({ loginOrEmail: login, password: "  Foxy password  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.id).toBe(sharedId);
    expect(await prisma.user.findUnique({ where: { id: sharedId } })).toMatchObject({ login, role: "PLAYER" });
  });

  it("registers shared credentials and handles duplicate registration races", async () => {
    const registeredLogin = `shared-registered-${randomBytes(4).toString("hex")}`;
    const registered = await auth.registerUser({ login: ` ${registeredLogin} `, password: " exact " });
    expect(registered.ok).toBe(true);
    const accounts = await prisma.$queryRaw<{ login: string; id: string }[]>`SELECT login, id FROM public.auth_accounts WHERE login = ${registeredLogin}`;
    expect(accounts).toHaveLength(1);

    const concurrentLogin = `shared-concurrent-${randomBytes(4).toString("hex")}`;
    const results = await Promise.all([
      auth.registerUser({ login: concurrentLogin, password: "password" }),
      auth.registerUser({ login: concurrentLogin, password: "password" }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
  });
});
