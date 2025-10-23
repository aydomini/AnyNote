-- 密码管理表
-- 存储端到端加密的密码条目
CREATE TABLE IF NOT EXISTS passwords (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  encrypted_site TEXT NOT NULL,      -- 加密的网站名称
  encrypted_username TEXT NOT NULL,  -- 加密的用户名
  encrypted_password TEXT NOT NULL,  -- 加密的密码
  encrypted_recovery TEXT,           -- 加密的恢复密钥（可选）
  encrypted_notes TEXT,              -- 加密的备注（可选）
  iv TEXT NOT NULL,                  -- 初始化向量（AES-GCM 需要）
  auth_tag TEXT,                     -- 认证标签（AES-GCM 需要）
  algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',  -- 加密算法
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,  -- 乐观锁版本号
  is_deleted INTEGER NOT NULL DEFAULT 0,  -- 软删除标记
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_passwords_user_id ON passwords(user_id);
CREATE INDEX IF NOT EXISTS idx_passwords_updated_at ON passwords(updated_at);
CREATE INDEX IF NOT EXISTS idx_passwords_is_deleted ON passwords(is_deleted);
CREATE INDEX IF NOT EXISTS idx_passwords_user_updated ON passwords(user_id, updated_at);
