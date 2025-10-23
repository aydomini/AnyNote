-- 笔记表
-- 存储端到端加密的笔记内容
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,                    -- 可选的笔记标题（可能为明文或加密）
  encrypted_content TEXT NOT NULL,  -- 加密后的笔记内容
  iv TEXT NOT NULL,                 -- 初始化向量（AES-GCM 需要）
  auth_tag TEXT,                    -- 认证标签（AES-GCM 需要）
  algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',  -- 加密算法
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,  -- 乐观锁版本号
  is_deleted INTEGER NOT NULL DEFAULT 0,  -- 软删除标记
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes(is_deleted);
CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at);
