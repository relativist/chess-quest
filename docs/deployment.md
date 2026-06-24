# Deployment

Chess Quest is configured to run behind the `/chess-quest` base path.

## Database

Quest maps and cards are stored in PostgreSQL.

### Local development (`npm run dev`)

By default the app connects to:

```text
postgresql://postgres:postgres@localhost:5432/chess_quest
```

No `.env` file is required if your local Postgres uses the same credentials and database name. Override with `.env` or `.env.local` when needed.

First-time database setup:

```bash
npx prisma migrate deploy
npm run db:seed
```

The demo map from `src/lib/demo-seed.ts` is also inserted automatically on first request if it is still missing.

### Docker

`docker-compose.yml` starts Postgres next to the app and sets:

```text
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/chess_quest
```

Apply migrations before or during the first deploy:

```bash
docker compose run --rm chess-quest npx prisma migrate deploy
docker compose run --rm chess-quest npm run db:seed
```

## Docker

The Docker image builds with:

```bash
NEXT_PUBLIC_BASE_PATH=/chess-quest
```

The runtime container serves the standalone Next.js server on port `3000`, so the app is expected at:

```text
http://host:3000/chess-quest
```

`Dockerfile` copies both required static locations into the standalone runtime:

- `public`
- `.next/static`

## Local Standalone Check

To reproduce the Docker runtime locally:

```bash
NEXT_PUBLIC_BASE_PATH=/chess-quest npm run build
cp -R public .next/standalone/public
cp -R .next/static .next/standalone/.next/static
cd .next/standalone
PORT=3003 HOSTNAME=127.0.0.1 NEXT_PUBLIC_BASE_PATH=/chess-quest node server.js
```

Then open:

```text
http://127.0.0.1:3003/chess-quest/map
http://127.0.0.1:3003/chess-quest/game/opening-gate
```

## Verification Points

- Internal links should include `/chess-quest`.
- Public assets should load from `/chess-quest/...`.
- Next static chunks should load from `/chess-quest/_next/static/...`.
- Stockfish should report `Готов` on the battle page.
