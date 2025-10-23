/**
 * 输入验证和 XSS 防护工具
 * 确保用户输入安全，防止 SQL 注入和 XSS 攻击
 */

/**
 * 验证 Email 格式
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 兼容的 Email 正则表达式（简化版）
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  // 限制长度为 12-32 字符（与前端保持一致）
  return emailRegex.test(email) && email.length >= 12 && email.length <= 32;
}

/**
 * 验证字符串长度
 */
export function isValidLength(str: string, min: number, max: number): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }
  return str.length >= min && str.length <= max;
}

/**
 * 清理 HTML 标签（基础 XSS 防护）
 * 注意：由于数据已加密，这里主要防止元数据字段的 XSS
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  // 移除 HTML 标签
  let sanitized = str.replace(/<[^>]*>/g, '');

  // 转义特殊字符
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
}

/**
 * 验证 UUID 格式
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * 验证 Base64 字符串格式
 */
export function isValidBase64(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }

  // Base64 正则表达式
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

  // 检查长度是否为 4 的倍数
  if (str.length % 4 !== 0) {
    return false;
  }

  return base64Regex.test(str);
}

/**
 * 验证十六进制字符串
 */
export function isValidHex(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }

  const hexRegex = /^[0-9a-fA-F]+$/;
  return hexRegex.test(str);
}

/**
 * 验证输入字符串是否包含危险字符（防止注入攻击）
 */
export function containsDangerousChars(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }

  // 检查是否包含潜在的 SQL 注入或脚本注入模式
  const dangerousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // 事件处理器如 onclick=
    /eval\s*\(/gi,
    /expression\s*\(/gi,
  ];

  return dangerousPatterns.some(pattern => pattern.test(str));
}

/**
 * 限制字符串到安全长度
 */
export function truncateString(str: string, maxLength: number): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  if (str.length <= maxLength) {
    return str;
  }

  return str.substring(0, maxLength);
}

/**
 * 验证对象是否包含必需字段
 */
export function hasRequiredFields<T extends Record<string, any>>(
  obj: T,
  requiredFields: (keyof T)[]
): boolean {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  return requiredFields.every(field => {
    return field in obj && obj[field] !== null && obj[field] !== undefined && obj[field] !== '';
  });
}
