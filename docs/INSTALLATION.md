# Installation Guide

## Local Development

1. Install dependencies.

```bash
npm install
```

2. Copy environment values.

```bash
cp .env.example .env
```

3. Start PostgreSQL and Redis.

```bash
docker compose up -d postgres redis
```

4. Generate Prisma client and migrate.

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Start the app.

```bash
npm run dev
```

## Production

Set these variables in the hosting platform:

- `VONAGE_API_KEY`
- `VONAGE_API_SECRET`
- `VONAGE_APPLICATION_ID`
- `VONAGE_PRIVATE_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`

The app is Vercel-ready. PostgreSQL and Redis can be provisioned through managed providers, then linked through environment variables.
