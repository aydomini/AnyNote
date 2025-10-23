import { Hono } from 'hono';
import type { Env } from './types';
import { AuthService } from './auth/auth-service';
import { RateLimiter } from './auth/rate-limiter';
import { TurnstileVerifier } from './auth/turnstile-verifier';
import { NoteRepository } from './db/note-repository';
import { PasswordRepository } from './db/password-repository';
import { SessionRepository } from './db/session-repository';
import { parseUserAgent, generateDeviceName } from './utils/user-agent-parser';
import {
  getCurrentTimestamp,
  signJWT,
  verifyJWT,
} from './utils/helpers';
import {
  ValidationError,
  validateEmail,
  validateAuthCredentials,
  validateInviteCode,
  validateNoteInput,
  validatePasswordInput,
  validateSearchKeyword,
} from './utils/validation';
import { parseLanguage } from './utils/i18n';
import { QuotaError, checkNotesQuota, checkPasswordsQuota } from './utils/quota';

const app = new Hono();

// CORS 中间件
app.use('/*', async (c, next) => {
  const env = c.env as Env;
  const allowedOrigins = env.CORS.ALLOWED_ORIGINS || 'http://localhost:5173';
  const origin = c.req.header('Origin') || '';

  if (allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Password');
  }

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  return next();
});

// CSP 安全头中间件
app.use('/*', async (c, next) => {
  await next();

  // 🔐 安全增强：优化 CSP 策略（移除 unsafe-eval，添加 KaTeX CDN）
  c.header(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com", // 移除 unsafe-eval
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net", // KaTeX 样式
      "img-src 'self' data: https:",
      "font-src 'self' data: https://cdn.jsdelivr.net", // KaTeX 字体
      "connect-src 'self' https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );

  // 添加其他安全头
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
});

// 认证中间件（含会话验证和老 token 兼容）
const authMiddleware = async (c: any, next: any) => {
  const env = c.env as Env;
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
    }, 401);
  }

  const token = authHeader.substring(7);
  const authService = new AuthService(env);

  try {
    // 1. 验证 JWT 签名和过期时间
    const user = await authService.verifyToken(token);

    // 解析 JWT payload 以获取 jti
    const jwtSecret = env.JWT_SECRET || 'default-secret-change-in-production';
    const payload = await verifyJWT(token, jwtSecret);

    // 2. 提取 session_id
    const sessionId = payload.jti;
    const sessionRepo = new SessionRepository(env.DB);

    if (!sessionId) {
      // ============================================================================
      // 老 token 兼容性：自动创建临时 session
      // ============================================================================
      const legacySessionId = `legacy-${payload.user_id}-${payload.exp}`;
      let session = await sessionRepo.findById(legacySessionId);

      if (!session) {
        // 为老 token 创建临时会话
        const userAgent = c.req.header('User-Agent') || '';
        const deviceInfo = parseUserAgent(userAgent);

        await sessionRepo.create({
          id: legacySessionId,
          user_id: payload.user_id,
          device_id: 'legacy-device',
          device_name: `💻 旧设备（自动迁移） - ${new Date().toLocaleDateString('zh-CN')}`,
          device_type: deviceInfo.device.type || 'desktop',
          browser_name: deviceInfo.browser.name,
          os_name: deviceInfo.os.name,
          ip_address: c.req.header('CF-Connecting-IP') || '',
          location: c.req.header('CF-IPCountry') || '',
          user_agent: userAgent,
          is_active: true,
          created_at: Date.now(),
          expires_at: payload.exp * 1000,  // JWT exp 是秒，转为毫秒
        });

        console.log(`为老 token 创建临时会话: ${legacySessionId}`);
      }

      c.set('user', user);
      c.set('sessionId', legacySessionId);
      c.set('isLegacyToken', true);
      return next();
    }

    // 3. 查询 D1 验证会话
    const session = await sessionRepo.findById(sessionId);

    if (!session || session.is_active !== 1 || session.expires_at < Date.now()) {
      return c.json({
        success: false,
        error: { code: 'SESSION_INVALID', message: '会话已失效或被登出' },
      }, 401);
    }

    // 4. 设置用户信息和会话 ID
    c.set('user', user);
    c.set('sessionId', sessionId);
    return next();
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    }, 401);
  }
};

// ============================================================================
// 认证路由
// ============================================================================

/**
 * 获取盐值（登录前）
 * POST /api/auth/salt
 */
app.post('/api/auth/salt', async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email is required' },
      }, 400);
    }

    const authService = new AuthService(c.env);
    const salt = await authService.getSalt(email);

    return c.json({ success: true, data: { salt } });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    }, 500);
  }
});

/**
 * 用户注册
 * POST /api/auth/register
 */
app.post('/api/auth/register', async (c) => {
  try {
    const { email, auth_hash, salt, invite_code, turnstile_token } = await c.req.json();

    // 解析语言
    const lang = parseLanguage(c.req.header('Accept-Language'));

    // ============================================================================
    // 🔐 输入验证（后端安全防线）
    // ============================================================================
    try {
      // 验证邮箱
      validateEmail(email, lang);

      // 验证认证凭据
      validateAuthCredentials(auth_hash, salt, lang);

      // 验证邀请码（格式 + 长度）
      validateInviteCode(invite_code, lang);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return c.json({
          success: false,
          error: { code: error.code, message: error.message },
        }, 400);
      }
      throw error; // 重新抛出非验证错误
    }

    // 🔐 安全增强：IP 全局速率限制检查（防止批量注册）
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '0.0.0.0';
    const rateLimiter = new RateLimiter(c.env);

    // 检查 IP 全局限制（1小时内最多10次注册尝试）
    const ipRateCheck = await rateLimiter.checkIPRateLimit(clientIP);
    if (!ipRateCheck.allowed) {
      return c.json({
        success: false,
        error: {
          code: 'IP_RATE_LIMIT',
          message: `注册尝试过于频繁，请在 ${Math.ceil((ipRateCheck.waitSeconds || 0) / 60)} 分钟后重试`,
        },
      }, 429);
    }

    // 记录本次 IP 尝试
    await rateLimiter.recordIPAttempt(clientIP);

    // 验证 Turnstile token
    if (turnstile_token) {
      const turnstileVerifier = new TurnstileVerifier(c.env);
      const remoteip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
      const verifyResult = await turnstileVerifier.verify(turnstile_token, remoteip);

      if (!verifyResult.success) {
        return c.json({
          success: false,
          error: { code: 'TURNSTILE_FAILED', message: verifyResult.error || '人机验证失败' },
        }, 400);
      }
    }

    // 验证邀请码（优先使用数据库中的邀请码系统，如果数据库无邀请码则使用环境变量）
    if (!invite_code) {
      return c.json({
        success: false,
        error: { code: 'INVITE_CODE_REQUIRED', message: '请输入邀请码' },
      }, 400);
    }

    // 查询数据库中的邀请码
    const inviteCodeRecord = await c.env.DB.prepare(
      'SELECT * FROM invite_codes WHERE code = ? AND is_active = 1'
    ).bind(invite_code).first();

    if (inviteCodeRecord) {
      // 检查是否过期
      if (inviteCodeRecord.expires_at && inviteCodeRecord.expires_at < Date.now()) {
        return c.json({
          success: false,
          error: { code: 'INVITE_CODE_EXPIRED', message: '邀请码已过期' },
        }, 403);
      }

      // 检查使用次数限制
      if (inviteCodeRecord.max_uses !== -1 && inviteCodeRecord.used_count >= inviteCodeRecord.max_uses) {
        return c.json({
          success: false,
          error: { code: 'INVITE_CODE_EXHAUSTED', message: '邀请码使用次数已达上限' },
        }, 403);
      }

      // 更新使用次数
      await c.env.DB.prepare(
        'UPDATE invite_codes SET used_count = used_count + 1, updated_at = ? WHERE id = ?'
      ).bind(Date.now(), inviteCodeRecord.id).run();
    } else {
      // 如果数据库中没有，检查环境变量（向后兼容）
      const requiredInviteCode = c.env.INVITE_CODE;
      if (!requiredInviteCode || invite_code !== requiredInviteCode) {
        return c.json({
          success: false,
          error: { code: 'INVITE_CODE_INVALID', message: '邀请码无效或已过期' },
        }, 403);
      }
    }

    const authService = new AuthService(c.env);
    const result = await authService.register(email, auth_hash, salt);

    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: error.message },
    }, 400);
  }
});

/**
 * 用户登录（含多设备管理）
 * POST /api/auth/login
 */
app.post('/api/auth/login', async (c) => {
  try {
    const { email, auth_hash, device_id, device_name, turnstile_token } = await c.req.json();

    if (!email || !auth_hash) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and auth_hash are required' },
      }, 400);
    }

    // device_id 是可选的，如果未提供则生成一个临时 ID
    const finalDeviceId = device_id || crypto.randomUUID();

    // 验证 Turnstile token
    if (turnstile_token) {
      const turnstileVerifier = new TurnstileVerifier(c.env);
      const remoteip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
      const verifyResult = await turnstileVerifier.verify(turnstile_token, remoteip);

      if (!verifyResult.success) {
        return c.json({
          success: false,
          error: { code: 'TURNSTILE_FAILED', message: verifyResult.error || '人机验证失败' },
        }, 400);
      }
    }

    // 🔐 安全增强：IP 全局速率限制检查
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '0.0.0.0';
    const rateLimiter = new RateLimiter(c.env);

    // 1. 检查 IP 全局限制（1小时内最多10次尝试）
    const ipRateCheck = await rateLimiter.checkIPRateLimit(clientIP);
    if (!ipRateCheck.allowed) {
      return c.json({
        success: false,
        error: {
          code: 'IP_RATE_LIMIT',
          message: `登录尝试过于频繁，请在 ${Math.ceil((ipRateCheck.waitSeconds || 0) / 60)} 分钟后重试`,
        },
      }, 429);
    }

    // 2. 检查邮箱速率限制（5次失败封禁2小时）
    const rateCheck = await rateLimiter.checkRateLimit(email);

    if (!rateCheck.allowed) {
      if (rateCheck.reason === 'ACCOUNT_BANNED') {
        return c.json({
          success: false,
          error: {
            code: 'ACCOUNT_BANNED',
            message: `账号已被封禁，请在 ${Math.ceil((rateCheck.waitSeconds || 0) / 60)} 分钟后重试`,
          },
        }, 429);
      } else {
        return c.json({
          success: false,
          error: {
            code: 'TOO_FREQUENT',
            message: `请等待 ${rateCheck.waitSeconds} 秒后重试`,
          },
        }, 429);
      }
    }

    const authService = new AuthService(c.env);

    // 🔐 安全增强：记录 IP 尝试（无论成功失败）
    await rateLimiter.recordIPAttempt(clientIP);

    try {
      // 验证用户凭据（但不直接使用返回的 token，因为我们需要添加 jti）
      const authResult = await authService.login(email, auth_hash);
      const user = authResult.user;

      // 登录成功，清除失败记录
      await rateLimiter.recordSuccess(email);

      // ============================================================================
      // 多设备登录管理
      // ============================================================================

      const sessionRepo = new SessionRepository(c.env.DB);
      const maxDevices = 3;  // 默认最多 3 个设备

      // 1. 检查当前活跃会话数
      const activeSessions = await sessionRepo.findActive(user.id);

      // 2. 如果超限，踢出最老设备（并发安全）
      if (activeSessions.length >= maxDevices) {
        const revokedSession = await sessionRepo.revokeOldestSession(user.id);
        if (revokedSession) {
          console.log(`用户 ${user.id} 设备数超限，已踢出最老设备: ${revokedSession.id} (${revokedSession.device_name})`);
        }
      }

      // 3. 解析设备信息
      const userAgent = c.req.header('User-Agent') || '';
      const deviceInfo = parseUserAgent(userAgent);
      const ip = c.req.header('CF-Connecting-IP') || '';
      const location = c.req.header('CF-IPCountry') || '';

      // 生成友好的设备名称（如果客户端未提供）
      const finalDeviceName = device_name || generateDeviceName(deviceInfo);

      // 4. 创建新会话
      const sessionId = crypto.randomUUID();
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;  // 7天

      // 🔐 安全增强：生成 Refresh Token（7天有效期）
      const refreshToken = crypto.randomUUID() + '-' + crypto.randomUUID(); // 双 UUID 拼接，更长更安全

      await sessionRepo.create({
        id: sessionId,
        user_id: user.id,
        device_id: finalDeviceId,
        device_name: finalDeviceName,
        device_type: deviceInfo.device.type || 'desktop',
        browser_name: deviceInfo.browser.name,
        os_name: deviceInfo.os.name,
        ip_address: ip,
        location: location,
        user_agent: userAgent,
        is_active: true,
        created_at: Date.now(),
        expires_at: expiresAt,
        refresh_token: refreshToken, // 保存 Refresh Token
      });

      // 5. 🔐 安全增强：生成双 Token
      // Access Token（15分钟有效期）- 用于 API 调用
      const accessToken = await signJWT(
        {
          user_id: user.id,
          email: user.email,
          jti: sessionId,  // 关联会话 ID
        },
        c.env.JWT_SECRET!,
        '15m' // 15分钟
      );

      return c.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            encrypted_nickname: user.encrypted_nickname,  // 🔐 端到端加密的昵称
            nickname_iv: user.nickname_iv,                // 🔐 昵称加密的初始化向量
          },
          token: accessToken,          // 🔐 Access Token（15分钟）
          refresh_token: refreshToken,  // 🔐 Refresh Token（7天）
          expires_in: 15 * 60,          // Access Token 过期时间（秒）
        }
      });
    } catch (loginError: any) {
      // 登录失败，记录失败次数
      await rateLimiter.recordFailure(email);

      return c.json({
        success: false,
        error: { code: 'LOGIN_FAILED', message: loginError.message },
      }, 401);
    }
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    }, 500);
  }
});

/**
 * 当前设备登出
 * POST /api/auth/logout
 */
app.post('/api/auth/logout', authMiddleware, async (c) => {
  try {
    const sessionId = c.get('sessionId');

    if (!sessionId) {
      return c.json({
        success: false,
        error: { code: 'NO_SESSION', message: '未找到会话信息' },
      }, 400);
    }

    // 撤销会话
    const sessionRepo = new SessionRepository(c.env.DB);
    await sessionRepo.revoke(sessionId);

    return c.json({
      success: true,
      data: { message: '登出成功' }
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'LOGOUT_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 🔐 安全增强：刷新 Access Token
 * POST /api/auth/refresh
 */
app.post('/api/auth/refresh', async (c) => {
  try {
    const { refresh_token } = await c.req.json();

    if (!refresh_token) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Refresh token is required' },
      }, 400);
    }

    // 1. 查找会话
    const sessionRepo = new SessionRepository(c.env.DB);
    const session = await sessionRepo.findByRefreshToken(refresh_token);

    if (!session) {
      return c.json({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token 无效或已过期' },
      }, 401);
    }

    // 2. 生成新的 Access Token
    const accessToken = await signJWT(
      {
        user_id: session.user_id,
        email: '', // 从 session 中无法直接获取 email，但不影响使用
        jti: session.id,
      },
      c.env.JWT_SECRET!,
      '15m' // 15分钟
    );

    return c.json({
      success: true,
      data: {
        token: accessToken,
        expires_in: 15 * 60, // 15分钟（秒）
      }
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'REFRESH_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 心跳检测（用于检测会话是否有效）
 * GET /api/auth/heartbeat
 */
app.get('/api/auth/heartbeat', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const sessionId = c.get('sessionId');

    return c.json({
      success: true,
      data: {
        user_id: user.id,
        session_id: sessionId,
        timestamp: getCurrentTimestamp(),
      },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'HEARTBEAT_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 更新用户昵称（端到端加密）
 * PUT /api/users/nickname
 *
 * 零知识架构：昵称在客户端加密后上传，服务器只存储密文
 * 速率限制：每小时最多 10 次修改（防止滥用攻击）
 */
app.put('/api/users/nickname', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { encrypted_nickname, nickname_iv } = await c.req.json();

    // 解析语言
    const lang = parseLanguage(c.req.header('Accept-Language'));

    // 🛡️ 速率限制检查（防止恶意修改）
    const rateLimitKey = `nickname_update:${user.user_id}`;
    const rateLimitData = await c.env.RATE_LIMIT.get(rateLimitKey);

    if (rateLimitData) {
      const { count, resetTime } = JSON.parse(rateLimitData);
      const now = Date.now();

      // 如果在冷却期内且已超过限制
      if (now < resetTime && count >= 10) {
        const remainingMinutes = Math.ceil((resetTime - now) / 60000);
        const message = lang === 'zh-CN'
          ? `修改昵称过于频繁，请在 ${remainingMinutes} 分钟后再试`
          : `Nickname update too frequent, please try again in ${remainingMinutes} minutes`;
        return c.json({
          success: false,
          error: {
            code: 'NICKNAME_RATE_LIMIT',
            message,
            resetTime,
            remainingMinutes,
          },
        }, 429);
      }

      // 如果已过冷却期，重置计数器
      if (now >= resetTime) {
        await c.env.RATE_LIMIT.put(
          rateLimitKey,
          JSON.stringify({ count: 1, resetTime: now + 3600000 }), // 1小时后过期
          { expirationTtl: 3600 }
        );
      } else {
        // 增加计数
        await c.env.RATE_LIMIT.put(
          rateLimitKey,
          JSON.stringify({ count: count + 1, resetTime }),
          { expirationTtl: Math.max(60, Math.ceil((resetTime - now) / 1000)) } // 确保 ≥60 秒
        );
      }
    } else {
      // 首次修改，初始化计数器
      const resetTime = Date.now() + 3600000; // 1小时后
      await c.env.RATE_LIMIT.put(
        rateLimitKey,
        JSON.stringify({ count: 1, resetTime }),
        { expirationTtl: 3600 }
      );
    }

    // 验证加密数据（encrypted_nickname 和 nickname_iv 必须同时存在或同时为空）
    if ((encrypted_nickname && !nickname_iv) || (!encrypted_nickname && nickname_iv)) {
      const message = lang === 'zh-CN'
        ? '昵称加密数据不完整'
        : 'Incomplete encrypted nickname data';
      return c.json({
        success: false,
        error: { code: 'INVALID_ENCRYPTED_DATA', message },
      }, 400);
    }

    // 验证加密昵称长度（防止超长密文）
    if (encrypted_nickname && encrypted_nickname.length > 500) {
      const message = lang === 'zh-CN'
        ? '昵称加密数据过长'
        : 'Encrypted nickname data too long';
      return c.json({
        success: false,
        error: { code: 'ENCRYPTED_DATA_TOO_LONG', message },
      }, 400);
    }

    // 更新昵称（存储密文和 IV，服务器无法看到明文）
    await c.env.DB.prepare(
      'UPDATE users SET encrypted_nickname = ?, nickname_iv = ?, updated_at = ? WHERE id = ?'
    ).bind(encrypted_nickname || null, nickname_iv || null, getCurrentTimestamp(), user.user_id).run();

    // 返回更新后的用户信息（只返回密文）
    const updatedUser = await c.env.DB.prepare(
      'SELECT id, email, encrypted_nickname, nickname_iv, created_at, updated_at FROM users WHERE id = ?'
    ).bind(user.user_id).first();

    return c.json({
      success: true,
      data: {
        user: updatedUser,
      },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'UPDATE_NICKNAME_FAILED', message: error.message },
    }, 500);
  }
});

// ============================================================================
// 设备管理路由（需要认证）
// ============================================================================

/**
 * 获取设备列表
 * GET /api/sessions
 */
app.get('/api/sessions', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const currentSessionId = c.get('sessionId');

    const sessionRepo = new SessionRepository(c.env.DB);
    const sessions = await sessionRepo.findByUserId(user.user_id);

    // 标记当前设备
    const sessionsWithFlag = sessions.map(session => ({
      ...session,
      is_current: session.id === currentSessionId,
      is_active: session.is_active === 1,  // 转换为布尔值
    }));

    return c.json({
      success: true,
      data: {
        sessions: sessionsWithFlag,
        max_devices: 3,
      }
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 远程登出其他设备
 * DELETE /api/sessions/:sessionId
 */
app.delete('/api/sessions/:sessionId', authMiddleware, async (c) => {
  try {
    const targetSessionId = c.req.param('sessionId');
    const currentUserId = c.get('user').user_id;
    const currentSessionId = c.get('sessionId');

    // 禁止登出当前设备
    if (targetSessionId === currentSessionId) {
      return c.json({
        success: false,
        error: { code: 'CANNOT_LOGOUT_SELF', message: '无法登出当前设备，请使用登出接口' },
      }, 400);
    }

    // 验证会话归属
    const sessionRepo = new SessionRepository(c.env.DB);
    const session = await sessionRepo.findById(targetSessionId);

    if (!session || session.user_id !== currentUserId) {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: '无权限登出此设备' },
      }, 403);
    }

    // 撤销会话
    await sessionRepo.revoke(targetSessionId);

    return c.json({
      success: true,
      data: { message: '设备已登出' }
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'REVOKE_FAILED', message: error.message },
    }, 500);
  }
});

// ============================================================================
// 笔记路由（需要认证）
// ============================================================================

/**
 * 获取笔记总数（轻量级查询，用于混合分页策略）
 * GET /api/notes/count
 */
app.get('/api/notes/count', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const noteRepo = new NoteRepository(c.env.DB);
    const total = await noteRepo.countByUserId(user.user_id);

    return c.json({
      success: true,
      data: { total },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'COUNT_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 获取笔记列表
 * GET /api/notes?limit=50&offset=0
 */
app.get('/api/notes', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    // 解析语言
    const acceptLanguage = c.req.header('Accept-Language');
    console.log('[DEBUG] Accept-Language header:', acceptLanguage);
    const lang = parseLanguage(acceptLanguage);
    console.log('[DEBUG] Parsed language:', lang);

    const noteRepo = new NoteRepository(c.env.DB);
    const notes = await noteRepo.findByUserId(user.user_id, { limit, offset });
    const total = await noteRepo.countByUserId(user.user_id);

    // 获取配额状态（捕获异常，转换为状态对象）
    let quotaStatus;
    try {
      quotaStatus = checkNotesQuota(total, lang);
    } catch (error: any) {
      if (error instanceof QuotaError) {
        // 硬限制已达到，但不阻止 GET 请求
        quotaStatus = {
          allowed: false,
          warning: true,
          message: error.message,
          current: error.current,
          softLimit: 500,
          hardLimit: error.limit,
        };
      } else {
        throw error;
      }
    }

    return c.json({
      success: true,
      data: {
        notes,
        pagination: { limit, offset, total },
        quota: quotaStatus, // 前端可根据此信息显示配额使用情况
      },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 创建笔记
 * POST /api/notes
 */
app.post('/api/notes', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const input = await c.req.json();

    // 解析语言
    const lang = parseLanguage(c.req.header('Accept-Language'));

    // 🔐 输入验证（后端安全防线）
    try {
      validateNoteInput(input, lang);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return c.json({
          success: false,
          error: { code: error.code, message: error.message },
        }, 400);
      }
      throw error;
    }

    // 📊 配额检查（软限制 + 硬限制）
    const noteRepo = new NoteRepository(c.env.DB);
    const currentCount = await noteRepo.countByUserId(user.user_id);

    try {
      const quotaStatus = checkNotesQuota(currentCount, lang);

      // 创建笔记
      const note = await noteRepo.create(user.user_id, input);

      // 返回结果（包含配额警告）
      return c.json({
        success: true,
        data: note,
        quota: quotaStatus, // 前端可根据此信息显示警告
      }, 201);
    } catch (error: any) {
      if (error instanceof QuotaError) {
        return c.json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            current: error.current,
            limit: error.limit,
          },
        }, 403); // 403 Forbidden
      }
      throw error;
    }
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'CREATE_FAILED', message: error.message },
    }, 400);
  }
});

/**
 * 获取单个笔记
 * GET /api/notes/:id
 */
app.get('/api/notes/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');

    const noteRepo = new NoteRepository(c.env.DB);
    const note = await noteRepo.findById(id, user.user_id);

    if (!note) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Note not found' },
      }, 404);
    }

    return c.json({ success: true, data: note });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 更新笔记
 * PUT /api/notes/:id
 * 🛡️ 速率限制：每分钟最多 2 次更新（防止恶意频繁保存）
 */
app.put('/api/notes/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const input = await c.req.json();

    // 解析语言
    const lang = parseLanguage(c.req.header('Accept-Language'));

    // 🛡️ 速率限制检查（后端第二层防护 - 用户全局限制）
    const rateLimitKey = `note_update:${user.user_id}`; // 移除 :${id}，改为用户全局限制
    const rateLimitData = await c.env.RATE_LIMIT.get(rateLimitKey);

    if (rateLimitData) {
      const { count, resetTime } = JSON.parse(rateLimitData);
      const now = Date.now();

      // 如果在冷却期内且已超过限制（2次/分钟）
      if (now < resetTime && count >= 2) {
        const remainingSeconds = Math.ceil((resetTime - now) / 1000);
        const message = lang === 'zh-CN'
          ? `保存过于频繁，请在 ${remainingSeconds} 秒后再试`
          : `Save too frequent, please try again in ${remainingSeconds} seconds`;
        return c.json({
          success: false,
          error: {
            code: 'NOTE_UPDATE_RATE_LIMIT',
            message,
            resetTime,
            remainingSeconds,
          },
        }, 429);
      }

      // 如果已过冷却期，重置计数器
      if (now >= resetTime) {
        await c.env.RATE_LIMIT.put(
          rateLimitKey,
          JSON.stringify({ count: 1, resetTime: now + 60000 }), // 1分钟后过期
          { expirationTtl: 60 }
        );
      } else {
        // 增加计数
        await c.env.RATE_LIMIT.put(
          rateLimitKey,
          JSON.stringify({ count: count + 1, resetTime }),
          { expirationTtl: Math.max(60, Math.ceil((resetTime - now) / 1000)) } // 确保 ≥60 秒
        );
      }
    } else {
      // 首次更新，初始化计数器
      const resetTime = Date.now() + 60000; // 1分钟后
      await c.env.RATE_LIMIT.put(
        rateLimitKey,
        JSON.stringify({ count: 1, resetTime }),
        { expirationTtl: 60 }
      );
    }

    // 🔐 输入验证（后端安全防线）
    try {
      validateNoteInput(input, lang);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return c.json({
          success: false,
          error: { code: error.code, message: error.message },
        }, 400);
      }
      throw error;
    }

    const noteRepo = new NoteRepository(c.env.DB);
    const note = await noteRepo.update(id, user.user_id, input);

    return c.json({ success: true, data: note });
  } catch (error: any) {
    if (error.message.includes('Version conflict')) {
      return c.json({
        success: false,
        error: { code: 'VERSION_CONFLICT', message: error.message },
      }, 409);
    }

    return c.json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: error.message },
    }, 400);
  }
});

/**
 * 删除笔记
 * DELETE /api/notes/:id
 */
app.delete('/api/notes/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');

    const noteRepo = new NoteRepository(c.env.DB);
    const success = await noteRepo.hardDelete(id, user.user_id);

    if (!success) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Note not found' },
      }, 404);
    }

    return c.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'DELETE_FAILED', message: error.message },
    }, 500);
  }
});

// ============================================================================
// 密码路由（需要认证）
// ============================================================================

/**
 * 获取密码总数（轻量级查询，用于混合分页策略）
 * GET /api/passwords/count
 */
app.get('/api/passwords/count', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const passwordRepo = new PasswordRepository(c.env.DB);
    const total = await passwordRepo.countByUserId(user.user_id);

    return c.json({
      success: true,
      data: { total },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'COUNT_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 获取密码列表
 * GET /api/passwords?limit=50&offset=0
 */
app.get('/api/passwords', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    // 解析语言
    const lang = parseLanguage(c.req.header('Accept-Language'));

    const passwordRepo = new PasswordRepository(c.env.DB);
    const passwords = await passwordRepo.findByUserId(user.user_id, { limit, offset });
    const total = await passwordRepo.countByUserId(user.user_id);

    // 获取配额状态（捕获异常，转换为状态对象）
    let quotaStatus;
    try {
      quotaStatus = checkPasswordsQuota(total, lang);
    } catch (error: any) {
      if (error instanceof QuotaError) {
        // 硬限制已达到，但不阻止 GET 请求
        quotaStatus = {
          allowed: false,
          warning: true,
          message: error.message,
          current: error.current,
          softLimit: 500,
          hardLimit: error.limit,
        };
      } else {
        throw error;
      }
    }

    return c.json({
      success: true,
      data: {
        passwords,
        pagination: { limit, offset, total },
        quota: quotaStatus, // 前端可根据此信息显示配额使用情况
      },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 创建密码
 * POST /api/passwords
 */
app.post('/api/passwords', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const input = await c.req.json();

    // 解析语言
    const lang = parseLanguage(c.req.header('Accept-Language'));

    // 🔐 输入验证（后端安全防线）
    try {
      validatePasswordInput(input, lang);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return c.json({
          success: false,
          error: { code: error.code, message: error.message },
        }, 400);
      }
      throw error;
    }

    // 📊 配额检查（软限制 + 硬限制）
    const passwordRepo = new PasswordRepository(c.env.DB);
    const currentCount = await passwordRepo.countByUserId(user.user_id);

    try {
      const quotaStatus = checkPasswordsQuota(currentCount, lang);

      // 创建密码
      const password = await passwordRepo.create(user.user_id, input);

      // 返回结果（包含配额警告）
      return c.json({
        success: true,
        data: password,
        quota: quotaStatus, // 前端可根据此信息显示警告
      }, 201);
    } catch (error: any) {
      if (error instanceof QuotaError) {
        return c.json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            current: error.current,
            limit: error.limit,
          },
        }, 403); // 403 Forbidden
      }
      throw error;
    }
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'CREATE_FAILED', message: error.message },
    }, 400);
  }
});

/**
 * 更新密码
 * PUT /api/passwords/:id
 * 🛡️ 速率限制：每分钟最多 2 次更新（防止恶意频繁保存）
 */
app.put('/api/passwords/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const input = await c.req.json();

    // 解析语言
    const lang = parseLanguage(c.req.header('Accept-Language'));

    // 🛡️ 速率限制检查（后端第二层防护 - 用户全局限制）
    const rateLimitKey = `password_update:${user.user_id}`; // 移除 :${id}，改为用户全局限制
    const rateLimitData = await c.env.RATE_LIMIT.get(rateLimitKey);

    if (rateLimitData) {
      const { count, resetTime } = JSON.parse(rateLimitData);
      const now = Date.now();

      // 如果在冷却期内且已超过限制（2次/分钟）
      if (now < resetTime && count >= 2) {
        const remainingSeconds = Math.ceil((resetTime - now) / 1000);
        const message = lang === 'zh-CN'
          ? `保存过于频繁，请在 ${remainingSeconds} 秒后再试`
          : `Save too frequent, please try again in ${remainingSeconds} seconds`;
        return c.json({
          success: false,
          error: {
            code: 'PASSWORD_UPDATE_RATE_LIMIT',
            message,
            resetTime,
            remainingSeconds,
          },
        }, 429);
      }

      // 如果已过冷却期，重置计数器
      if (now >= resetTime) {
        await c.env.RATE_LIMIT.put(
          rateLimitKey,
          JSON.stringify({ count: 1, resetTime: now + 60000 }), // 1分钟后过期
          { expirationTtl: 60 }
        );
      } else {
        // 增加计数
        await c.env.RATE_LIMIT.put(
          rateLimitKey,
          JSON.stringify({ count: count + 1, resetTime }),
          { expirationTtl: Math.max(60, Math.ceil((resetTime - now) / 1000)) } // 确保 ≥60 秒
        );
      }
    } else {
      // 首次更新，初始化计数器
      const resetTime = Date.now() + 60000; // 1分钟后
      await c.env.RATE_LIMIT.put(
        rateLimitKey,
        JSON.stringify({ count: 1, resetTime }),
        { expirationTtl: 60 }
      );
    }

    // 🔐 输入验证（后端安全防线）
    try {
      validatePasswordInput(input, lang);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return c.json({
          success: false,
          error: { code: error.code, message: error.message },
        }, 400);
      }
      throw error;
    }

    const passwordRepo = new PasswordRepository(c.env.DB);
    const password = await passwordRepo.update(id, user.user_id, input);

    return c.json({ success: true, data: password });
  } catch (error: any) {
    if (error.message.includes('Version conflict')) {
      return c.json({
        success: false,
        error: { code: 'VERSION_CONFLICT', message: error.message },
      }, 409);
    }

    return c.json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: error.message },
    }, 400);
  }
});

/**
 * 删除密码
 * DELETE /api/passwords/:id
 */
app.delete('/api/passwords/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');

    const passwordRepo = new PasswordRepository(c.env.DB);
    const success = await passwordRepo.hardDelete(id, user.user_id);

    if (!success) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Password not found' },
      }, 404);
    }

    return c.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'DELETE_FAILED', message: error.message },
    }, 500);
  }
});

// ============================================================================
// 邀请码管理路由（需要认证，仅站长可用）
// ============================================================================

/**
 * 验证管理员密码
 * POST /api/admin/verify
 */
app.post('/api/admin/verify', authMiddleware, async (c) => {
  try {
    const { password } = await c.req.json();
    const adminPassword = c.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return c.json({
        success: false,
        error: { code: 'ADMIN_NOT_CONFIGURED', message: '管理员密码未配置' },
      }, 500);
    }

    // 🔐 安全增强：获取客户端 IP 并检查速率限制
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '0.0.0.0';
    const rateLimiter = new RateLimiter(c.env);

    // 1. 检查 IP 全局限制（1小时内最多10次尝试）
    const ipRateCheck = await rateLimiter.checkIPRateLimit(clientIP);
    if (!ipRateCheck.allowed) {
      return c.json({
        success: false,
        error: {
          code: 'IP_RATE_LIMIT',
          message: `登录尝试过于频繁，请在 ${Math.ceil((ipRateCheck.waitSeconds || 0) / 60)} 分钟后重试`,
        },
      }, 429);
    }

    // 2. 检查是否被封禁（5次失败封禁2小时）
    const rateCheck = await rateLimiter.checkAdminRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return c.json({
        success: false,
        error: {
          code: 'ADMIN_BANNED',
          message: '密码错误次数过多，已锁定',
          waitSeconds: rateCheck.waitSeconds,
        },
      }, 429);
    }

    // 🔐 记录 IP 尝试（无论成功失败）
    await rateLimiter.recordIPAttempt(clientIP);

    // 验证密码
    if (password !== adminPassword) {
      // 记录失败
      await rateLimiter.recordAdminFailure(clientIP);

      // 检查失败次数
      const state = await rateLimiter.checkAdminRateLimit(clientIP);
      const failureCount = state.failureCount || 1;

      return c.json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: `密码错误（${failureCount}/5 次）`,
          failureCount,
        },
      }, 403);
    }

    // 验证成功，清除失败记录
    await rateLimiter.recordAdminSuccess(clientIP);

    return c.json({
      success: true,
      data: { message: '验证成功', expires_at: Date.now() + 30 * 60 * 1000 }, // 30分钟有效期
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'VERIFY_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 创建邀请码
 * POST /api/admin/invite-codes
 */
app.post('/api/admin/invite-codes', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { code, max_uses = -1, expires_at = null, note = '' } = await c.req.json();

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '邀请码不能为空' },
      }, 400);
    }

    // 检查邀请码是否已存在
    const existing = await c.env.DB.prepare(
      'SELECT id FROM invite_codes WHERE code = ?'
    ).bind(code.trim()).first();

    if (existing) {
      return c.json({
        success: false,
        error: { code: 'CODE_EXISTS', message: '邀请码已存在' },
      }, 400);
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      'INSERT INTO invite_codes (id, code, max_uses, used_count, expires_at, created_by, created_at, updated_at, is_active, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id,
      code.trim(),
      max_uses,
      0,
      expires_at,
      user.user_id,
      now,
      now,
      1,
      note
    ).run();

    const inviteCode = await c.env.DB.prepare(
      'SELECT * FROM invite_codes WHERE id = ?'
    ).bind(id).first();

    return c.json({ success: true, data: inviteCode }, 201);
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'CREATE_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 获取邀请码列表
 * GET /api/admin/invite-codes
 */
app.get('/api/admin/invite-codes', authMiddleware, async (c) => {
  try {
    const { limit = 100, offset = 0 } = c.req.query();

    const inviteCodes = await c.env.DB.prepare(
      'SELECT * FROM invite_codes ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(Number(limit), Number(offset)).all();

    const totalResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM invite_codes'
    ).first();

    return c.json({
      success: true,
      data: {
        invite_codes: inviteCodes.results,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: totalResult?.count || 0,
        },
      },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 更新邀请码
 * PUT /api/admin/invite-codes/:id
 */
app.put('/api/admin/invite-codes/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const { max_uses, expires_at, is_active, note } = await c.req.json();

    const existing = await c.env.DB.prepare(
      'SELECT * FROM invite_codes WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: '邀请码不存在' },
      }, 404);
    }

    await c.env.DB.prepare(
      'UPDATE invite_codes SET max_uses = ?, expires_at = ?, is_active = ?, note = ?, updated_at = ? WHERE id = ?'
    ).bind(
      max_uses ?? existing.max_uses,
      expires_at !== undefined ? expires_at : existing.expires_at,
      is_active !== undefined ? is_active : existing.is_active,
      note !== undefined ? note : existing.note,
      Date.now(),
      id
    ).run();

    const updated = await c.env.DB.prepare(
      'SELECT * FROM invite_codes WHERE id = ?'
    ).bind(id).first();

    return c.json({ success: true, data: updated });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 删除邀请码
 * DELETE /api/admin/invite-codes/:id
 */
app.delete('/api/admin/invite-codes/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');

    const existing = await c.env.DB.prepare(
      'SELECT id FROM invite_codes WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: '邀请码不存在' },
      }, 404);
    }

    await c.env.DB.prepare(
      'DELETE FROM invite_codes WHERE id = ?'
    ).bind(id).run();

    return c.json({ success: true, data: { id } });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'DELETE_FAILED', message: error.message },
      }, 500);
  }
});

/**
 * 获取用户列表（管理员功能）
 * GET /api/admin/users
 */
app.get('/api/admin/users', authMiddleware, async (c) => {
  try {
    // 获取用户列表及其统计信息
    const usersResult = await c.env.DB.prepare(`
      SELECT
        u.id,
        u.email,
        u.created_at,
        u.updated_at,
        (SELECT COUNT(*) FROM notes WHERE user_id = u.id) as notes_count,
        (SELECT COUNT(*) FROM passwords WHERE user_id = u.id) as passwords_count,
        (SELECT COUNT(*) FROM sessions WHERE user_id = u.id AND is_active = 1 AND expires_at > ?) as devices_count
      FROM users u
      ORDER BY u.created_at DESC
    `).bind(Date.now()).all();

    return c.json({
      success: true,
      data: {
        users: usersResult.results,
        total: usersResult.results.length,
      },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 删除用户（管理员功能）
 * DELETE /api/admin/users/:userId
 */
app.delete('/api/admin/users/:userId', authMiddleware, async (c) => {
  try {
    const userId = c.req.param('userId');

    // 开始事务：删除用户及其所有关联数据
    // 1. 删除用户的笔记
    await c.env.DB.prepare(`
      DELETE FROM notes WHERE user_id = ?
    `).bind(userId).run();

    // 2. 删除用户的密码
    await c.env.DB.prepare(`
      DELETE FROM passwords WHERE user_id = ?
    `).bind(userId).run();

    // 3. 删除用户的会话
    await c.env.DB.prepare(`
      DELETE FROM sessions WHERE user_id = ?
    `).bind(userId).run();

    // 4. 删除用户本身
    const deleteResult = await c.env.DB.prepare(`
      DELETE FROM users WHERE id = ?
    `).bind(userId).run();

    if (deleteResult.meta.changes === 0) {
      return c.json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: '用户不存在' },
      }, 404);
    }

    return c.json({
      success: true,
      data: { message: '用户已删除' },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'DELETE_FAILED', message: error.message },
    }, 500);
  }
});

// ============================================================================
// 数据清理接口
// ============================================================================

/**
 * 手动触发数据清理（管理员功能）
 * POST /api/admin/cleanup
 */
app.post('/api/admin/cleanup', authMiddleware, async (c) => {
  try {
    // 验证管理员密码
    const { password } = await c.req.json();
    const adminPassword = c.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return c.json({
        success: false,
        error: { code: 'ADMIN_NOT_CONFIGURED', message: '管理员密码未配置' },
      }, 500);
    }

    if (password !== adminPassword) {
      return c.json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: '管理员密码错误' },
      }, 403);
    }

    const sessionRepo = new SessionRepository(c.env.DB);

    // 1. 清理过期会话
    const expiredSessions = await sessionRepo.cleanExpired();

    // 2. 清理已登出的会话（is_active = 0）
    const inactiveSessions = await c.env.DB.prepare(
      'DELETE FROM sessions WHERE is_active = 0'
    ).run();

    // 3. 清理过期且已用完的邀请码
    const expiredInviteCodes = await c.env.DB.prepare(`
      DELETE FROM invite_codes
      WHERE (expires_at IS NOT NULL AND expires_at < ?)
         OR (max_uses > 0 AND used_count >= max_uses AND is_active = 0)
    `).bind(Date.now()).run();

    return c.json({
      success: true,
      data: {
        cleaned: {
          expired_sessions: expiredSessions,
          inactive_sessions: inactiveSessions.meta.changes || 0,
          expired_invite_codes: expiredInviteCodes.meta.changes || 0,
        },
        message: '数据清理完成',
      },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'CLEANUP_FAILED', message: error.message },
    }, 500);
  }
});

/**
 * 获取数据库统计信息（管理员功能）
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', authMiddleware, async (c) => {
  try {
    // 验证管理员密码（通过 header）
    const password = c.req.header('X-Admin-Password');
    const adminPassword = c.env.ADMIN_PASSWORD;

    if (!adminPassword || password !== adminPassword) {
      return c.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '需要管理员权限' },
      }, 403);
    }

    const now = Date.now();

    // 统计各类数据
    const stats = {
      total: {
        users: (await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>())?.count || 0,
        notes: (await c.env.DB.prepare('SELECT COUNT(*) as count FROM notes').first<{ count: number }>())?.count || 0,
        passwords: (await c.env.DB.prepare('SELECT COUNT(*) as count FROM passwords').first<{ count: number }>())?.count || 0,
        sessions: (await c.env.DB.prepare('SELECT COUNT(*) as count FROM sessions').first<{ count: number }>())?.count || 0,
        invite_codes: (await c.env.DB.prepare('SELECT COUNT(*) as count FROM invite_codes').first<{ count: number }>())?.count || 0,
      },
      active: {
        sessions: (await c.env.DB.prepare('SELECT COUNT(*) as count FROM sessions WHERE is_active = 1 AND expires_at > ?').bind(now).first<{ count: number }>())?.count || 0,
        invite_codes: (await c.env.DB.prepare('SELECT COUNT(*) as count FROM invite_codes WHERE is_active = 1').first<{ count: number }>())?.count || 0,
      },
      expired: {
        sessions: (await c.env.DB.prepare('SELECT COUNT(*) as count FROM sessions WHERE expires_at < ?').bind(now).first<{ count: number }>())?.count || 0,
        invite_codes: (await c.env.DB.prepare('SELECT COUNT(*) as count FROM invite_codes WHERE expires_at IS NOT NULL AND expires_at < ?').bind(now).first<{ count: number }>())?.count || 0,
      },
      inactive: {
        sessions: (await c.env.DB.prepare('SELECT COUNT(*) as count FROM sessions WHERE is_active = 0').first<{ count: number }>())?.count || 0,
      },
    };

    // 📊 存储空间统计（实际查询）
    // 使用 D1 的 meta.size_after 获取实际数据库大小
    const sizeQuery = await c.env.DB.prepare('SELECT 1').run();
    const actualSizeBytes = sizeQuery.meta?.size_after || 0;
    const actualSizeMB = actualSizeBytes / (1024 * 1024); // 字节转 MB
    const storageLimit = 5 * 1024; // 5GB = 5120MB
    const storageUsagePercent = (actualSizeMB / storageLimit) * 100;

    // 📈 用户配额统计
    const quotaStats = {
      notes: {
        softLimit: 500,
        hardLimit: 1000,
        usersNearSoftLimit: 0, // 接近软限制的用户数（400-499条）
        usersAtSoftLimit: 0,   // 达到软限制的用户数（500-999条）
        usersAtHardLimit: 0,   // 达到硬限制的用户数（≥1000条）
      },
      passwords: {
        softLimit: 500,
        hardLimit: 1000,
        usersNearSoftLimit: 0,
        usersAtSoftLimit: 0,
        usersAtHardLimit: 0,
      },
    };

    // 统计笔记配额使用情况
    const noteCountsByUser = await c.env.DB.prepare(
      'SELECT user_id, COUNT(*) as count FROM notes GROUP BY user_id'
    ).all<{ user_id: string; count: number }>();

    for (const row of noteCountsByUser.results || []) {
      if (row.count >= 1000) {
        quotaStats.notes.usersAtHardLimit++;
      } else if (row.count >= 500) {
        quotaStats.notes.usersAtSoftLimit++;
      } else if (row.count >= 400) {
        quotaStats.notes.usersNearSoftLimit++;
      }
    }

    // 统计密码配额使用情况
    const passwordCountsByUser = await c.env.DB.prepare(
      'SELECT user_id, COUNT(*) as count FROM passwords GROUP BY user_id'
    ).all<{ user_id: string; count: number }>();

    for (const row of passwordCountsByUser.results || []) {
      if (row.count >= 1000) {
        quotaStats.passwords.usersAtHardLimit++;
      } else if (row.count >= 500) {
        quotaStats.passwords.usersAtSoftLimit++;
      } else if (row.count >= 400) {
        quotaStats.passwords.usersNearSoftLimit++;
      }
    }

    return c.json({
      success: true,
      data: {
        ...stats,
        storage: {
          actualUsageMB: Math.round(actualSizeMB * 100) / 100,
          actualUsageBytes: actualSizeBytes,
          limitMB: storageLimit,
          usagePercent: Math.round(storageUsagePercent * 100) / 100,
          status: storageUsagePercent >= 90 ? 'critical' : storageUsagePercent >= 70 ? 'warning' : 'normal',
        },
        quota: quotaStats,
      },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'STATS_FAILED', message: error.message },
    }, 500);
  }
});

// ============================================================================

app.get('/api/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: getCurrentTimestamp(),
      version: '0.1.0',
    },
  });
});

// 导出 Workers 处理函数
// 注意：Cron Triggers 是 Cloudflare Workers 付费功能，免费版不支持
// 免费版用户请使用后台管理页面的"清理数据"按钮手动触发清理
export default app;
