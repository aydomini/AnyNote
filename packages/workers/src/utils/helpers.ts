/**
 * 工具函数：生成 UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * 工具函数：生成当前 Unix 时间戳（秒）
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 工具函数：验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 工具函数：生成安全的随机盐（Hex 编码）
 */
export function generateSalt(length: number = 32): string {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 工具函数：计算 SHA-256 哈希（用于 checksum）
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 工具函数：安全的常量时间字符串比较（防止时序攻击）
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * 工具函数：简单的 JWT 签名和验证（使用 HMAC-SHA256）
 * 注意：这是简化版本，生产环境建议使用成熟的 JWT 库
 */
export async function signJWT(
  payload: any,
  secret: string,
  expiresIn: string = '7d'
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseDuration(expiresIn);

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const jwtPayload = {
    ...payload,
    iat: now,
    exp,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const signature = await hmacSign(message, secret);
  const encodedSignature = base64UrlEncode(signature);

  return `${message}.${encodedSignature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const message = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = await hmacSign(message, secret);
  const expectedEncodedSignature = base64UrlEncode(expectedSignature);

  // 使用常量时间比较防止时序攻击
  if (!constantTimeCompare(encodedSignature, expectedEncodedSignature)) {
    throw new Error('Invalid JWT signature');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));

  // 检查过期时间
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('JWT expired');
  }

  return payload;
}

/**
 * 辅助函数：HMAC-SHA256 签名
 */
async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return arrayBufferToString(signature);
}

/**
 * 辅助函数：Base64 URL 编码
 */
function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * 辅助函数：Base64 URL 解码
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return atob(base64);
}

/**
 * 辅助函数：ArrayBuffer 转字符串
 */
function arrayBufferToString(buffer: ArrayBuffer): string {
  return String.fromCharCode(...new Uint8Array(buffer));
}

/**
 * 辅助函数：解析时间字符串（如 "7d", "24h", "30m"）
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([dhms])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * multipliers[unit];
}

/**
 * 工具函数：格式化 API 成功响应
 */
export function successResponse<T>(data: T, metadata?: any): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      metadata: {
        timestamp: getCurrentTimestamp(),
        ...metadata,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * 工具函数：格式化 API 错误响应
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = 400
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code,
        message,
      },
      metadata: {
        timestamp: getCurrentTimestamp(),
      },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * 工具函数：CORS 预检响应
 */
export function corsPreflightResponse(allowedOrigins: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigins,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * 工具函数：添加 CORS 头部
 */
export function addCorsHeaders(
  response: Response,
  allowedOrigins: string
): Response {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', allowedOrigins);
  newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  return newResponse;
}
