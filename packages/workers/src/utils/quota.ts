/**
 * 用户配额常量
 *
 * 设计理念：软限制 + 硬限制
 * - 软限制：提示用户精简数据，但不阻止操作
 * - 硬限制：强制阻止创建新数据
 */
export const USER_QUOTA = {
  // 笔记配额
  NOTES_SOFT_LIMIT: 500,      // 软限制：500 条笔记（提示精简）
  NOTES_HARD_LIMIT: 1000,     // 硬限制：1000 条笔记（禁止新增）

  // 密码配额
  PASSWORDS_SOFT_LIMIT: 500,  // 软限制：500 条密码（提示精简）
  PASSWORDS_HARD_LIMIT: 1000, // 硬限制：1000 条密码（禁止新增）

  // 全局存储监控阈值
  STORAGE_WARNING: 80,        // 存储空间使用 80% 时警告
  STORAGE_CRITICAL: 95,       // 存储空间使用 95% 时限制新增
};

/**
 * 配额错误类
 */
export class QuotaError extends Error {
  public code: string;
  public current: number;
  public limit: number;

  constructor(message: string, code: string, current: number, limit: number) {
    super(message);
    this.name = 'QuotaError';
    this.code = code;
    this.current = current;
    this.limit = limit;
  }
}

/**
 * 检查笔记配额
 *
 * @param currentCount - 当前笔记数量
 * @param lang - 语言
 * @returns 配额状态
 */
export function checkNotesQuota(
  currentCount: number,
  lang: 'zh-CN' | 'en-US' = 'zh-CN'
): {
  allowed: boolean;
  warning: boolean;
  message?: string;
  current: number;
  softLimit: number;
  hardLimit: number;
} {
  const { NOTES_SOFT_LIMIT, NOTES_HARD_LIMIT } = USER_QUOTA;

  // 硬限制：禁止新增
  if (currentCount >= NOTES_HARD_LIMIT) {
    const message = lang === 'zh-CN'
      ? `已达上限，请删除旧笔记`
      : `Limit reached, delete old notes`;

    throw new QuotaError(message, 'NOTES_HARD_LIMIT_EXCEEDED', currentCount, NOTES_HARD_LIMIT);
  }

  // 软限制：警告提示
  if (currentCount >= NOTES_SOFT_LIMIT) {
    const message = lang === 'zh-CN'
      ? `数量较多，建议精简`
      : `Too many notes, clean up`;

    return {
      allowed: true,
      warning: true,
      message,
      current: currentCount,
      softLimit: NOTES_SOFT_LIMIT,
      hardLimit: NOTES_HARD_LIMIT,
    };
  }

  // 正常范围
  return {
    allowed: true,
    warning: false,
    current: currentCount,
    softLimit: NOTES_SOFT_LIMIT,
    hardLimit: NOTES_HARD_LIMIT,
  };
}

/**
 * 检查密码配额
 *
 * @param currentCount - 当前密码数量
 * @param lang - 语言
 * @returns 配额状态
 */
export function checkPasswordsQuota(
  currentCount: number,
  lang: 'zh-CN' | 'en-US' = 'zh-CN'
): {
  allowed: boolean;
  warning: boolean;
  message?: string;
  current: number;
  softLimit: number;
  hardLimit: number;
} {
  const { PASSWORDS_SOFT_LIMIT, PASSWORDS_HARD_LIMIT } = USER_QUOTA;

  // 硬限制：禁止新增
  if (currentCount >= PASSWORDS_HARD_LIMIT) {
    const message = lang === 'zh-CN'
      ? `已达上限，请删除旧密码`
      : `Limit reached, delete old passwords`;

    throw new QuotaError(message, 'PASSWORDS_HARD_LIMIT_EXCEEDED', currentCount, PASSWORDS_HARD_LIMIT);
  }

  // 软限制：警告提示
  if (currentCount >= PASSWORDS_SOFT_LIMIT) {
    const message = lang === 'zh-CN'
      ? `数量较多，建议精简`
      : `Too many passwords, clean up`;

    return {
      allowed: true,
      warning: true,
      message,
      current: currentCount,
      softLimit: PASSWORDS_SOFT_LIMIT,
      hardLimit: PASSWORDS_HARD_LIMIT,
    };
  }

  // 正常范围
  return {
    allowed: true,
    warning: false,
    current: currentCount,
    softLimit: PASSWORDS_SOFT_LIMIT,
    hardLimit: PASSWORDS_HARD_LIMIT,
  };
}
