/**
 * 后端国际化工具模块
 *
 * 支持中英文双语错误消息
 */

/**
 * 字段名称翻译
 */
const FIELD_NAMES = {
  'zh-CN': {
    email: '邮箱',
    password: '主密码',
    inviteCode: '邀请码',
    noteTitle: '笔记标题',
    noteContent: '笔记内容',
    passwordSite: '网站名称',
    passwordUsername: '用户名',
    passwordValue: '密码',
    passwordNotes: '备注',
    searchKeyword: '搜索关键词',
    authHash: '认证哈希',
    salt: '盐值',
  },
  'en-US': {
    email: 'Email',
    password: 'Master password',
    inviteCode: 'Invite code',
    noteTitle: 'Note title',
    noteContent: 'Note content',
    passwordSite: 'Website',
    passwordUsername: 'Username',
    passwordValue: 'Password',
    passwordNotes: 'Notes',
    searchKeyword: 'Search keyword',
    authHash: 'Authentication hash',
    salt: 'Salt',
  },
};

/**
 * 错误消息模板
 */
const ERROR_MESSAGES = {
  'zh-CN': {
    FIELD_REQUIRED: '{field}不能为空',
    FIELD_TOO_SHORT: '{field}长度不能少于 {min} 个字符（当前 {current} 个字符）',
    FIELD_TOO_LONG: '{field}长度不能超过 {max} 个字符（当前 {current} 个字符）',
    EMAIL_INVALID: '邮箱格式无效',
    PASSWORD_TOO_SHORT: '主密码长度不能少于 {min} 个字符',
    PASSWORD_TOO_LONG: '主密码长度不能超过 {max} 个字符',
    AUTH_HASH_INVALID: '认证哈希格式无效（必须是 64 字符的十六进制字符串）',
    SALT_INVALID: '盐值格式无效（必须是 32 字符的十六进制字符串）',
    INVITE_CODE_TOO_LONG: '邀请码长度不能超过 {max} 个字符',
    TAG_TOTAL_TOO_LONG: '标签总字符数不能超过 {max} 个字符（当前 {current} 个字符）',
    SEARCH_KEYWORD_TOO_LONG: '搜索关键词长度不能超过 {max} 个字符',
  },
  'en-US': {
    FIELD_REQUIRED: '{field} is required',
    FIELD_TOO_SHORT: '{field} must be at least {min} characters (current: {current})',
    FIELD_TOO_LONG: '{field} must not exceed {max} characters (current: {current})',
    EMAIL_INVALID: 'Invalid email format',
    PASSWORD_TOO_SHORT: 'Master password must be at least {min} characters',
    PASSWORD_TOO_LONG: 'Master password must not exceed {max} characters',
    AUTH_HASH_INVALID: 'Invalid authentication hash format (must be 64 hex characters)',
    SALT_INVALID: 'Invalid salt format (must be 32 hex characters)',
    INVITE_CODE_TOO_LONG: 'Invite code must not exceed {max} characters',
    TAG_TOTAL_TOO_LONG: 'Total tag characters must not exceed {max} (current: {current})',
    SEARCH_KEYWORD_TOO_LONG: 'Search keyword must not exceed {max} characters',
  },
};

/**
 * 支持的语言类型
 */
type Language = 'zh-CN' | 'en-US';

/**
 * 占位符替换参数
 */
type Placeholders = Record<string, string | number>;

/**
 * 替换消息模板中的占位符
 *
 * @param template - 消息模板（如 "{field}不能为空"）
 * @param placeholders - 占位符值（如 { field: "邮箱" }）
 * @returns 替换后的消息
 */
function replacePlaceholders(template: string, placeholders?: Placeholders): string {
  if (!placeholders) return template;

  let result = template;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

/**
 * 翻译字段名称
 *
 * @param fieldKey - 字段键名（如 "email"）
 * @param lang - 语言（默认中文）
 * @returns 翻译后的字段名
 */
export function t(fieldKey: string, lang: Language = 'zh-CN'): string {
  const translations = FIELD_NAMES[lang];
  return translations[fieldKey as keyof typeof translations] || fieldKey;
}

/**
 * 获取错误消息
 *
 * @param errorCode - 错误代码（如 "FIELD_REQUIRED"）
 * @param placeholders - 占位符值
 * @param lang - 语言（默认中文）
 * @returns 错误消息
 */
export function getErrorMessage(
  errorCode: string,
  placeholders?: Placeholders,
  lang: Language = 'zh-CN'
): string {
  const messages = ERROR_MESSAGES[lang];
  const template = messages[errorCode as keyof typeof messages] || errorCode;
  return replacePlaceholders(template, placeholders);
}

/**
 * 从 Accept-Language 请求头解析语言
 *
 * @param acceptLanguage - Accept-Language 请求头
 * @returns 语言代码
 */
export function parseLanguage(acceptLanguage: string | null): Language {
  if (!acceptLanguage) return 'zh-CN';

  // 解析 Accept-Language（如 "en-US,en;q=0.9,zh-CN;q=0.8"）
  const languages = acceptLanguage.split(',').map((lang) => {
    const [code, qValue] = lang.trim().split(';');
    const quality = qValue ? parseFloat(qValue.split('=')[1]) : 1.0;
    return { code: code.trim(), quality };
  });

  // 按质量值排序
  languages.sort((a, b) => b.quality - a.quality);

  // 查找支持的语言
  for (const { code } of languages) {
    if (code.startsWith('en')) return 'en-US';
    if (code.startsWith('zh')) return 'zh-CN';
  }

  // 默认中文
  return 'zh-CN';
}
