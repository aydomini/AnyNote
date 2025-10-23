# AnyNote - Open Source Backend & Encryption Engine

> 🔐 Zero-Knowledge Encryption | 🛡️ End-to-End Security | ⚡ Cloudflare Workers | 📖 Fully Open-Source Backend

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)

🎭 **[Live Demo](https://aydomini.github.io/AnyNote/)** | English | [简体中文](README.md)

---

## 🔓 Open Source Disclaimer

**AnyNote is Partially Open-Source** - This repository contains the backend API, end-to-end encryption engine, and security-related modules. The frontend UI remains proprietary.

### ✅ Open-Source Modules (Included in This Repository)

| Module | Description | Path |
|--------|-------------|------|
| 🌐 **Backend API** | Cloudflare Workers + Hono Framework | `packages/workers/src/` |
| 🔐 **Encryption Engine** | AES-256-GCM + PBKDF2-SHA256 | `packages/shared/src/crypto/` |
| 🗄️ **Database Schema** | D1 (SQLite) Migration Scripts | `packages/workers/migrations/` |
| 🛡️ **Authentication System** | JWT Dual-Token Architecture + Rate Limiting | `packages/workers/src/auth/` |
| 📊 **Data Access Layer** | Notes, Passwords, Sessions, Users Repositories | `packages/workers/src/db/` |
| 🔧 **Frontend Security Tools** | API Client, Key Storage, Device Fingerprinting | `packages/web/src/lib/` |
| 🔑 **Auth State Management** | Zustand Auth Store | `packages/web/src/stores/auth-store.ts` |

---

## 📖 Project Introduction

AnyNote is an end-to-end encrypted note-taking and password management application based on zero-knowledge architecture. This project uses Cloudflare Workers global distributed edge computing platform to implement a complete backend API, authentication system, and data encryption engine.

**Core Features**:
- ✅ End-to-end encryption (AES-256-GCM)
- ✅ Zero-knowledge architecture (Master password never uploaded)
- ✅ Device fingerprint binding (Prevent key cross-device duplication)
- ✅ JWT dual-token architecture (Access Token 15min + Refresh Token 7days)
- ✅ IP global rate limiting (Prevent brute-force attacks)
- ✅ Cloudflare Turnstile CAPTCHA
- ✅ Invitation code mechanism (Restrict registration)
- ✅ Multi-device session management
- ✅ Automatic cleanup of expired data

---

## 🏗️ Tech Stack

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Cloudflare Workers** | - | Global distributed edge computing platform |
| **Cloudflare D1** | - | Serverless database based on SQLite |
| **Cloudflare KV** | - | Key-value storage (rate limiting) |
| **Hono** | 4.x | Fast and lightweight web framework |
| **TypeScript** | 5.0+ | Type-safe JavaScript superset |

### Encryption & Security

| Technology | Parameters | Description |
|------------|------------|-------------|
| **AES-256-GCM** | 256-bit key, 12-byte random IV | Symmetric encryption algorithm |
| **PBKDF2-SHA256** | 600,000 iterations, 32-byte salt | Key derivation function |
| **HKDF-SHA256** | - | Key expansion function (derive 3 sub-keys) |
| **JWT (HS256)** | Access Token 15min | User authentication |
| **JWT (HS256)** | Refresh Token 7days | Token refresh |
| **crypto.getRandomValues()** | - | Browser native CSPRNG |

### Frontend Security Tools

| Tool | Description | File |
|------|-------------|------|
| **API Client** | Unified API request wrapper | `packages/web/src/lib/api.ts` |
| **Encryption Wrapper** | Frontend encryption utility | `packages/web/src/lib/crypto.ts` |
| **Device Fingerprint** | Based on FingerprintJS | `packages/web/src/lib/device-fingerprint.ts` |
| **Key Storage** | IndexedDB encrypted key management | `packages/web/src/lib/key-storage.ts` |
| **LRU Cache** | Client-side cache management | `packages/web/src/lib/lru-cache.ts` |
| **Password Leak Detection** | HIBP k-anonymity protocol | `packages/web/src/lib/pwned-password.ts` |

---

## 🔐 Zero-Knowledge Encryption Architecture

### Encryption Flow

```
User inputs master password (never uploaded)
  ↓
PBKDF2-SHA256 (600,000 iterations + 32-byte random salt)
  ↓
Master Key (256-bit)
  ↓
HKDF-SHA256 derives three sub-keys
  ├─ Encryption Key → AES-256-GCM encrypts notes/passwords
  ├─ MAC Key → Data integrity verification
  └─ Auth Key → Server authentication (replaces master password)
```

### Data Encryption Format

```json
{
  "encrypted_content": "Base64-encoded ciphertext",
  "iv": "Base64-encoded initialization vector (12 bytes)",
  "created_at": 1704067200,
  "updated_at": 1704067200
}
```

### Security Guarantees

| Guarantee | Description |
|-----------|-------------|
| **Server Cannot Decrypt** | Master password and encryption key never uploaded, server stores only ciphertext |
| **Key Derivation Security** | PBKDF2 600,000 iterations (OWASP recommended), prevents brute-force attacks |
| **Random IV** | New 12-byte random IV generated for each encryption, prevents replay attacks |
| **Authentication Separation** | Auth key independently derived, cannot decrypt data even if leaked |

---

## 🗄️ Database Design

### Core Table Structures

#### Users Table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                -- UUID
  email TEXT UNIQUE NOT NULL,         -- Email (unique)
  auth_hash TEXT NOT NULL,            -- Auth key hash (for login verification)
  salt TEXT NOT NULL,                 -- PBKDF2 salt (32 bytes, Base64)
  nickname TEXT,                      -- Nickname (optional)
  created_at INTEGER NOT NULL,        -- Creation timestamp (Unix)
  updated_at INTEGER NOT NULL         -- Update timestamp (Unix)
);
```

#### Notes Table

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,                -- UUID
  user_id TEXT NOT NULL,              -- User ID (foreign key)
  title TEXT,                         -- Title (optional, plaintext or encrypted)
  encrypted_content TEXT NOT NULL,    -- Encrypted note content (Base64)
  iv TEXT NOT NULL,                   -- AES-GCM IV (12 bytes, Base64)
  tags TEXT,                          -- Tags (JSON array string, optional)
  created_at INTEGER NOT NULL,        -- Creation timestamp (Unix)
  updated_at INTEGER NOT NULL,        -- Update timestamp (Unix)
  version INTEGER DEFAULT 1,          -- Optimistic lock version
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Passwords Table

```sql
CREATE TABLE passwords (
  id TEXT PRIMARY KEY,                -- UUID
  user_id TEXT NOT NULL,              -- User ID (foreign key)
  encrypted_data TEXT NOT NULL,       -- Encrypted password data (JSON format)
  iv TEXT NOT NULL,                   -- AES-GCM IV (12 bytes, Base64)
  created_at INTEGER NOT NULL,        -- Creation timestamp (Unix)
  updated_at INTEGER NOT NULL,        -- Update timestamp (Unix)
  version INTEGER DEFAULT 1,          -- Optimistic lock version
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Sessions Table

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                -- Session ID (UUID)
  user_id TEXT NOT NULL,              -- User ID (foreign key)
  refresh_token TEXT NOT NULL,        -- Refresh Token (SHA-256 hash)
  device_fingerprint TEXT,            -- Device fingerprint (SHA-256)
  device_info TEXT,                   -- Device info (User-Agent parsed)
  ip_address TEXT,                    -- IP address
  is_active INTEGER DEFAULT 1,        -- Active status (0=logged out, 1=active)
  last_heartbeat INTEGER,             -- Last heartbeat timestamp (Unix)
  expires_at INTEGER NOT NULL,        -- Expiration timestamp (Unix)
  created_at INTEGER NOT NULL,        -- Creation timestamp (Unix)
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Invite Codes Table

```sql
CREATE TABLE invite_codes (
  id TEXT PRIMARY KEY,                -- UUID
  code TEXT UNIQUE NOT NULL,          -- Invite code (format: AnyNote-XXXXX-XXXXX-XXXXX-XXXXX)
  max_uses INTEGER,                   -- Max uses (NULL=unlimited)
  used_count INTEGER DEFAULT 0,       -- Used count
  expires_at INTEGER,                 -- Expiration timestamp (NULL=never expires)
  created_by TEXT,                    -- Creator user ID (optional)
  created_at INTEGER NOT NULL,        -- Creation timestamp (Unix)
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

Complete database schema: [`schema/schema.sql`](schema/schema.sql)

---

## 📁 Project Structure

```
AnyNote/
├── packages/
│   ├── workers/                    # Cloudflare Workers Backend
│   │   ├── src/
│   │   │   ├── auth/               # Authentication Module
│   │   │   │   ├── auth-service.ts           # Auth service (register, login, token refresh)
│   │   │   │   ├── rate-limiter.ts           # Rate limiter (KV-based)
│   │   │   │   └── turnstile-verifier.ts     # Turnstile CAPTCHA verification
│   │   │   ├── db/                 # Data Access Layer
│   │   │   │   ├── note-repository.ts        # Notes data access
│   │   │   │   ├── password-repository.ts    # Passwords data access
│   │   │   │   ├── session-repository.ts     # Sessions data access
│   │   │   │   └── user-repository.ts        # Users data access
│   │   │   ├── utils/              # Utility Functions
│   │   │   │   ├── helpers.ts                # Common utilities
│   │   │   │   ├── i18n.ts                   # Internationalization utilities
│   │   │   │   ├── input-validator.ts        # Input validation
│   │   │   │   ├── quota.ts                  # Quota management
│   │   │   │   ├── user-agent-parser.ts      # User-Agent parsing
│   │   │   │   └── validation.ts             # Validation utilities (unified)
│   │   │   ├── index.ts            # Main entry point (API routes)
│   │   │   └── types.ts            # TypeScript type definitions
│   │   ├── migrations/             # Database Migration Scripts
│   │   │   ├── 0001_create_users_table.sql
│   │   │   ├── 0002_create_notes_table.sql
│   │   │   ├── 0003_create_passwords_table.sql
│   │   │   ├── 0004_create_sessions_table.sql
│   │   │   ├── 0005_add_refresh_token.sql
│   │   │   ├── 0005_create_invite_codes_table.sql
│   │   │   └── 0006_add_nickname.sql
│   │   ├── package.json            # Workers dependencies
│   │   ├── tsconfig.json           # TypeScript configuration
│   │   └── wrangler.toml.example   # Wrangler example configuration
│   │
│   ├── shared/                     # Shared Modules
│   │   └── src/
│   │       └── crypto/
│   │           └── crypto-engine.ts   # Core encryption engine
│   │
│   └── web/                        # Frontend (Security tools only)
│       ├── src/
│       │   ├── lib/                # Security Tooling Library
│       │   │   ├── api.ts                  # API client (unified request wrapper)
│       │   │   ├── crypto.ts               # Frontend encryption wrapper
│       │   │   ├── device.ts               # Device identification
│       │   │   ├── device-fingerprint.ts   # Device fingerprinting (FingerprintJS)
│       │   │   ├── key-storage.ts          # IndexedDB key storage
│       │   │   ├── lru-cache.ts            # LRU cache
│       │   │   └── pwned-password.ts       # HIBP password leak detection
│       │   └── stores/
│       │       └── auth-store.ts           # Auth state management (Zustand)
│       ├── .env.example            # Frontend environment variables example
│       └── package.json            # Frontend dependencies (security-related only)
│
├── schema/
│   └── schema.sql                  # Complete database schema definition
│
├── package.json                    # Root package.json
├── pnpm-workspace.yaml             # pnpm workspace configuration
├── pnpm-lock.yaml                  # Dependency lock file
├── LICENSE                         # MIT License
├── README.md                       # Project README (Chinese)
└── README_EN.md                    # Project README (English)
```

---

## 📡 API Documentation

### Authentication Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/api/auth/salt/:email` | GET | Get user salt | `email`: Email address |
| `/api/auth/register` | POST | User registration | `email`, `auth_hash`, `salt`, `invite_code` |
| `/api/auth/login` | POST | User login | `email`, `auth_hash`, `device_fingerprint` |
| `/api/auth/refresh` | POST | Refresh Access Token | Header: `Refresh-Token` |
| `/api/auth/logout` | POST | Logout current session | Header: `Authorization` |

### Notes Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/api/notes` | GET | Get notes list (paginated) | `page`, `limit`, `search` |
| `/api/notes/:id` | GET | Get single note | - |
| `/api/notes` | POST | Create note | `title`, `encrypted_content`, `iv`, `tags` |
| `/api/notes/:id` | PUT | Update note | `title`, `encrypted_content`, `iv`, `tags`, `version` |
| `/api/notes/:id` | DELETE | Delete note | - |

### Passwords Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/api/passwords` | GET | Get passwords list (paginated) | `page`, `limit`, `search` |
| `/api/passwords/:id` | GET | Get single password | - |
| `/api/passwords` | POST | Create password | `encrypted_data`, `iv` |
| `/api/passwords/:id` | PUT | Update password | `encrypted_data`, `iv`, `version` |
| `/api/passwords/:id` | DELETE | Delete password | - |

### Session Management Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/api/sessions` | GET | Get all sessions of current user | - |
| `/api/sessions/heartbeat` | POST | Update session heartbeat | - |
| `/api/sessions/:id` | DELETE | Logout specified session | - |

Complete API implementation: [`packages/workers/src/index.ts`](packages/workers/src/index.ts)

---

## 🔒 Security Features

### 1. Zero-Knowledge Encryption

- ✅ Master password never uploaded to server
- ✅ All data encrypted on client-side, server stores only ciphertext
- ✅ Server cannot decrypt user data

### 2. Strong Encryption Algorithms

- ✅ AES-256-GCM symmetric encryption (NIST recommended)
- ✅ PBKDF2-SHA256 key derivation (600,000 iterations, OWASP recommended)
- ✅ HKDF-SHA256 key expansion
- ✅ Random IV (new 12-byte IV generated for each encryption)

### 3. Authentication & Authorization

- ✅ JWT dual-token architecture (Access Token 15min + Refresh Token 7days)
- ✅ Independent auth key derivation (separated from encryption key)
- ✅ Automatic token refresh mechanism (seamless refresh)
- ✅ Session heartbeat detection (60 seconds)

### 4. Rate Limiting

- ✅ IP global rate limiting (login 10 times/hour, registration 10 times/hour)
- ✅ User email rate limiting (5 failures ban for 2 hours)
- ✅ Note/password save rate limiting (2 times/minute)
- ✅ Implemented with Cloudflare KV

### 5. Anti-Attack Mechanisms

- ✅ Cloudflare Turnstile CAPTCHA
- ✅ Invitation code mechanism (restrict malicious registration)
- ✅ Device fingerprint binding (prevent key cross-device duplication)
- ✅ Automatic cleanup of expired sessions and invitation codes

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

### Submit Issue

- 🐛 **Bug Report**: Please provide detailed reproduction steps, error logs, and environment information
- 💡 **Feature Request**: Please describe requirement scenarios and expected effects
- 🔒 **Security Vulnerability**: Please contact maintainers through private channels (see SECURITY.md)

### Submit Pull Request

1. Fork this repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "feat: add your feature"`
4. Push branch: `git push origin feature/your-feature`
5. Create Pull Request

**Code Standards**:
- Follow TypeScript best practices
- Add necessary comments and type definitions
- Ensure all tests pass
- Follow Conventional Commits specification

---

## 📄 License

This project is licensed under the [MIT License](LICENSE). See the [LICENSE](LICENSE) file for details.

---

## ⚠️ Disclaimer

1. **Partially Open-Source**: This project only open-sources backend and security modules, frontend UI is not public
2. **Educational Purpose**: This project is mainly for education and learning, evaluate risks before production use
3. **Security Audit**: Although using industry-standard encryption algorithms, not professionally audited
4. **Data Security**: Recommend regular backups, developers not responsible for data loss

---

## 📞 Contact

- **Project Homepage**: https://github.com/aydomini/AnyNote
- **Issue Tracker**: https://github.com/aydomini/AnyNote/issues
- **Security Report**: Please see [SECURITY.md](SECURITY.md) (if available)

---

## 🙏 Acknowledgements

Thanks to the following open-source projects:

- [Cloudflare Workers](https://workers.cloudflare.com/) - Global distributed edge computing platform
- [Hono](https://hono.dev/) - Fast and lightweight web framework
- [Zustand](https://zustand-demo.pmnd.rs/) - Lightweight state management library
- [FingerprintJS](https://fingerprint.com/) - Device fingerprinting library
- [Have I Been Pwned](https://haveibeenpwned.com/) - Password leak detection API

---

**⭐ If this project helps you, please Star to support!**
