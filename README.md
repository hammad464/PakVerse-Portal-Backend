# PakVerse Backend

This is the production NestJS backend API for the PakVerse Portal.

## Prerequisites

Before starting, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (version 20 or higher)
- [Docker Desktop](https://docs.docker.com/get-docker/) (or native PostgreSQL and Redis)

## Environment Setup

1. Copy the example environment file to create your local `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open the `.env` file and fill in all required placeholder values (e.g., PostgreSQL password, Cloudinary credentials, JWT secrets).

## Start Services

You need a PostgreSQL database and a Redis instance running. The easiest way is using Docker:

Start PostgreSQL:
```bash
docker run --name pakverse-postgres \
  -e POSTGRES_PASSWORD=your_db_password \
  -e POSTGRES_DB=pakverse \
  -p 5432:5432 \
  -d postgres:15-alpine
```

Start Redis:
```bash
docker run --name pakverse-redis \
  -p 6379:6379 \
  -d redis:7-alpine
```

Verify the services are running by executing `docker ps`.

## Install and Migrate

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Generate the Prisma client:
   ```bash
   npx prisma generate
   ```

3. Run the database migrations (this creates all required tables):
   ```bash
   npx prisma migrate dev --name init
   ```

## Start Server

Start the backend application in development mode:
```bash
npm run start:dev
```
*Note: To run in production, use `npm run start:prod`.*

## Verification

Once the server is running, visit the following URL to access the Swagger UI documentation:
[http://localhost:3001/api/docs](http://localhost:3001/api/docs)
