# PakVerse Backend API

> **Production-grade NestJS backend** for the PakVerse Portal — Pakistan's multi-vertical community platform.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ LTS
- Docker Desktop (for PostgreSQL + Redis)
- Cloudinary account (free tier)

### 1. Setup environment
```bash
cp .env.example .env
# Edit .env with your Cloudinary credentials
```

### 2. Start infrastructure
```bash
docker-compose up postgres redis -d
```

### 3. Install & migrate
```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
```

### 4. Start development server
```bash
npm run start:dev
```

### 5. Open API docs
```
http://localhost:3001/api/docs
```

---

## 📡 API Base URL

```
http://localhost:3001/api/v1
```

## 🔐 Auth

All protected endpoints require `Authorization: Bearer <accessToken>` header.

Refresh tokens are set as `httpOnly` cookies automatically on login/signup.

---

## 🗂️ Modules

| Module | Endpoints | Auth |
|--------|-----------|------|
| Auth | `/auth/*` | Public + Protected |
| Users | `/users/*` | Protected |
| Shops | `/shops/*` | Public + Protected |
| Education | `/education/*` | Public + Protected |
| Feed | `/feed/*` | Public + Protected |
| Marketplace | `/marketplace/*` | Public + Protected |
| Hospital | `/hospital/*` | Public + Protected |
| Notifications | `/notifications/*` | Protected |
| Upload | `/upload/*` | Protected |
| Health | `/health` | Public |

---

## 🏗️ Tech Stack

- **Framework**: NestJS 10 + TypeScript
- **Database**: PostgreSQL 16 (Prisma ORM)
- **Auth**: JWT (access 15m + refresh 7d, httpOnly cookies)
- **File Storage**: Cloudinary
- **Email**: Ethereal (dev) / SendGrid (prod)
- **Cache**: Redis
- **Real-time**: Socket.IO WebSockets
- **Containerization**: Docker + Docker Compose

---

## 🔒 Security

- bcrypt with 12 salt rounds
- JWT refresh token rotation (hash stored in DB)
- Helmet security headers
- Global rate limiting (100 req/min)
- Strict ValidationPipe (whitelist + forbidNonWhitelisted)
- CORS restricted to frontend URL
- SQL injection immune (Prisma parameterized queries)
- XSS protection via input validation
- File MIME type + size validation

---

## 🐳 Docker (Production)

```bash
docker-compose up --build
```

---

## 📚 Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Development server with hot reload |
| `npm run build` | Build for production |
| `npm run start:prod` | Run production build |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:seed` | Seed database with sample data |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:cov` | Test coverage report |

---

## 📧 Test Credentials (after seeding)

```
Admin: admin@pakverse.pk / Admin@PakVerse123
User:  hammad@pakverse.pk / User@Test123
```

---

*PakVerse Portal Backend — Built with ❤️ for Pakistan 🇵🇰*
