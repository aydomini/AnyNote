-- 用户表
-- 存储用户认证信息（零知识架构，服务器不存储主密码）
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  auth_hash TEXT NOT NULL,  -- 认证哈希（由主密码派生，用于验证）
  salt TEXT NOT NULL,       -- 盐值（用于客户端密钥派生）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
