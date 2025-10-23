-- 添加加密昵称字段（端到端加密）
-- 零知识架构：服务器无法看到昵称明文，只存储加密后的数据
ALTER TABLE users ADD COLUMN encrypted_nickname TEXT DEFAULT NULL;  -- 加密后的昵称
ALTER TABLE users ADD COLUMN nickname_iv TEXT DEFAULT NULL;         -- 加密初始化向量

-- 创建索引（可选，如果后续需要按昵称搜索）
-- 注意：由于昵称是加密的，服务器端无法进行明文搜索
-- CREATE INDEX IF NOT EXISTS idx_users_encrypted_nickname ON users(encrypted_nickname);
