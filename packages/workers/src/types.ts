/**
 * AnyNote Workers 环境绑定类型定义
 */
export interface Env {
  // D1 数据库
  DB: D1Database;

  // KV 存储（用于速率限制）
  RATE_LIMIT: KVNamespace;

  // 环境变量
  ENVIRONMENT: 'development' | 'production';
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';

  // JWT 密钥（生产环境从 secrets 读取）
  JWT_SECRET?: string;
  JWT_EXPIRES_IN: string;

  // CORS 配置
  CORS: {
    ALLOWED_ORIGINS: string;
  };

  // 邀请码（限制注册）
  INVITE_CODE?: string;

  // Cloudflare Turnstile
  TURNSTILE_SECRET_KEY?: string;
}

/**
 * 用户相关类型
 */
export interface User {
  id: string;
  email: string;
  auth_hash: string;
  salt: string;
  encrypted_nickname?: string;  // 加密后的昵称（端到端加密）
  nickname_iv?: string;          // 昵称加密的初始化向量
  created_at: number;
  updated_at: number;
}

export interface CreateUserInput {
  email: string;
  auth_hash: string;
  salt: string;
}

/**
 * 笔记相关类型
 */
export interface Note {
  id: string;
  user_id: string;
  title: string | null;
  encrypted_content: string;
  iv: string;
  auth_tag: string | null;
  algorithm: string;
  created_at: number;
  updated_at: number;
  version: number;
  is_deleted: number;
}

export interface CreateNoteInput {
  title?: string;
  encrypted_content: string;
  iv: string;
  auth_tag?: string;
}

export interface UpdateNoteInput {
  title?: string;
  encrypted_content?: string;
  iv?: string;
  auth_tag?: string;
  version: number;  // 用于乐观锁
}

/**
 * 密码相关类型
 */
export interface Password {
  id: string;
  user_id: string;
  encrypted_site: string;
  encrypted_username: string;
  encrypted_password: string;
  encrypted_recovery: string | null;
  encrypted_notes: string | null;
  iv: string;
  auth_tag: string | null;
  algorithm: string;
  created_at: number;
  updated_at: number;
  version: number;
  is_deleted: number;
}

export interface CreatePasswordInput {
  encrypted_site: string;
  encrypted_username: string;
  encrypted_password: string;
  encrypted_recovery?: string;
  encrypted_notes?: string;
  iv: string;
  auth_tag?: string;
}

export interface UpdatePasswordInput {
  encrypted_site?: string;
  encrypted_username?: string;
  encrypted_password?: string;
  encrypted_recovery?: string;
  encrypted_notes?: string;
  iv?: string;
  auth_tag?: string;
  version: number;
}

/**
 * API 响应类型
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    timestamp: number;
    request_id?: string;
  };
}

/**
 * 分页参数
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * 同步元数据
 */
export interface SyncMetadata {
  id: string;
  user_id: string;
  entity_type: 'notes' | 'passwords';
  entity_id: string;
  last_synced_at: number;
  device_id: string | null;
  checksum: string | null;
}

/**
 * JWT Token Payload
 */
export interface JWTPayload {
  user_id: string;
  email: string;
  jti?: string;  // Session ID（新版 token 包含此字段）
  iat: number;
  exp: number;
}

/**
 * 会话相关类型（多设备登录管理）
 */
export interface Session {
  id: string;                      // session_id (UUID v4)
  user_id: string;                 // 关联用户 ID
  device_id: string;               // 客户端生成的设备 UUID
  device_name: string | null;      // 设备显示名称
  device_type: string | null;      // 设备类型（desktop/mobile/tablet）
  browser_name: string | null;     // 浏览器名称
  os_name: string | null;          // 操作系统
  ip_address: string | null;       // 登录时的 IP 地址
  location: string | null;         // IP 地理位置
  user_agent: string;              // 完整 User-Agent 字符串
  is_active: number;               // 会话是否有效（1=有效，0=已登出）
  created_at: number;              // 登录时间（Unix 毫秒时间戳）
  expires_at: number;              // 过期时间（Unix 毫秒时间戳）
  refresh_token: string | null;    // 🔐 Refresh Token（7天有效期）
}

export interface CreateSessionInput {
  id: string;
  user_id: string;
  device_id: string;
  device_name?: string;
  device_type?: string;
  browser_name?: string;
  os_name?: string;
  ip_address?: string;
  location?: string;
  user_agent: string;
  is_active: boolean;
  created_at: number;
  expires_at: number;
  refresh_token?: string;          // 🔐 Refresh Token（可选）
}

/**
 * 设备信息（从 User-Agent 解析）
 */
export interface DeviceInfo {
  device: {
    type: 'mobile' | 'tablet' | 'desktop' | null;
  };
  browser: {
    name: string;
    version: string;
  };
  os: {
    name: string;
    version: string;
  };
}


/**
 * 审计日志
 */
export interface AuditLog {
  id: string;
  user_id: string | null;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  success: number;
  error_message: string | null;
  created_at: number;
}
