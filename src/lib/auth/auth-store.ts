import {randomBytes, scrypt as scryptCallback, timingSafeEqual} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {getPrisma, isDatabaseConfigured} from "@/lib/db/prisma";

function deriveScrypt(password: string, salt: string | Buffer, length: number, options?: { N: number; r: number; p: number; maxmem: number }) {
  return new Promise<Buffer>((resolve, reject) => scryptCallback(password, salt, length, options ?? {}, (error, key) => error ? reject(error) : resolve(key as Buffer)));
}
function getDataDir() {
  return process.env.CHESS_QUEST_DATA_DIR || path.join(process.cwd(), ".data");
}

function getUsersFile() {
  return path.join(getDataDir(), "auth-users.json");
}
let databaseUsersReady: Promise<void> | null = null;

export type AuthRole = "PLAYER" | "MAP_EDITOR";

export type AuthUser = {
  id: string;
  login: string;
  email: string | null;
  displayName: string;
  passwordHash: string;
  role: AuthRole;
  gold: number;
  createdAt: string;
};

type PublicAuthUser = Omit<AuthUser, "passwordHash">;

type StoredUsers = {
  users: AuthUser[];
};

export type AuthResult =
  | { ok: true; user: PublicAuthUser }
  | { ok: false; error: string };

export async function registerUser(input: { login: string; email?: string; password: string; displayName?: string }): Promise<AuthResult> {
  const login = normalizeLogin(input.login);
  const email = normalizeEmail(input.email);
  const displayName = input.displayName?.trim() || login;
  const password = input.password;

  if (login.length < 3) return { ok: false, error: "Логин должен быть не короче 3 символов." };
  if (Array.from(login).length > 128) return { ok: false, error: "Логин должен быть не длиннее 128 символов." };
  if (password.length < 4) return { ok: false, error: "Пароль должен быть не короче 4 символов." };
  if (Array.from(password).length > 128) return { ok: false, error: "Пароль должен быть не длиннее 128 символов." };

  if (isDatabaseConfigured()) {
    await ensureDatabaseUsers();
    const prisma = getPrisma();
    const id = randomBytes(12).toString("hex");
    const passwordHash = await hashPassword(password);
    try {
      const user = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`INSERT INTO public.auth_accounts (id, login, email, display_name, password_hash) VALUES (${id}, ${login}, ${email}, ${displayName}, ${passwordHash})`;
        return tx.user.create({ data: { id, login, email, displayName, passwordHash: "managed-by-shared-auth", role: "PLAYER", gold: 0 } });
      });
      return { ok: true, user: toPublicUser(toAuthUser(user)) };
    } catch (error) {
      if (isUniqueViolation(error)) return { ok: false, error: "Пользователь с таким логином или e-mail уже существует." };
      throw error;
    }
  }

  const store = await readStore();
  const duplicate = store.users.find((user) => user.login === login || (email && user.email === email));
  if (duplicate) return { ok: false, error: "Пользователь с таким логином или e-mail уже существует." };

  const user: AuthUser = {
    id: randomBytes(12).toString("hex"),
    login,
    email,
    displayName,
    passwordHash: await hashPassword(password),
    role: "PLAYER",
    gold: 0,
    createdAt: new Date().toISOString(),
  };

  store.users.push(user);
  await writeStore(store);

  return { ok: true, user: toPublicUser(user) };
}

export async function loginUser(input: { loginOrEmail: string; password: string }): Promise<AuthResult> {
  const loginOrEmail = input.loginOrEmail.trim().toLowerCase();

  if (isDatabaseConfigured()) {
    await ensureDatabaseUsers();
    const accounts = await getPrisma().$queryRaw<AuthAccount[]>`SELECT id, login, email, display_name AS "displayName", password_hash AS "passwordHash", created_at AS "createdAt" FROM public.auth_accounts WHERE lower(login) = ${normalizeLogin(loginOrEmail)} OR lower(email) = ${normalizeEmail(loginOrEmail)}`;
    const account = accounts[0];
    if (!account || !(await verifyPassword(input.password, account.passwordHash))) {
      return { ok: false, error: "Неверный логин/e-mail или пароль." };
    }
    const user = await ensureGameProfile(account);
    return { ok: true, user: toPublicUser(toAuthUser(user)) };
  }

  const store = await readStore();
  const user = store.users.find((candidate) => candidate.login === loginOrEmail || candidate.email === loginOrEmail);

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    return { ok: false, error: "Неверный логин/e-mail или пароль." };
  }

  return { ok: true, user: toPublicUser(user) };
}

export async function getUserById(id: string | undefined): Promise<PublicAuthUser | null> {
  if (!id) return null;

  if (isDatabaseConfigured()) {
    await ensureDatabaseUsers();
    const rows = await getPrisma().$queryRaw<AuthAccount[]>`SELECT id, login, email, display_name AS "displayName", password_hash AS "passwordHash", created_at AS "createdAt" FROM public.auth_accounts WHERE id = ${id}`;
    const user = rows[0] ? await ensureGameProfile(rows[0]) : null;
    return user ? toPublicUser(toAuthUser(user)) : null;
  }

  const store = await readStore();
  const user = store.users.find((candidate) => candidate.id === id);
  return user ? toPublicUser(user) : null;
}

export async function listPublicUsers(): Promise<PublicAuthUser[]> {
  if (isDatabaseConfigured()) {
    await ensureDatabaseUsers();
    const users = await getPrisma().$queryRaw<AuthAccount[]>`SELECT id, login, email, display_name AS "displayName", password_hash AS "passwordHash", created_at AS "createdAt" FROM public.auth_accounts ORDER BY created_at ASC`;
    return Promise.all(users.map(async (account) => toPublicUser(toAuthUser(await ensureGameProfile(account)))));
  }

  const store = await readStore();
  return store.users.map(toPublicUser);
}

async function readStore(): Promise<StoredUsers> {
  const store = await readFileStore();
  return ensureDemoUsers(store);
}

async function readFileStore(): Promise<StoredUsers> {
  let store: StoredUsers;
  try {
    const content = await readFile(getUsersFile(), "utf8");
    store = JSON.parse(content) as StoredUsers;
  } catch {
    store = { users: [] };
  }

  return store;
}

async function ensureDemoUsers(store: StoredUsers): Promise<StoredUsers> {
  let changed = false;

  store.users = store.users.map((user) => {
    const next = { ...user };
    if (!next.role) {
      next.role = "PLAYER";
      changed = true;
    }
    if (typeof next.gold !== "number") {
      next.gold = 0;
      changed = true;
    }
    return next;
  });

  const mapUser = store.users.find((user) => user.login === "map");
  if (mapUser) {
    if (mapUser.role !== "MAP_EDITOR" || mapUser.displayName !== "Редактор карт") {
      mapUser.role = "MAP_EDITOR";
      mapUser.displayName = "Редактор карт";
      changed = true;
    }
  } else {
    store.users.push({
      id: "demo-map-editor",
      login: "map",
      email: null,
      displayName: "Редактор карт",
      passwordHash: await hashPassword("map"),
      role: "MAP_EDITOR",
      gold: 0,
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }

  if (changed) await writeStore(store);
  return store;
}

async function writeStore(store: StoredUsers) {
  const usersFile = getUsersFile();
  await mkdir(path.dirname(usersFile), { recursive: true });
  await writeFile(usersFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function ensureDatabaseUsers() {
  if (!databaseUsersReady) {
    databaseUsersReady = ensureDatabaseUsersOnce().catch((error) => {
      databaseUsersReady = null;
      throw error;
    });
  }

  await databaseUsersReady;
}

async function ensureDatabaseUsersOnce() {
  const fileStore = await ensureDemoUsers(await readFileStore());
  const prisma = getPrisma();

  for (const user of fileStore.users) {
    const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM public.auth_accounts WHERE id = ${user.id} OR login = ${normalizeLogin(user.login)} OR (${user.email}::text IS NOT NULL AND email = ${normalizeEmail(user.email)})`;
    if (existing.length) {
      if (!existing.some((row) => row.id === user.id)) {
        console.warn(`Skipped auth file identity with conflicting login or email: ${user.login}`);
      } else {
        const [account] = await prisma.$queryRaw<AuthAccount[]>`SELECT id, login, email, display_name AS "displayName", password_hash AS "passwordHash", created_at AS "createdAt" FROM public.auth_accounts WHERE id = ${user.id}`;
        if (account) await ensureGameProfile(account);
      }
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`INSERT INTO public.auth_accounts (id, login, email, display_name, password_hash) VALUES (${user.id}, ${normalizeLogin(user.login)}, ${normalizeEmail(user.email)}, ${user.displayName}, ${user.passwordHash})`;
        await tx.user.upsert({ where: { id: user.id }, update: {}, create: { id: user.id, login: normalizeLogin(user.login), email: normalizeEmail(user.email), displayName: user.displayName, passwordHash: "managed-by-shared-auth", role: user.role, gold: user.gold } });
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      console.warn(`Skipped auth file identity with conflicting login or email: ${user.login}`);
    }
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await deriveScrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  try {
    if (passwordHash.startsWith("scrypt$v1$")) {
      const [scheme, version, saltText, hashText, ...extra] = passwordHash.split("$");
      if (scheme !== "scrypt" || version !== "v1" || extra.length) return false;
      if (!saltText || !hashText || !/^[A-Za-z0-9_-]{1,128}$/.test(saltText) || !/^[A-Za-z0-9_-]{1,256}$/.test(hashText)) return false;
      const salt = Buffer.from(saltText, "base64url");
      const expected = Buffer.from(hashText, "base64url");
      if (salt.length !== 16 || expected.length !== 64) return false;
      const actual = await deriveScrypt(password, salt, expected.length, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
      return timingSafeEqual(expected, actual);
    }
    const [salt, storedHash, ...extra] = passwordHash.split(":");
    if (!salt || !storedHash || extra.length || !/^[a-f\d]{16,128}$/i.test(salt) || !/^(?:[a-f\d]{2}){16,128}$/i.test(storedHash)) return false;
    const storedBuffer = Buffer.from(storedHash, "hex");
    const derivedBuffer = await deriveScrypt(password, salt, storedBuffer.length, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
    return timingSafeEqual(storedBuffer, derivedBuffer);
  } catch { return false; }
}

function normalizeLogin(login: string) {
  return login.trim().normalize("NFC").toLowerCase();
}

type AuthAccount = { id: string; login: string; email: string | null; displayName: string; passwordHash: string; createdAt: Date };

async function ensureGameProfile(account: AuthAccount) {
  const prisma = getPrisma();
  return prisma.user.upsert({
    where: { id: account.id }, update: { login: account.login, email: account.email, displayName: account.displayName },
    create: { id: account.id, login: account.login, email: account.email, displayName: account.displayName, passwordHash: "managed-by-shared-auth", role: "PLAYER" },
  });
}

function isUniqueViolation(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const prismaError = error as { code?: string; meta?: { code?: string }; message?: string };
  return prismaError.code === "P2002" || prismaError.code === "23505" || (prismaError.code === "P2010" && (prismaError.meta?.code === "23505" || prismaError.message?.toLowerCase().includes("duplicate key value violates unique constraint") === true));
}

function normalizeEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export async function getStoredUserGold(userId: string | undefined) {
  if (!userId) return 0;

  const store = await readStore();
  return store.users.find((user) => user.id === userId)?.gold ?? 0;
}

export async function getAllStoredUserGoldBalances() {
  const store = await readStore();
  return new Map(store.users.map((user) => [user.id, user.gold]));
}

export async function incrementStoredUserGold(userId: string, amount: number) {
  const store = await readStore();
  const user = store.users.find((candidate) => candidate.id === userId);
  if (!user) return 0;

  user.gold = Math.max(0, user.gold + amount);
  await writeStore(store);
  return user.gold;
}

export async function spendStoredUserGold(userId: string, costGold: number) {
  const store = await readStore();
  const user = store.users.find((candidate) => candidate.id === userId);
  const availableGold = user?.gold ?? 0;
  if (!user || availableGold < costGold) return { availableGold, ok: false };

  user.gold = availableGold - costGold;
  await writeStore(store);
  return { availableGold: user.gold, ok: true };
}

function toPublicUser(user: AuthUser): PublicAuthUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  void _passwordHash;
  return publicUser;
}

function toAuthUser(user: {
  createdAt: Date;
  displayName: string;
  email: string | null;
  id: string;
  login: string;
  passwordHash: string;
  role: string;
  gold: number;
}): AuthUser {
  return {
    id: user.id,
    login: user.login,
    email: user.email,
    displayName: user.displayName,
    passwordHash: user.passwordHash,
    role: user.role === "MAP_EDITOR" ? "MAP_EDITOR" : "PLAYER",
    gold: user.gold,
    createdAt: user.createdAt.toISOString(),
  };
}
