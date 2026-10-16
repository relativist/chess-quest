BEGIN;

CREATE TABLE IF NOT EXISTS public.auth_accounts (
    id TEXT PRIMARY KEY,
    login TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public."User" AS game_user
        JOIN public.auth_accounts AS account
          ON account.id <> game_user.id
         AND (account.login = game_user.login OR (game_user.email IS NOT NULL AND account.email = game_user.email))
    ) THEN
        RAISE EXCEPTION 'Cannot import Chess Quest users into auth_accounts: login or email belongs to a different account id';
    END IF;
END $$;

INSERT INTO public.auth_accounts (id, login, email, display_name, password_hash, created_at)
SELECT id, login, email, "displayName", "passwordHash", "createdAt"
FROM public."User"
ON CONFLICT (id) DO NOTHING;

-- Credentials are authoritative only in auth_accounts; User is a game profile.
UPDATE public."User" SET "passwordHash" = 'managed-by-shared-auth';

COMMIT;
