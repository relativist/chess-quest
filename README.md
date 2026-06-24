# Chess Quest

Chess Quest is a Next.js chess adventure game where players move through quest maps, solve battle cards, earn score and gold, and play against Stockfish from a browser worker. The project includes player auth, progress tracking, a leaderboard, magic upgrades, demo quest maps, and a map editor for creating custom battle cards from FEN positions.

## Features

- Quest map with ordered battle cards, rewards, completion progress, and next-map unlocking.
- Chess battles powered by `chess.js` for rules and a bundled Stockfish 18 WebAssembly worker for engine replies.
- Card objectives such as checkmate, giving check, capturing a target piece, and surviving a number of half-moves.
- Magic upgrades that spend gold for engine hints or pawn transformations into bishop, knight, or rook.
- Registration/login with file-backed local auth fallback and PostgreSQL-backed auth when the database is configured.
- PostgreSQL persistence for users, maps, cards, progress, and game sessions through Prisma.
- Map editor for `MAP_EDITOR` users, including custom maps, card text, rewards, difficulty, publish state, and FEN validation.
- Docker setup for running the app and PostgreSQL together behind the `/chess-quest` base path.

## Tech Stack

- Next.js App Router, React, TypeScript
- Prisma 7 with PostgreSQL
- `chess.js` and Stockfish 18
- Vitest and ESLint
- Docker Compose for local containerized runtime

## Requirements

- Node.js 24 is the production baseline used by the Docker image.
- npm
- PostgreSQL 18 or another PostgreSQL-compatible server

The default local database URL is:

```text
postgresql://postgres:postgres@localhost:5432/chess_quest
```

## Environment

Copy the example file when you need local overrides:

```bash
cp .env.example .env
```

Available variables:

```text
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chess_quest"
NEXT_PUBLIC_BASE_PATH="/chess-quest"
```

`DATABASE_URL` is optional for the default local PostgreSQL connection. `NEXT_PUBLIC_BASE_PATH` is only needed for subpath deployments; Docker sets it to `/chess-quest`.

## Local Development

Install dependencies:

```bash
npm install
```

Prepare the database:

```bash
npm run migrate:deploy
npm run db:seed
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The `dev` script has a `predev` hook that runs `prisma migrate deploy` before Next starts. Make sure PostgreSQL is reachable before using it.

## Demo Data and Accounts

The seed command inserts the built-in quest maps and cards from `src/lib/demo-seed.ts`. If the demo maps are missing, the app also attempts to insert them on first request.

Players can register from `/auth`. A demo map editor account is maintained automatically:

```text
login: map
password: map
```

After login as the editor, open:

```text
/map/editor
```

## Useful Scripts

```bash
npm run dev              # Run Next.js locally after applying Prisma migrations
npm run build            # Generate Prisma client and build the Next.js app
npm run start            # Start the production Next.js server after migrations
npm run lint             # Run ESLint with zero warnings
npm run typecheck        # Run TypeScript checks
npm run test             # Run Vitest tests
npm run prisma:validate  # Validate Prisma schema
npm run prisma:generate  # Generate Prisma client into src/generated/prisma
npm run migrate:deploy   # Apply Prisma migrations
npm run db:seed          # Seed built-in quest data
```

## Docker

Build and run the app with PostgreSQL:

```bash
docker compose up --build
```

Apply migrations and seed data inside Docker when needed:

```bash
docker compose run --rm chess-quest npm run migrate:deploy
docker compose run --rm chess-quest npm run db:seed
```

The container serves the app on port `3000` with the `/chess-quest` base path:

```text
http://localhost:3000/chess-quest
```

## Project Layout

```text
src/app/                 Next.js routes and server actions
src/components/          UI components for the map, editor, auth, and chess board
src/lib/auth/            Auth/session helpers and local auth store
src/lib/chess/           FEN parsing, validation, and engine difficulty mapping
src/lib/quest/           Quest data, objectives, progress, leaderboard, and seeding
prisma/                  Prisma schema, migrations, and seed entrypoint
public/                  Runtime assets, chess pieces, music, wall art, and Stockfish worker
docs/                    Detailed notes for deployment, objectives, and magic upgrades
```

## Quality Gates

Before handing off code changes, run the relevant checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

For documentation-only changes, a full build is usually not required.

## More Documentation

- `docs/deployment.md` covers subpath deployment and standalone runtime checks.
- `docs/card-objectives.md` describes the objective system.
- `docs/magic-upgrades.md` describes magic upgrade rules and engine handoff behavior.

## Issue Tracking

This repository uses `bd` (beads) for issue tracking:

```bash
bd ready --json
bd show <id> --json
bd update <id> --status in_progress --json
bd close <id> --reason "Completed" --json
bd sync
```

Do not use separate markdown TODO lists for project work.
