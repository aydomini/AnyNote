/**
 * 输入验证工具模块
 *
 * 安全原则：前后端双重验证
 * - 前端验证：提升用户体验，即时反馈
 * - 后端验证：最后防线，拒绝非法数据（防止前端绕过）
 *
 * 多语言支持：根据 Accept-Language 请求头返回中英文错误消息
 */

import { t, getErrorMessage } from './i18n';

/**
 * 验证错误类
 */
export class ValidationError extends Error {
  public code: string;

  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

/**
 * 字符长度限制常量（与前端保持一致）
 */
export const INPUT_LIMITS = {
  // 邀请码
  INVITE_CODE_MAX: 32,

  // 密码备注
  PASSWORD_NOTES_MAX: 512,

  // 搜索关键词
  SEARCH_KEYWORD_MAX: 16,

  // 用户注册
  EMAIL_MAX: 255,
  PASSWORD_MIN: 12,
  PASSWORD_MAX: 32,

  // 用户昵称
  NICKNAME_MAX: 8,  // 前端 maxLength={8}

  // 笔记相关
  NOTE_TITLE_MAX: 32,  // 前端 maxLength={32}（明文）
  NOTE_CONTENT_MAX: 100000,  // 100KB 字符（约 5 万汉字，50 页 Word 文档）（明文）

  // 密码管理器（明文限制）
  PASSWORD_SITE_MAX: 32,  // 前端 maxLength={32}
  PASSWORD_USERNAME_MAX: 32,  // 前端 maxLength={32}
  PASSWORD_VALUE_MAX: 32,  // 前端 maxLength={32}

  // 标签（所有标签的总字符数不能超过 32）
  TAG_TOTAL_MAX_LENGTH: 32,  // 前端限制所有标签总字符数

  // 🔐 加密数据长度限制（Base64 密文 + IV + Auth Tag）
  // 计算公式：明文长度 × 1.5（AES 填充）× 1.33（Base64 编码）+ IV(16字节) + AuthTag(16字节)
  ENCRYPTED_TITLE_MAX: 2048,        // 标题加密后最大 2KB
  ENCRYPTED_CONTENT_MAX: 200000,    // 内容加密后最大 200KB（明文 100KB → 密文约 150KB，留余量）
  ENCRYPTED_SITE_MAX: 2048,         // 网站名加密后最大 2KB
  ENCRYPTED_USERNAME_MAX: 2048,     // 用户名加密后最大 2KB
  ENCRYPTED_PASSWORD_MAX: 2048,     // 密码加密后最大 2KB
  ENCRYPTED_NOTES_MAX: 4096,        // 备注加密后最大 4KB（明文 512 → 密文约 1KB，留余量）
  ENCRYPTED_NICKNAME_MAX: 1024,     // 昵称加密后最大 1KB
};

/**
 * 验证字符串长度
 *
 * @param value - 要验证的值
 * @param fieldKey - 字段键名（用于国际化）
 * @param options - 验证选项
 * @param lang - 语言
 */
export function validateStringLength(
  value: string | null | undefined,
  fieldKey: string,
  options: {
    min?: number;
    max?: number;
    required?: boolean;
  },
  lang: 'zh-CN' | 'en-US' = 'zh-CN'
): void {
  const { min, max, required = false } = options;

  // 空值检查
  if (!value || value.trim() === '') {
    if (required) {
      throw new ValidationError(
        getErrorMessage('FIELD_REQUIRED', { field: t(fieldKey, lang) }, lang),
        'FIELD_REQUIRED'
      );
    }
    return;
  }

  const length = value.length;

  // 最小长度检查
  if (min !== undefined && length < min) {
    throw new ValidationError(
      getErrorMessage('FIELD_TOO_SHORT', { field: t(fieldKey, lang), min, current: length }, lang),
      'FIELD_TOO_SHORT'
    );
  }

  // 最大长度检查
  if (max !== undefined && length > max) {
    throw new ValidationError(
      getErrorMessage('FIELD_TOO_LONG', { field: t(fieldKey, lang), max, current: length }, lang),
      'FIELD_TOO_LONG'
    );
  }
}

/**
 * 验证邀请码格式和长度
 */
export function validateInviteCode(inviteCode: string, lang: 'zh-CN' | 'en-US' = 'zh-CN'): void {
  validateStringLength(inviteCode, 'inviteCode', {
    required: true,
    max: INPUT_LIMITS.INVITE_CODE_MAX,
  }, lang);

  // 格式检查：AnyNote-XXXXX-XXXXX-XXXXX-XXXXX
  const inviteCodePattern = /^AnyNote-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/;
  if (!inviteCodePattern.test(inviteCode)) {
    const message = lang === 'zh-CN'
      ? '邀请码格式错误（正确格式：AnyNote-XXXXX-XXXXX-XXXXX-XXXXX）'
      : 'Invalid invite code format (correct format: AnyNote-XXXXX-XXXXX-XXXXX-XXXXX)';
    throw new ValidationError(message, 'INVALID_INVITE_CODE_FORMAT');
  }
}

/**
 * 验证搜索关键词
 */
export function validateSearchKeyword(keyword: string | null | undefined, lang: 'zh-CN' | 'en-US' = 'zh-CN'): void {
  if (!keyword || keyword.trim() === '') {
    return; // 搜索关键词允许为空（返回全部结果）
  }

  validateStringLength(keyword, 'searchKeyword', {
    max: INPUT_LIMITS.SEARCH_KEYWORD_MAX,
  }, lang);
}

/**
 * 验证笔记输入
 */
export function validateNoteInput(input: {
  title?: string;
  encrypted_content?: string;
  tags?: string[];
}, lang: 'zh-CN' | 'en-US' = 'zh-CN'): void {
  // 标题验证（可选）- 验证加密后的数据长度
  if (input.title) {
    validateStringLength(input.title, 'noteTitle', {
      max: INPUT_LIMITS.ENCRYPTED_TITLE_MAX,  // 加密后最大 2KB
    }, lang);
  }

  // 内容验证（必需）- 验证加密后的数据长度
  validateStringLength(input.encrypted_content, 'noteContent', {
    required: true,
    max: INPUT_LIMITS.ENCRYPTED_CONTENT_MAX,  // 加密后最大 200KB
  }, lang);

  // 标签验证（可选）- 验证所有标签的总字符数
  if (input.tags && Array.isArray(input.tags)) {
    // 计算所有标签的总字符数
    const totalTagChars = input.tags.join('').length;

    // 验证总字符数不超过 32
    if (totalTagChars > INPUT_LIMITS.TAG_TOTAL_MAX_LENGTH) {
      throw new ValidationError(
        getErrorMessage('TAG_TOTAL_TOO_LONG', { max: INPUT_LIMITS.TAG_TOTAL_MAX_LENGTH, current: totalTagChars }, lang),
        'TAG_TOTAL_TOO_LONG'
      );
    }

    // 验证每个标签不为空
    input.tags.forEach((tag, index) => {
      if (!tag || tag.trim().length === 0) {
        const message = lang === 'zh-CN'
          ? `标签[${index}] 不能为空`
          : `Tag[${index}] cannot be empty`;
        throw new ValidationError(message, 'TAG_EMPTY');
      }
    });
  }
}

/**
 * 验证密码输入
 */
export function validatePasswordInput(input: {
  encrypted_site?: string;
  encrypted_username?: string;
  encrypted_password?: string;
  encrypted_notes?: string;
}, lang: 'zh-CN' | 'en-US' = 'zh-CN'): void {
  // 网站名验证（必需）- 验证加密后的数据长度
  validateStringLength(input.encrypted_site, 'passwordSite', {
    required: true,
    max: INPUT_LIMITS.ENCRYPTED_SITE_MAX,  // 加密后最大 2KB
  }, lang);

  // 用户名验证（必需）- 验证加密后的数据长度
  validateStringLength(input.encrypted_username, 'passwordUsername', {
    required: true,
    max: INPUT_LIMITS.ENCRYPTED_USERNAME_MAX,  // 加密后最大 2KB
  }, lang);

  // 密码验证（必需）- 验证加密后的数据长度
  validateStringLength(input.encrypted_password, 'passwordValue', {
    required: true,
    max: INPUT_LIMITS.ENCRYPTED_PASSWORD_MAX,  // 加密后最大 2KB
  }, lang);

  // 备注验证（可选）- 验证加密后的数据长度
  if (input.encrypted_notes) {
    validateStringLength(input.encrypted_notes, 'passwordNotes', {
      max: INPUT_LIMITS.ENCRYPTED_NOTES_MAX,  // 加密后最大 4KB
    }, lang);
  }
}

/**
 * 验证邮箱格式和长度
 */
export function validateEmail(email: string, lang: 'zh-CN' | 'en-US' = 'zh-CN'): void {
  validateStringLength(email, 'email', {
    required: true,
    max: INPUT_LIMITS.EMAIL_MAX,
  }, lang);

  // 邮箱格式检查
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new ValidationError(
      getErrorMessage('EMAIL_INVALID', {}, lang),
      'EMAIL_INVALID'
    );
  }

  // 邮箱前后段长度检查（前后各 12-32 字符）
  const [localPart, domainPart] = email.split('@');
  if (localPart.length < 12 || localPart.length > 32) {
    const message = lang === 'zh-CN'
      ? '邮箱用户名长度必须为 12-32 个字符'
      : 'Email local part must be 12-32 characters';
    throw new ValidationError(message, 'EMAIL_LOCAL_PART_INVALID');
  }
  if (domainPart.length < 12 || domainPart.length > 32) {
    const message = lang === 'zh-CN'
      ? '邮箱域名长度必须为 12-32 个字符'
      : 'Email domain part must be 12-32 characters';
    throw new ValidationError(message, 'EMAIL_DOMAIN_PART_INVALID');
  }
}

/**
 * 验证昵称（禁止空格）
 */
export function validateNickname(nickname: string, lang: 'zh-CN' | 'en-US' = 'zh-CN'): void {
  // 昵称可选，但如果提供则必须符合长度限制
  if (nickname && nickname.trim()) {
    const trimmed = nickname.trim();

    validateStringLength(trimmed, 'nickname', {
      max: INPUT_LIMITS.NICKNAME_MAX,
    }, lang);

    // 禁止包含空格
    if (/\s/.test(trimmed)) {
      const message = lang === 'zh-CN'
        ? '昵称不能包含空格'
        : 'Nickname cannot contain spaces';
      throw new ValidationError(message, 'NICKNAME_CONTAINS_SPACES');
    }
  }
}

/**
 * 验证密码哈希和盐值
 */
export function validateAuthCredentials(auth_hash: string, salt: string, lang: 'zh-CN' | 'en-US' = 'zh-CN'): void {
  validateStringLength(auth_hash, 'authHash', {
    required: true,
    min: 64,
    max: 128,
  }, lang);

  validateStringLength(salt, 'salt', {
    required: true,
    min: 32,
    max: 64,
  }, lang);
}
