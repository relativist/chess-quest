export const DEFAULT_LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/chess_quest";

export function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NODE_ENV === "development") return DEFAULT_LOCAL_DATABASE_URL;
  return undefined;
}

export function isDatabaseConfigured() {
  return Boolean(resolveDatabaseUrl());
}

export function getDatabaseUrl() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return databaseUrl;
}
