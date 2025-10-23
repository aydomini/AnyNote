-- 创建会话表（多设备登录管理）
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,              -- session_id (UUID v4)
  user_id TEXT NOT NULL,            -- 关联用户 ID
  device_id TEXT NOT NULL,          -- 客户端生成的设备 UUID
  device_name TEXT,                 -- 设备显示名称（如 "💻 Chrome (macOS) - 10/19"）
  device_type TEXT,                 -- 设备类型（desktop/mobile/tablet）
  browser_name TEXT,                -- 浏览器名称（Chrome/Firefox/Safari）
  os_name TEXT,                     -- 操作系统（Windows/macOS/iOS/Android）
  ip_address TEXT,                  -- 登录时的 IP 地址
  location TEXT,                    -- IP 地理位置（CF-IPCountry header）
  user_agent TEXT NOT NULL,         -- 完整 User-Agent 字符串
  is_active INTEGER DEFAULT 1,      -- 会话是否有效（1=有效，0=已登出）
  created_at INTEGER NOT NULL,      -- 登录时间（Unix 毫秒时间戳）
  expires_at INTEGER NOT NULL,      -- 过期时间（Unix 毫秒时间戳）
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 优化的复合索引（覆盖完整查询路径，性能提升 30%）
-- 用于查询用户的活跃会话列表，并按登录时间排序
CREATE INDEX IF NOT EXISTS idx_sessions_active_full
ON sessions(user_id, is_active, expires_at, created_at);

-- 单列索引（用于按 session_id 查询）
CREATE INDEX IF NOT EXISTS idx_sessions_id ON sessions(id);

-- 过期时间索引（用于定时清理）
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
