# Poetry Shorts SaaS

Project 01 of the Poetry Shorts architecture: the user-facing SaaS platform and
orchestrator. A channel groups the Buffer destinations (platforms) that publish
together, stores the encrypted Buffer credentials, keeps the remembered UTC
posting times per language group, stores each user's voice recordings in
Cloudinary or in a shared local folder, runs the BullMQ voice queue, and
coordinates the render and publish services over HTTP and webhooks.

```
Browser --> Next.js SaaS (this app, :3000)
                |  audio upload
                v
      Cloudinary (remote) or LOCAL_MEDIA_ROOT (local)
                |
                | BullMQ job (Redis)
                v
            Worker (concurrency 1)
                |  POST /api/v1/render        --> Project 02 (:8000)
                |  <-- POST /api/webhooks/render-complete
                |  POST /api/v1/publish       --> Project 03 (:8001)
                v  <-- POST /api/webhooks/publish-complete
            PostgreSQL (status + progress)
```

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS with local shadcn-style UI
  primitives
- PostgreSQL with Prisma ORM
- Redis + BullMQ for background work
- NextAuth (credentials provider, JWT sessions) with `USER` and `ADMIN` roles
- Cloudinary Node SDK for remote audio storage; optional shared folder for local mode
- AES-256-GCM encryption for Buffer access tokens

## Roles

| Capability | USER | ADMIN |
| --- | :---: | :---: |
| Register, sign in, change password | yes | yes |
| Channels CRUD, Buffer platform discovery, encrypted token | yes | yes |
| Remembered UTC posting times per language group | yes | yes |
| Upload `.mp3`/`.wav` voices and pick a UTC publish time | yes | yes |
| Connect your own Cloudinary account | yes | yes |
| Choose remote (Cloudinary) or local (shared folder) storage per user | yes | yes |
| Run the global voice queue, preview/download reels, retry failures | yes | yes |
| See scheduled / publishing / published / partial / failed per platform | yes | yes |
| View / disable / delete users |  | yes |
| Global BullMQ queue health |  | yes |

## How to run

### 1. Requirements

- Node.js 18.17 or newer (Node 20 LTS recommended) and `npm`
- PostgreSQL 14+ and Redis 6+
- Docker (optional, used by the bundled `docker-compose.yml`)
- Project 02 (render engine) and Project 03 (Buffer uploader) for real renders and
  publishing. The SaaS starts without them, but queue runs will fail until they
  are reachable.

### 2. Start PostgreSQL and Redis

The repository includes a Compose file with both services:

```bash
docker compose up -d
```

This creates PostgreSQL on `localhost:5432` (database `poetry_shorts_saas`, user
`postgres`, password `postgres`) and Redis on `localhost:6379`.

If you already run PostgreSQL and Redis, skip this step and point `DATABASE_URL`
and `REDIS_URL` at them instead.

Check that both are healthy:

```bash
docker compose ps
```

### 3. Create the environment file

```bash
cp .env.example .env
```

Open `.env` and set these values:

| Variable | Required | Notes |
| --- | :---: | --- |
| `DATABASE_URL` | yes | `postgresql://postgres:postgres@localhost:5432/poetry_shorts_saas` with the Compose defaults |
| `REDIS_URL` | yes | `redis://localhost:6379` with the Compose defaults |
| `NEXTAUTH_SECRET` | yes | Generate with `openssl rand -hex 32` |
| `NEXTAUTH_URL` | yes | `http://localhost:3000` in development |
| `BUFFER_ENCRYPTION_KEY` | yes | Exactly 64 hex characters. Generate with `openssl rand -hex 32`. Keep this value: changing it makes saved Buffer tokens and Cloudinary secrets unreadable |
| `RENDER_SERVICE_URL` | yes | Defaults to `http://localhost:8000` |
| `UPLOAD_SERVICE_URL` | yes | Defaults to `http://localhost:8001` |
| `WEBHOOK_BASE_URL` | yes | URL Project 02/03 can reach, `http://localhost:3000` locally |
| `RENDER_SERVICE_API_KEY` | yes | Must match Project 02's `VIDEO_BUILDER_API_KEY` |
| `UPLOAD_SERVICE_API_KEY` | yes | Must match Project 03's `SERVICE_API_KEY` |
| `WEBHOOK_SECRET` | production only | When set, Project 02/03 must send it as `X-Webhook-Secret`. Left empty, callbacks stay open in development and are rejected in production |
| `LOCAL_MEDIA_ROOT` | only for local mode | Absolute folder shared with Project 02 at the same path |
| `SEED_ADMIN_EMAIL` | seeding | Login for the first admin, for example `admin@poetryshorts.local` |
| `SEED_ADMIN_PASSWORD` | seeding | Password for the first admin; change it after the first login |

Generate the two secrets:

```bash
openssl rand -hex 32   # NEXTAUTH_SECRET
openssl rand -hex 32   # BUFFER_ENCRYPTION_KEY
```

Cloudinary is **not** configured in `.env`. Each user adds their own Cloudinary
cloud name, API key, and API secret in **Settings -> Cloudinary** after signing
in. The SaaS and its worker use that account for the user's uploads. Project 02
still needs its own Cloudinary account in its own `.env` for remote-mode reels,
and that account can be different from the user's.

### 4. Install dependencies and prepare the database

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

Notes:

- `npx prisma migrate deploy` applies the included migration. If the migration
  history is missing for your database, use `npm run db:push` instead.
- `npm run db:seed` creates the admin from `SEED_ADMIN_*` if it does not exist.
  If the email already exists it only ensures the account is an active admin; it
  does not reset the password. Change the password from **Profile** after signing
  in. Running it again is safe.
- `npm run db:studio` opens Prisma Studio if you want to inspect rows.

### 5. Start the web app and the worker

The web app and the worker are two separate processes. Run each one in its own
terminal.

Terminal 1, web app:

```bash
npm run dev
```

Terminal 2, worker:

```bash
npm run worker
```

- Web app: <http://localhost:3000>
- Worker: renders voices and publishes them. Nothing is processed if it is not
  running.
- `npm run worker` uses `tsx watch`, so it reloads on file changes. In production
  use `npm run worker:start` instead.

### 6. Start the sibling services

Project 02, render engine (`../poetry-shorts-maker`):

```bash
# in that project
python api.py
```

It must listen on port 8000 and use the same `VIDEO_BUILDER_API_KEY` as
`RENDER_SERVICE_API_KEY` here.

Project 03, Buffer uploader (`../poetry-shorts-uploader`):

- It must listen on port 8001.
- Its `SERVICE_API_KEY` must match `UPLOAD_SERVICE_API_KEY` here.
- If `WEBHOOK_SECRET` is set here, it must send the same value in the
  `X-Webhook-Secret` header.

### 7. Sign in

Open <http://localhost:3000> and sign in with the seeded admin:

```
Email:    <SEED_ADMIN_EMAIL>
Password: <SEED_ADMIN_PASSWORD>
```

The defaults in `.env.example` are `admin@poetryshorts.local` and
`change-me-admin`. Change the password from the avatar menu in the top right,
then **Settings**. New users can register from `/register`.

### 8. First run checklist

1. **Avatar menu -> Settings**: set a display name and profile picture, choose a
   light or dark theme, and change the password.
2. **Settings -> Cloudinary**: paste your Cloudinary cloud name, API key, and
   API secret, then save. The app checks the account before storing it.
3. **Settings -> File storage**: choose Remote (Cloudinary) or Local.
4. **Channels -> Add channel**: paste a Buffer access token, load the
   organization, select at least one platform, and save.
5. **Voices -> Upload voice**: upload an `.mp3` or `.wav`, choose the UTC date
   and time, and upload.
6. **Queue -> Process saved voices**: the worker renders and schedules the post.
7. **Voices**: use **Refresh statuses** to read the current Buffer state.

## Running in production

Build once, then run the server and the worker as separate long-lived processes:

```bash
npm run build
npm run start          # web app on PORT (default 3000)
npm run worker:start   # background worker
```

Important:

- `npm run build` writes to `.next`. Stop `npm run dev` before building. Running a
  build while the dev server is active can corrupt `.next`.
- Set `NEXTAUTH_URL` to the public URL and `WEBHOOK_BASE_URL` to the URL the
  render and upload services can reach.
- Set `WEBHOOK_SECRET` in production. Without it the webhook endpoints reject
  every callback.
- Keep `BUFFER_ENCRYPTION_KEY` stable across deploys so stored Buffer tokens
  remain decryptable.

## Common commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server on port 3000 |
| `npm run worker` | Start the queue worker in watch mode |
| `npm run worker:start` | Start the queue worker once (production) |
| `npm run build` | Generate Prisma client and build for production |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript with no emit |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:push` | Push the schema without a migration |
| `npm run db:seed` | Create the seed admin, or ensure an existing one is active |
| `npm run db:reset-activity` | Delete voices, publish rows, queue runs, and saved posting times. Keeps accounts, channels, tokens, and credentials |
| `npm run db:studio` | Open Prisma Studio |

## Using the app

### Account menu and settings

Click the avatar in the top right to open the account menu. It contains:

- **Your profile**: profile picture, display name, activity totals, and
  connected services.
- **Settings**: theme, password, file storage, and Cloudinary.
- **Appearance**: light, dark, or system theme. The choice is remembered in a
  cookie and local storage, and it applies before the page paints.
- **Sign out**.

Profile pictures are either one of the built-in artworks or a custom upload.
Uploads are cropped to a square and resized to 256 by 256 in the browser, then
stored with the account. Custom images are limited to 300 KB on disk. No
Cloudinary account is needed for a profile picture.

### Dashboard

The overview page summarizes the last 14 days:

- **Activity** bars for voices added and posts published.
- **Voice status** donut for queued, in-flight, scheduled, published, and failed
  voices.
- **Platform mix** for where posts are scheduled.
- **Next to publish** and **Recent voices** lists.

The charts are plain HTML and CSS, with a screen-reader table behind the
activity chart, so they work without an external chart package.

### Clearing activity

`npm run db:reset-activity` removes voices, publish rows, queue runs, and saved
posting times. It keeps user accounts, channels, Buffer tokens, and Cloudinary
credentials. Use it when you want a clean dashboard without reconnecting
anything.

## How the pieces fit

### Channel and Buffer persistence

A channel stores the Buffer organization id/name and the Buffer access token
encrypted with AES-256-GCM. Each connected platform is a `ChannelDestination`
row with its Buffer channel id, platform, enabled flag, and health flags. All of
this lives in PostgreSQL, so restarting the app does not lose the connection. The
worker decrypts the stored token only when it is about to publish.

The project does not implement Buffer OAuth, so it cannot refresh an expired or
revoked token. If Buffer invalidates the token, edit the channel and paste a new
one. Changing `BUFFER_ENCRYPTION_KEY` also makes the stored token unreadable.

### Status lifecycle

A voice moves through:

```
queued -> processing -> rendered -> submitting -> scheduled --> publishing --> published
   |          |            |                     |              |
   +----------+------------+---------------------+--------------+--> partial / failed
                                                                   +--(retry)--> queued
```

Each destination of a voice has its own status (`scheduled`, `publishing`,
`published`, `failed`). The voice status is calculated from them:

- every destination scheduled -> `scheduled`
- any destination still sending -> `publishing`
- some published and some failed -> `partial`
- every destination published -> `published`
- every destination failed -> `failed`

Buffer keeps the posts, so the run finishes as soon as each voice is scheduled.
The app can be closed until the publish time. When the voices page opens, Project
01 asks Project 03 for the current Buffer status and updates the rows.

A status check never fails a post by itself. If Buffer cannot be reached, or the
stored token is rejected, the last known status is kept and the error is shown.
Only a real Buffer answer changes a destination status.

If `upload_to_buffer` is **false**, the voice goes `rendered -> completed` and
stays downloadable. A `QueueRun` is `processing` while work is in flight and
finishes as `completed` (or `failed` when every voice failed).

`QueueRun.completed_items` advances after each voice, so the UI progress is
`completed_items / total_items`. Failed voices still advance progress and do not
stop the rest of the run.

