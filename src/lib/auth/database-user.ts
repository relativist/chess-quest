import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";

export type DatabaseAuthUser = {
  displayName: string;
  email: string | null;
  id: string;
  login: string;
  role: "MAP_EDITOR" | "PLAYER";
};

export async function ensureDatabaseUser(user: DatabaseAuthUser) {
  if (!isDatabaseConfigured()) return;

  await getPrisma().user.upsert({
    where: { id: user.id },
    update: {
      displayName: user.displayName,
      email: user.email,
      login: user.login,
      role: user.role,
    },
    create: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      login: user.login,
      passwordHash: "managed-by-file-auth",
      role: user.role,
    },
  });
}
