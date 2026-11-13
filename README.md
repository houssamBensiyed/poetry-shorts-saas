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

