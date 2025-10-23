/**
 * AnyNote 核心加密引擎
 *
 * 安全规范：
 * - 加密算法：AES-256-GCM
 * - 密钥派生：PBKDF2-SHA256（600,000 迭代）
 * - 零知识架构：主密码永不上传服务器
 *
 * 威胁模型：
 * - 防御服务器攻破：端到端加密，服务器无解密能力
 * - 防御暴力破解：高迭代 PBKDF2 + 强密码策略
 * - 防御时序攻击：常量时间比较
 *
 * @module crypto-engine
 */

const PBKDF2_ITERATIONS = 600_000; // OWASP 2025 推荐
const AES_KEY_LENGTH = 256;
const GCM_IV_LENGTH = 12; // GCM 推荐 12 字节
const GCM_TAG_LENGTH = 128; // 认证标签长度（位）

export interface EncryptedPayload {
  ciphertext: string;  // Hex 编码的密文
  iv: string;          // Hex 编码的 IV/Nonce
  algorithm: string;   // 加密算法标识
}

export interface DerivedKeys {
  encryptionKey: CryptoKey;  // 用于加密数据
  authHash: string;          // 用于服务端身份验证（Hex 编码）
}

/**
 * 核心加密引擎类
 */
export class CryptoEngine {
  /**
   * 派生主密钥和认证密钥
   *
   * @param masterPassword 用户主密码
   * @param email 用户邮箱（作为盐的一部分）
   * @param salt 随机盐（Hex 编码，注册时生成，登录时从服务器获取）
   * @returns 派生的加密密钥和认证哈希
   */
  static async deriveKeys(
    masterPassword: string,
    email: string,
    salt: string
  ): Promise<DerivedKeys> {
    // 步骤 1：将主密码转换为 CryptoKey
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(masterPassword),
      'PBKDF2',
      false,
      ['deriveKey', 'deriveBits']
    );

    // 步骤 2：结合 email 和随机盐生成唯一盐值
    const combinedSalt = new TextEncoder().encode(`${email}:${salt}`);

    // 步骤 3：派生加密密钥（用于加密数据）
    const encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: combinedSalt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: AES_KEY_LENGTH },
      true, // 可导出（允许使用 wrapKey 包装后持久化到 IndexedDB）
      ['encrypt', 'decrypt']
    );

    // 步骤 4：派生认证密钥（用于服务端验证，较低迭代）
    const authSalt = new TextEncoder().encode(`auth:${email}:${salt}`);
    const authBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: authSalt,
        iterations: 100_000, // 较低迭代（仅用于认证）
        hash: 'SHA-256',
      },
      passwordKey,
      256
    );

    // 将认证密钥转换为 Hex 字符串
    const authHash = Array.from(new Uint8Array(authBits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      encryptionKey,
      authHash,
    };
  }

  /**
   * 加密数据（AES-256-GCM）
   *
   * @param plaintext 明文数据（任意类型，会自动序列化）
   * @param encryptionKey 加密密钥
   * @returns 加密后的数据包（包含密文和 IV）
   */
  static async encrypt(
    plaintext: any,
    encryptionKey: CryptoKey
  ): Promise<EncryptedPayload> {
    // 步骤 1：序列化数据
    const plaintextString = typeof plaintext === 'string'
      ? plaintext
      : JSON.stringify(plaintext);
    const plaintextBuffer = new TextEncoder().encode(plaintextString);

    // 步骤 2：生成随机 IV（每次加密都必须不同）
    const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH));

    // 步骤 3：使用 AES-GCM 加密
    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: GCM_TAG_LENGTH,
      },
      encryptionKey,
      plaintextBuffer
    );

    // 步骤 4：转换为 Hex 编码（便于存储和传输）
    const ciphertext = Array.from(new Uint8Array(ciphertextBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const ivHex = Array.from(iv)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      ciphertext,
      iv: ivHex,
      algorithm: 'AES-256-GCM',
    };
  }

  /**
   * 解密数据（AES-256-GCM）
   *
   * @param payload 加密数据包
   * @param encryptionKey 加密密钥
   * @param parseJson 是否自动解析 JSON（默认 true）
   * @returns 解密后的明文数据
   */
  static async decrypt(
    payload: EncryptedPayload,
    encryptionKey: CryptoKey,
    parseJson: boolean = true
  ): Promise<any> {
    // 步骤 1：将 Hex 编码转换回 Uint8Array
    const ciphertextBuffer = new Uint8Array(
      payload.ciphertext.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
    );

    const iv = new Uint8Array(
      payload.iv.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
    );

    // 步骤 2：使用 AES-GCM 解密
    try {
      const plaintextBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: GCM_TAG_LENGTH,
        },
        encryptionKey,
        ciphertextBuffer
      );

      // 步骤 3：转换为字符串
      const plaintextString = new TextDecoder().decode(plaintextBuffer);

      // 步骤 4：尝试解析 JSON（如果失败，返回原始字符串）
      if (parseJson) {
        try {
          return JSON.parse(plaintextString);
        } catch {
          return plaintextString;
        }
      }

      return plaintextString;
    } catch (error) {
      throw new Error('Decryption failed: Invalid key or corrupted data');
    }
  }

  /**
   * 生成随机盐（用于用户注册）
   *
   * @param length 盐的长度（字节数，默认 32）
   * @returns Hex 编码的随机盐
   */
  static generateSalt(length: number = 32): string {
    const buffer = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(buffer)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 生成强随机密码（用于密码管理器）
   *
   * @param length 密码长度（默认 16）
   * @param options 密码选项
   * @returns 随机密码
   */
  static generatePassword(
    length: number = 16,
    options: {
      uppercase?: boolean;
      lowercase?: boolean;
      digits?: boolean;
      symbols?: boolean;
    } = {}
  ): string {
    const {
      uppercase = true,
      lowercase = true,
      digits = true,
      symbols = true,
    } = options;

    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const digitChars = '0123456789';
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let charset = '';
    if (uppercase) charset += uppercaseChars;
    if (lowercase) charset += lowercaseChars;
    if (digits) charset += digitChars;
    if (symbols) charset += symbolChars;

    if (charset.length === 0) {
      throw new Error('At least one character type must be enabled');
    }

    // 使用加密安全的随机数生成密码
    const randomValues = crypto.getRandomValues(new Uint32Array(length));
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = randomValues[i] % charset.length;
      password += charset[randomIndex];
    }

    return password;
  }

  /**
   * 计算密码强度（0-100）
   *
   * @param password 待评估的密码
   * @returns 密码强度分数（0-100）
   */
  static calculatePasswordStrength(password: string): number {
    // 🔐 强制要求：最少 12 字符，最多 32 字符
    if (password.length < 12 || password.length > 32) {
      return 0; // 不符合长度要求，直接返回 0 分
    }

    let score = 0;

    // 长度加分
    if (password.length >= 12) score += 30; // 12字符基础分
    if (password.length >= 16) score += 10; // 16字符额外分

    // 字符类型加分
    if (/[a-z]/.test(password)) score += 15; // 小写字母
    if (/[A-Z]/.test(password)) score += 15; // 大写字母
    if (/\d/.test(password)) score += 15;    // 数字
    if (/[^a-zA-Z0-9]/.test(password)) score += 15; // 特殊字符

    return Math.min(score, 100);
  }

  /**
   * 计算数据的 SHA-256 哈希（用于 checksum）
   *
   * @param data 待哈希的数据
   * @returns Hex 编码的哈希值
   */
  static async hash(data: string): Promise<string> {
    const buffer = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

/**
 * 密码策略验证
 */
export class PasswordPolicy {
  static readonly MIN_LENGTH = 12;
  static readonly MIN_STRENGTH = 60;

  static validate(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.MIN_LENGTH) {
      errors.push(`密码长度至少 ${this.MIN_LENGTH} 个字符`);
    }

    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }

    if (!/\d/.test(password)) {
      errors.push('密码必须包含数字');
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('密码必须包含特殊字符');
    }

    const strength = CryptoEngine.calculatePasswordStrength(password);
    if (strength < this.MIN_STRENGTH) {
      errors.push(`密码强度不足（当前：${strength}/100，要求：${this.MIN_STRENGTH}/100）`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
