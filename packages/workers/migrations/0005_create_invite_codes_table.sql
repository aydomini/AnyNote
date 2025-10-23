-- 邀请码管理表
CREATE TABLE IF NOT EXISTS invite_codes (
  id TEXT PRIMARY KEY,                    -- 邀请码 ID（UUID）
  code TEXT UNIQUE NOT NULL,              -- 邀请码（唯一）
  max_uses INTEGER DEFAULT -1,            -- 最大使用次数（-1 表示无限次）
  used_count INTEGER DEFAULT 0,           -- 已使用次数
  expires_at INTEGER,                     -- 过期时间戳（可选，NULL 表示永不过期）
  created_by TEXT,                        -- 创建者用户 ID（可选，站长专用）
  created_at INTEGER NOT NULL,            -- 创建时间戳
  updated_at INTEGER NOT NULL,            -- 更新时间戳
  is_active INTEGER DEFAULT 1,            -- 是否启用（1=启用，0=禁用）
  note TEXT                               -- 备注（可选，如"给朋友用"）
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_active ON invite_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires_at ON invite_codes(expires_at);
