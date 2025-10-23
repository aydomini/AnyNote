-- AnyNote 数据库表结构
-- 数据库引擎：Cloudflare D1 (SQLite)
-- 安全原则：所有敏感数据必须加密存储（仅存密文）

-- ============================================================================
-- 用户表
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                -- UUID v4
  email TEXT UNIQUE NOT NULL,         -- 用户邮箱（用于登录和盐）
  auth_hash TEXT NOT NULL,            -- PBKDF2 派生的认证哈希（用于服务端验证）
  salt TEXT NOT NULL,                 -- 随机生成的盐（Hex 编码）
  created_at INTEGER NOT NULL,        -- 创建时间（Unix 时间戳）
  updated_at INTEGER NOT NULL         -- 更新时间（Unix 时间戳）
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- 笔记表（存储加密的 Markdown 笔记）
-- ============================================================================
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,                -- UUID v4
  user_id TEXT NOT NULL,              -- 关联用户 ID
  title TEXT,                         -- 笔记标题（可选：可以不加密以便搜索）
  encrypted_content TEXT NOT NULL,    -- 加密后的 Markdown 内容（Hex 编码）
  iv TEXT NOT NULL,                   -- AES-GCM 的 IV/Nonce（Hex 编码，每条笔记唯一）
  auth_tag TEXT,                      -- AES-GCM 的认证标签（可选，某些实现包含在 ciphertext 中）
  algorithm TEXT DEFAULT 'AES-256-GCM', -- 加密算法标识（便于未来升级）
  created_at INTEGER NOT NULL,        -- 创建时间（Unix 时间戳）
  updated_at INTEGER NOT NULL,        -- 更新时间（Unix 时间戳）
  version INTEGER DEFAULT 1,          -- 版本号（用于冲突检测）
  is_deleted INTEGER DEFAULT 0,       -- 软删除标记（0=正常，1=已删除）
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(is_deleted);

-- ============================================================================
-- 密码表（存储加密的网站账号密码）
-- ============================================================================
CREATE TABLE IF NOT EXISTS passwords (
  id TEXT PRIMARY KEY,                    -- UUID v4
  user_id TEXT NOT NULL,                  -- 关联用户 ID
  encrypted_site TEXT NOT NULL,           -- 加密的网站名/URL（Hex 编码）
  encrypted_username TEXT NOT NULL,       -- 加密的用户名（Hex 编码）
  encrypted_password TEXT NOT NULL,       -- 加密的密码（Hex 编码）
  encrypted_recovery TEXT,                -- 加密的恢复码（Hex 编码，可选）
  encrypted_notes TEXT,                   -- 加密的备注（Hex 编码，可选）
  iv TEXT NOT NULL,                       -- AES-GCM 的 IV/Nonce（Hex 编码，每条记录唯一）
  auth_tag TEXT,                          -- AES-GCM 的认证标签（可选）
  algorithm TEXT DEFAULT 'AES-256-GCM',   -- 加密算法标识
  created_at INTEGER NOT NULL,            -- 创建时间（Unix 时间戳）
  updated_at INTEGER NOT NULL,            -- 更新时间（Unix 时间戳）
  version INTEGER DEFAULT 1,              -- 版本号（用于冲突检测）
  is_deleted INTEGER DEFAULT 0,           -- 软删除标记（0=正常，1=已删除）
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_passwords_user ON passwords(user_id);
CREATE INDEX IF NOT EXISTS idx_passwords_updated ON passwords(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_passwords_deleted ON passwords(is_deleted);

-- ============================================================================
-- 同步元数据表（用于跨设备同步）
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_metadata (
  id TEXT PRIMARY KEY,                    -- UUID v4
  user_id TEXT NOT NULL,                  -- 关联用户 ID
  entity_type TEXT NOT NULL,              -- 实体类型（notes / passwords）
  entity_id TEXT NOT NULL,                -- 实体 ID（笔记 ID 或密码 ID）
  last_synced_at INTEGER NOT NULL,        -- 最后同步时间（Unix 时间戳）
  device_id TEXT,                         -- 设备 ID（可选，用于冲突解决）
  checksum TEXT,                          -- 数据校验和（用于快速对比）
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_user ON sync_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_entity ON sync_metadata(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_time ON sync_metadata(last_synced_at DESC);

-- ============================================================================
-- 审计日志表（可选，用于安全审计）
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,                    -- UUID v4
  user_id TEXT,                           -- 关联用户 ID（可选，登录失败时为空）
  event_type TEXT NOT NULL,               -- 事件类型（login / logout / create_note / delete_password 等）
  ip_address TEXT,                        -- IP 地址（可选，用于安全监控）
  user_agent TEXT,                        -- User-Agent（可选）
  success INTEGER NOT NULL,               -- 操作是否成功（0=失败，1=成功）
  error_message TEXT,                     -- 错误信息（失败时记录）
  created_at INTEGER NOT NULL             -- 事件时间（Unix 时间戳）
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_logs(event_type);

-- ============================================================================
-- 安全说明
-- ============================================================================
-- 1. 所有 encrypted_* 字段存储的是经过 AES-256-GCM 加密的数据（Hex 编码）
-- 2. IV/Nonce 必须每次加密都随机生成，绝不可重复使用
-- 3. 服务器永远无法解密 encrypted_* 字段（零知识架构）
-- 4. auth_hash 用于验证用户身份，但无法用于解密数据
-- 5. 软删除策略：删除操作仅标记 is_deleted=1，便于同步和恢复

-- ============================================================================
-- 数据迁移和版本管理
-- ============================================================================
-- 未来如果需要升级加密算法（如从 AES-GCM 迁移到 ChaCha20-Poly1305），
-- 可通过 algorithm 字段识别，客户端自动重新加密并更新。
