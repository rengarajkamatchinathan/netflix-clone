# Seed data

Everything StreamFlix shows lives in Postgres and is edited in the admin panel (`/admin`). The files here are only the **starting data** that `npm run db:setup` loads into an empty database. Editing them later changes nothing in a database that is already set up.

```
scripts/seed-data/
├── data.json                  starting shows, grouped by channel
└── channels/
    └── <channel-id>/          e.g. jetix (must match the key in data.json)
        ├── channel.json       name, tagline, order, colours, YouTube bumper links
        └── logo.png           logo (optional; .png .jpg .webp .gif .avif .svg)
```

## Setup

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
2. `npm run db:setup` creates the tables, imports these files and creates the admin account. It's safe to run again: shows, channels, logos and users that already exist are never overwritten. `npm run db:setup -- --reset-admin` resets the admin password to `ADMIN_PASSWORD`.
3. `npm run dev` starts the app on http://localhost:3000.

For production, run `npm run build`, then `npm start`. `npm run typecheck` checks the TypeScript.

## Where things are managed after setup

| What | Where |
|---|---|
| Shows and episodes | Admin → Shows |
| Channels, line-ups, colours, logos | Admin → Channels |
| Bumpers (YouTube links) | Admin → Channels → Bumpers tab |
| Avatars (image links) | Admin → Avatars → Add avatars (paste one link per line) |
| Users | Admin → Users |

## data.json

```json
{
  "channels": {
    "jetix": [
      { "title": "Ben 10", "year": 2005, "genre": "Action", "synopsis": "One-line description.",
        "image": "https://example.com/ben10-wide.jpg",
        "videos": ["https://example.com/ep1.mp4", { "title": "The Big Race", "url": "https://example.com/ep2.mp4" }] }
    ]
  },
  "series": [
    { "title": "Friends", "year": 1994, "genre": "Sitcom", "synopsis": "…", "image": "" }
  ]
}
```

- **Only `title` is required.** Optional: `year`, `genre`, `synopsis`, `image`, `poster`, `link`, `videos`, `maturity`, `needsReview`.
- **Same show on two channels:** list it under both; it becomes one show on both channels.
- **Order:** shows play on a channel in the order they're listed.

Logos under `channels/` are git-ignored (size and copyright). Only use images you have the right to use.
