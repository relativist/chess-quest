import {randomBytes, scrypt as scryptCallback, timingSafeEqual} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {promisify} from "node:util";
import {getPrisma, isDatabaseConfigured} from "@/lib/db/prisma";

const scrypt = promisify(scryptCallback);
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
  const password = input.password.trim();

  if (login.length < 3) return { ok: false, error: "Логин должен быть не короче 3 символов." };
  if (password.length < 4) return { ok: false, error: "Пароль должен быть не короче 4 символов." };

  if (isDatabaseConfigured()) {
    await ensureDatabaseUsers();
    const prisma = getPrisma();
    const duplicate = await prisma.user.findFirst({
      where: { OR: [{ login }, ...(email ? [{ email }] : [])] },
      select: { id: true },
    });
    if (duplicate) return { ok: false, error: "Пользователь с таким логином или e-mail уже существует." };

    const user = await prisma.user.create({
      data: {
        id: randomBytes(12).toString("hex"),
        login,
        email,
        displayName,
        passwordHash: await hashPassword(password),
        role: "PLAYER",
        gold: 0,
      },
    });

    return { ok: true, user: toPublicUser(toAuthUser(user)) };
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
    const user = await getPrisma().user.findFirst({
      where: { OR: [{ login: loginOrEmail }, { email: loginOrEmail }] },
    });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      return { ok: false, error: "Неверный логин/e-mail или пароль." };
    }

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
    const user = await getPrisma().user.findUnique({ where: { id } });
    return user ? toPublicUser(toAuthUser(user)) : null;
  }

  const store = await readStore();
  const user = store.users.find((candidate) => candidate.id === id);
  return user ? toPublicUser(user) : null;
}

export async function listPublicUsers(): Promise<PublicAuthUser[]> {
  if (isDatabaseConfigured()) {
    await ensureDatabaseUsers();
    const users = await getPrisma().user.findMany({ orderBy: { createdAt: "asc" } });
    return users.map((user) => toPublicUser(toAuthUser(user)));
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
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        displayName: user.displayName,
        email: user.email,
        login: user.login,
        passwordHash: user.passwordHash,
        role: user.role,
      },
      create: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        login: user.login,
        passwordHash: user.passwordHash,
        role: user.role,
        gold: user.gold,
      },
    });
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) return false;

  const storedBuffer = Buffer.from(storedHash, "hex");
  const derivedBuffer = (await scrypt(password, salt, storedBuffer.length)) as Buffer;
  return storedBuffer.length === derivedBuffer.length && timingSafeEqual(storedBuffer, derivedBuffer);
}

function normalizeLogin(login: string) {
  return login.trim().toLowerCase();
}

function normalizeEmail(email: string | undefined) {
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
