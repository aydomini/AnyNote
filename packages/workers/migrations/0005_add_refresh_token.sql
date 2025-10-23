-- 添加 refresh_token 字段到 sessions 表
-- 用于 Token 刷新机制（Access Token 15分钟 + Refresh Token 7天）
ALTER TABLE sessions ADD COLUMN refresh_token TEXT;

-- 为 refresh_token 创建索引（用于快速查找）
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
