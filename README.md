# AnyNote - 开源后端与加密引擎

> 🔐 零知识加密 | 🛡️ 端到端安全 | ⚡ Cloudflare Workers | 📖 完全开源后端

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)

[English](README_EN.md) | 简体中文

---

## 🔓 开源声明

**AnyNote 部分开源** - 本仓库公开后端 API、端到端加密引擎和安全相关模块，前端 UI 界面保持私有。

### ✅ 开源模块（本仓库包含）

| 模块 | 说明 | 路径 |
|------|------|------|
| 🌐 **后端 API** | Cloudflare Workers + Hono 框架 | `packages/workers/src/` |
| 🔐 **加密引擎** | AES-256-GCM + PBKDF2-SHA256 | `packages/shared/src/crypto/` |
| 🗄️ **数据库结构** | D1 (SQLite) 迁移脚本 | `packages/workers/migrations/` |
| 🛡️ **认证系统** | JWT 双 Token 架构 + 速率限制 | `packages/workers/src/auth/` |
| 📊 **数据访问层** | 笔记、密码、会话、用户仓储 | `packages/workers/src/db/` |
| 🔧 **前端安全工具** | API 客户端、密钥存储、设备指纹 | `packages/web/src/lib/` |
| 🔑 **认证状态管理** | Zustand 认证 Store | `packages/web/src/stores/auth-store.ts` |

---

## 📖 项目简介

AnyNote 是一款基于零知识架构的端到端加密笔记与密码管理应用。本项目采用 Cloudflare Workers 全球分布式边缘计算平台，实现了完整的后端 API、认证系统和数据加密引擎。

**核心特性**：
- ✅ 端到端加密（AES-256-GCM）
- ✅ 零知识架构（主密码永不上传）
- ✅ 设备指纹绑定（防止密钥跨设备复制）
- ✅ JWT 双 Token 架构（Access Token 15分钟 + Refresh Token 7天）
- ✅ IP 全局速率限制（防止暴力破解）
- ✅ Cloudflare Turnstile 人机验证
- ✅ 邀请码机制（限制注册）
- ✅ 多设备会话管理
- ✅ 自动清理过期数据

---

## 🏗️ 技术栈

### 后端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| **Cloudflare Workers** | - | 全球分布式边缘计算平台 |
| **Cloudflare D1** | - | 基于 SQLite 的无服务器数据库 |
| **Cloudflare KV** | - | 键值存储（速率限制） |
| **Hono** | 4.x | 快速轻量的 Web 框架 |
| **TypeScript** | 5.0+ | 类型安全的 JavaScript 超集 |

### 加密与安全

| 技术 | 参数 | 说明 |
|------|------|------|
| **AES-256-GCM** | 256位密钥，12字节随机IV | 对称加密算法 |
| **PBKDF2-SHA256** | 600,000 迭代，32字节盐 | 密钥派生函数 |
| **HKDF-SHA256** | - | 密钥扩展函数（派生3个子密钥） |
| **JWT (HS256)** | Access Token 15分钟 | 用户认证 |
| **JWT (HS256)** | Refresh Token 7天 | Token 刷新 |
| **crypto.getRandomValues()** | - | 浏览器原生 CSPRNG |

### 前端安全工具

| 工具 | 说明 | 文件 |
|------|------|------|
| **API 客户端** | 统一的 API 请求封装 | `packages/web/src/lib/api.ts` |
| **加密引擎封装** | 前端加密工具类 | `packages/web/src/lib/crypto.ts` |
| **设备指纹** | 基于 FingerprintJS | `packages/web/src/lib/device-fingerprint.ts` |
| **密钥存储** | IndexedDB 加密密钥管理 | `packages/web/src/lib/key-storage.ts` |
| **LRU 缓存** | 客户端缓存管理 | `packages/web/src/lib/lru-cache.ts` |
| **密码泄露检测** | HIBP k-匿名协议 | `packages/web/src/lib/pwned-password.ts` |

---

## 🔐 零知识加密架构

### 加密流程

```
用户输入主密码（永不上传）
  ↓
PBKDF2-SHA256（600,000 迭代 + 32字节随机盐）
  ↓
主密钥（Master Key, 256-bit）
  ↓
HKDF-SHA256 派生三个子密钥
  ├─ 加密密钥（Encryption Key）→ AES-256-GCM 加密笔记/密码
  ├─ MAC 密钥（MAC Key）→ 数据完整性验证
  └─ 认证密钥（Auth Key）→ 服务器身份验证（替代主密码）
```

### 数据加密格式

```json
{
  "encrypted_content": "Base64编码的密文",
  "iv": "Base64编码的初始化向量（12字节）",
  "created_at": 1704067200,
  "updated_at": 1704067200
}
```

### 安全保证

| 保证 | 说明 |
|------|------|
| **服务器无法解密** | 主密码和加密密钥永不上传，服务器仅存储密文 |
| **密钥派生安全** | PBKDF2 600,000 迭代（OWASP 推荐），防止暴力破解 |
| **随机 IV** | 每次加密生成新的 12 字节随机 IV，防止重放攻击 |
| **认证分离** | 认证密钥独立派生，即使泄露也无法解密数据 |

---

## 🗄️ 数据库设计

### 核心表结构

#### 用户表（users）

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                -- UUID
  email TEXT UNIQUE NOT NULL,         -- 邮箱（唯一）
  auth_hash TEXT NOT NULL,            -- 认证密钥的哈希（用于登录验证）
  salt TEXT NOT NULL,                 -- PBKDF2 的盐值（32字节，Base64编码）
  nickname TEXT,                      -- 昵称（可选）
  created_at INTEGER NOT NULL,        -- 创建时间（Unix时间戳）
  updated_at INTEGER NOT NULL         -- 更新时间（Unix时间戳）
);
```

#### 笔记表（notes）

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,                -- UUID
  user_id TEXT NOT NULL,              -- 用户 ID（外键）
  title TEXT,                         -- 标题（可选，明文或加密）
  encrypted_content TEXT NOT NULL,    -- 加密后的笔记内容（Base64）
  iv TEXT NOT NULL,                   -- AES-GCM 的初始化向量（12字节，Base64）
  tags TEXT,                          -- 标签（JSON 数组字符串，可选）
  created_at INTEGER NOT NULL,        -- 创建时间（Unix时间戳）
  updated_at INTEGER NOT NULL,        -- 更新时间（Unix时间戳）
  version INTEGER DEFAULT 1,          -- 乐观锁版本号
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 密码表（passwords）

```sql
CREATE TABLE passwords (
  id TEXT PRIMARY KEY,                -- UUID
  user_id TEXT NOT NULL,              -- 用户 ID（外键）
  encrypted_data TEXT NOT NULL,       -- 加密后的密码数据（JSON 格式，包含 site/username/password/notes）
  iv TEXT NOT NULL,                   -- AES-GCM 的初始化向量（12字节，Base64）
  created_at INTEGER NOT NULL,        -- 创建时间（Unix时间戳）
  updated_at INTEGER NOT NULL,        -- 更新时间（Unix时间戳）
  version INTEGER DEFAULT 1,          -- 乐观锁版本号
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 会话表（sessions）

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                -- Session ID (UUID)
  user_id TEXT NOT NULL,              -- 用户 ID（外键）
  refresh_token TEXT NOT NULL,        -- Refresh Token（SHA-256哈希）
  device_fingerprint TEXT,            -- 设备指纹（SHA-256）
  device_info TEXT,                   -- 设备信息（User-Agent 解析结果）
  ip_address TEXT,                    -- IP 地址
  is_active INTEGER DEFAULT 1,        -- 是否活跃（0=已登出，1=活跃）
  last_heartbeat INTEGER,             -- 最后心跳时间（Unix时间戳）
  expires_at INTEGER NOT NULL,        -- 过期时间（Unix时间戳）
  created_at INTEGER NOT NULL,        -- 创建时间（Unix时间戳）
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 邀请码表（invite_codes）

```sql
CREATE TABLE invite_codes (
  id TEXT PRIMARY KEY,                -- UUID
  code TEXT UNIQUE NOT NULL,          -- 邀请码（格式：AnyNote-XXXXX-XXXXX-XXXXX-XXXXX）
  max_uses INTEGER,                   -- 最大使用次数（NULL=无限次）
  used_count INTEGER DEFAULT 0,       -- 已使用次数
  expires_at INTEGER,                 -- 过期时间（Unix时间戳，NULL=永不过期）
  created_by TEXT,                    -- 创建者用户 ID（可选）
  created_at INTEGER NOT NULL,        -- 创建时间（Unix时间戳）
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

完整的数据库结构定义请参考：[`schema/schema.sql`](schema/schema.sql)

---

## 📁 项目结构

```
AnyNote/
├── packages/
│   ├── workers/                    # Cloudflare Workers 后端
│   │   ├── src/
│   │   │   ├── auth/               # 认证模块
│   │   │   │   ├── auth-service.ts           # 认证服务（注册、登录、Token刷新）
│   │   │   │   ├── rate-limiter.ts           # 速率限制器（基于 KV）
│   │   │   │   └── turnstile-verifier.ts     # Turnstile 人机验证
│   │   │   ├── db/                 # 数据访问层
│   │   │   │   ├── note-repository.ts        # 笔记数据访问
│   │   │   │   ├── password-repository.ts    # 密码数据访问
│   │   │   │   ├── session-repository.ts     # 会话数据访问
│   │   │   │   └── user-repository.ts        # 用户数据访问
│   │   │   ├── utils/              # 工具函数
│   │   │   │   ├── helpers.ts                # 通用工具
│   │   │   │   ├── i18n.ts                   # 国际化工具
│   │   │   │   ├── input-validator.ts        # 输入验证
│   │   │   │   ├── quota.ts                  # 配额管理
│   │   │   │   ├── user-agent-parser.ts      # User-Agent 解析
│   │   │   │   └── validation.ts             # 验证工具（统一验证模块）
│   │   │   ├── index.ts            # 主入口文件（API 路由定义）
│   │   │   └── types.ts            # TypeScript 类型定义
│   │   ├── migrations/             # 数据库迁移脚本
│   │   │   ├── 0001_create_users_table.sql
│   │   │   ├── 0002_create_notes_table.sql
│   │   │   ├── 0003_create_passwords_table.sql
│   │   │   ├── 0004_create_sessions_table.sql
│   │   │   ├── 0005_add_refresh_token.sql
│   │   │   ├── 0005_create_invite_codes_table.sql
│   │   │   └── 0006_add_nickname.sql
│   │   ├── package.json            # Workers 依赖清单
│   │   ├── tsconfig.json           # TypeScript 配置
│   │   └── wrangler.toml.example   # Wrangler 示例配置
│   │
│   ├── shared/                     # 共享模块
│   │   └── src/
│   │       └── crypto/
│   │           └── crypto-engine.ts   # 加密引擎核心实现
│   │
│   └── web/                        # 前端（仅包含安全工具）
│       ├── src/
│       │   ├── lib/                # 安全工具库
│       │   │   ├── api.ts                  # API 客户端（统一请求封装）
│       │   │   ├── crypto.ts               # 前端加密封装
│       │   │   ├── device.ts               # 设备标识
│       │   │   ├── device-fingerprint.ts   # 设备指纹（FingerprintJS）
│       │   │   ├── key-storage.ts          # IndexedDB 密钥存储
│       │   │   ├── lru-cache.ts            # LRU 缓存
│       │   │   └── pwned-password.ts       # HIBP 密码泄露检测
│       │   └── stores/
│       │       └── auth-store.ts           # 认证状态管理（Zustand）
│       ├── .env.example            # 前端环境变量示例
│       └── package.json            # 前端依赖清单（仅安全相关）
│
├── schema/
│   └── schema.sql                  # 完整数据库结构定义
│
├── package.json                    # 根 package.json
├── pnpm-workspace.yaml             # pnpm 工作区配置
├── pnpm-lock.yaml                  # 依赖锁定文件
├── LICENSE                         # MIT 许可证
├── README.md                       # 项目说明（中文）
└── README_EN.md                    # 项目说明（英文）
```

---

## 📡 API 接口文档

### 认证接口

| 端点 | 方法 | 说明 | 参数 |
|------|------|------|------|
| `/api/auth/salt/:email` | GET | 获取用户盐值 | `email`: 邮箱 |
| `/api/auth/register` | POST | 用户注册 | `email`, `auth_hash`, `salt`, `invite_code` |
| `/api/auth/login` | POST | 用户登录 | `email`, `auth_hash`, `device_fingerprint` |
| `/api/auth/refresh` | POST | 刷新 Access Token | Header: `Refresh-Token` |
| `/api/auth/logout` | POST | 登出当前会话 | Header: `Authorization` |

### 笔记接口

| 端点 | 方法 | 说明 | 参数 |
|------|------|------|------|
| `/api/notes` | GET | 获取笔记列表（分页） | `page`, `limit`, `search` |
| `/api/notes/:id` | GET | 获取单个笔记 | - |
| `/api/notes` | POST | 创建笔记 | `title`, `encrypted_content`, `iv`, `tags` |
| `/api/notes/:id` | PUT | 更新笔记 | `title`, `encrypted_content`, `iv`, `tags`, `version` |
| `/api/notes/:id` | DELETE | 删除笔记 | - |

### 密码接口

| 端点 | 方法 | 说明 | 参数 |
|------|------|------|------|
| `/api/passwords` | GET | 获取密码列表（分页） | `page`, `limit`, `search` |
| `/api/passwords/:id` | GET | 获取单个密码 | - |
| `/api/passwords` | POST | 创建密码 | `encrypted_data`, `iv` |
| `/api/passwords/:id` | PUT | 更新密码 | `encrypted_data`, `iv`, `version` |
| `/api/passwords/:id` | DELETE | 删除密码 | - |

### 会话管理接口

| 端点 | 方法 | 说明 | 参数 |
|------|------|------|------|
| `/api/sessions` | GET | 获取当前用户所有会话 | - |
| `/api/sessions/heartbeat` | POST | 更新会话心跳 | - |
| `/api/sessions/:id` | DELETE | 登出指定会话 | - |

完整的 API 接口实现请参考：[`packages/workers/src/index.ts`](packages/workers/src/index.ts)

---

## 🔒 安全特性

### 1. 零知识加密

- ✅ 主密码永不上传服务器
- ✅ 所有数据在客户端加密，服务器仅存储密文
- ✅ 服务器无法解密用户数据

### 2. 强加密算法

- ✅ AES-256-GCM 对称加密（NIST 推荐）
- ✅ PBKDF2-SHA256 密钥派生（600,000 迭代，OWASP 推荐）
- ✅ HKDF-SHA256 密钥扩展
- ✅ 随机 IV（每次加密生成新的 12 字节 IV）

### 3. 认证与授权

- ✅ JWT 双 Token 架构（Access Token 15分钟 + Refresh Token 7天）
- ✅ 认证密钥独立派生（与加密密钥分离）
- ✅ Token 自动刷新机制（无感刷新）
- ✅ 会话心跳检测（60秒）

### 4. 速率限制

- ✅ IP 全局速率限制（登录 10次/小时，注册 10次/小时）
- ✅ 用户邮箱速率限制（5次失败封禁 2小时）
- ✅ 笔记/密码保存速率限制（2次/分钟）
- ✅ 基于 Cloudflare KV 实现

### 5. 防攻击机制

- ✅ Cloudflare Turnstile 人机验证
- ✅ 邀请码机制（限制恶意注册）
- ✅ 设备指纹绑定（防止密钥跨设备复制）
- ✅ 自动清理过期会话和邀请码

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 提交 Issue

- 🐛 **Bug 报告**：请提供详细的复现步骤、错误日志和环境信息
- 💡 **功能建议**：请说明需求场景和预期效果
- 🔒 **安全漏洞**：请通过私密渠道联系维护者（见 SECURITY.md）

### 提交 Pull Request

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交变更：`git commit -m "feat: add your feature"`
4. 推送分支：`git push origin feature/your-feature`
5. 创建 Pull Request

**代码规范**：
- 遵循 TypeScript 最佳实践
- 添加必要的注释和类型定义
- 确保所有测试通过
- 遵循 Conventional Commits 规范

---

## 📄 开源协议

本项目采用 [MIT 许可证](LICENSE) 开源。

```
MIT License

Copyright (c) 2025 AnyNote

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## ⚠️ 免责声明

1. **部分开源**：本项目仅开源后端和安全模块，前端 UI 界面不公开
2. **教育用途**：本项目主要用于教育和学习，生产环境使用请自行评估风险
3. **安全审计**：虽然采用了行业标准的加密算法，但未经过专业安全审计
4. **数据安全**：建议定期导出备份，开发者不对数据丢失负责

---

## 📞 联系方式

- **项目主页**：https://github.com/aydomini/AnyNote
- **Issue Tracker**：https://github.com/aydomini/AnyNote/issues
- **安全报告**：请查看 [SECURITY.md](SECURITY.md)（如有）

---

## 🙏 致谢

感谢以下开源项目：

- [Cloudflare Workers](https://workers.cloudflare.com/) - 全球分布式边缘计算平台
- [Hono](https://hono.dev/) - 快速轻量的 Web 框架
- [Zustand](https://zustand-demo.pmnd.rs/) - 轻量级状态管理库
- [FingerprintJS](https://fingerprint.com/) - 设备指纹识别库
- [Have I Been Pwned](https://haveibeenpwned.com/) - 密码泄露检测 API

---

**⭐ 如果本项目对你有帮助，欢迎 Star 支持！**
