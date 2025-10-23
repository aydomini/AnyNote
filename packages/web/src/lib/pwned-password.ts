/**
 * Have I Been Pwned (HIBP) 密码泄露检测
 * 使用 k-匿名性协议保护隐私
 */

/**
 * 计算 SHA-1 哈希
 */
async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.toUpperCase();
}

/**
 * 检查密码是否在泄露数据库中
 *
 * @param password - 要检查的密码
 * @returns 泄露次数（0 表示未泄露）
 */
export async function checkPasswordBreach(password: string): Promise<number> {
  try {
    // 1. 计算密码的 SHA-1 哈希
    const hash = await sha1(password);

    // 2. 仅发送哈希的前 5 位（k-匿名性协议）
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    // 3. 请求 HIBP API（移除 User-Agent 头以避免 CORS 错误）
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HIBP API error: ${response.status}`);
    }

    // 4. 解析响应（格式：后缀:次数\r\n后缀:次数\r\n...）
    const text = await response.text();
    const lines = text.split('\r\n');

    // 5. 在返回的哈希列表中查找匹配项
    for (const line of lines) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix === suffix) {
        return parseInt(count, 10);
      }
    }

    // 6. 未找到匹配，说明未泄露
    return 0;
  } catch (error) {
    console.error('Password breach check failed:', error);
    throw error;
  }
}

/**
 * 密码泄露检测结果类型
 */
export interface BreachCheckResult {
  breached: boolean;        // 是否泄露
  count: number;            // 泄露次数
  severity: 'safe' | 'low' | 'medium' | 'high' | 'critical'; // 严重程度
}

/**
 * 检查密码泄露并返回详细结果
 */
export async function checkPasswordBreachWithDetails(password: string): Promise<BreachCheckResult> {
  const count = await checkPasswordBreach(password);

  let severity: BreachCheckResult['severity'];
  if (count === 0) {
    severity = 'safe';
  } else if (count < 10) {
    severity = 'low';
  } else if (count < 100) {
    severity = 'medium';
  } else if (count < 10000) {
    severity = 'high';
  } else {
    severity = 'critical';
  }

  return {
    breached: count > 0,
    count,
    severity,
  };
}

/**
 * 简单的缓存机制（避免重复检查同一密码）
 */
const breachCheckCache = new Map<string, { result: BreachCheckResult; timestamp: number }>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 天

/**
 * 带缓存的密码泄露检测
 */
export async function checkPasswordBreachCached(password: string): Promise<BreachCheckResult> {
  // 1. 计算密码哈希作为缓存 key（不存储明文密码）
  const cacheKey = await sha1(password);

  // 2. 检查缓存
  const cached = breachCheckCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  // 3. 执行检查
  const result = await checkPasswordBreachWithDetails(password);

  // 4. 存入缓存
  breachCheckCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
  });

  return result;
}

/**
 * 清除缓存（用于测试或手动刷新）
 */
export function clearBreachCheckCache() {
  breachCheckCache.clear();
}
