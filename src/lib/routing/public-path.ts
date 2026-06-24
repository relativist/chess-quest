function normalizeBasePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

export function getBasePath() {
  if (process.env.NODE_ENV === "development") return "";
  return normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || process.env.APP_BASE_PATH || "");
}

export function publicPath(path: `/${string}`) {
  return `${getBasePath()}${path}`;
}
