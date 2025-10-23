/**
 * 加密引擎封装
 * 提供简化的加密/解密接口
 */

import { CryptoEngine, type EncryptedPayload } from '@anynote/shared/crypto/crypto-engine';

/**
 * 加密存储管理器
 */
export class CryptoManager {
  private encryptionKey: CryptoKey | null = null;

  /**
   * 初始化加密管理器（注册时）
   */
  async initialize(masterPassword: string, email: string): Promise<{
    salt: string;
    authHash: string;
  }> {
    // 生成随机盐
    const salt = CryptoEngine.generateSalt();

    // 派生密钥
    const { encryptionKey, authHash } = await CryptoEngine.deriveKeys(
      masterPassword,
      email,
      salt
    );

    // 保存加密密钥到内存
    this.encryptionKey = encryptionKey;

    // 保存盐值到 localStorage
    localStorage.setItem(`anynote_salt_${email}`, salt);

    return { salt, authHash };
  }

  /**
   * 从已有盐值恢复（登录时）
   */
  async restore(masterPassword: string, email: string, salt: string): Promise<string> {
    // 派生密钥
    const { encryptionKey, authHash } = await CryptoEngine.deriveKeys(
      masterPassword,
      email,
      salt
    );

    // 保存加密密钥到内存
    this.encryptionKey = encryptionKey;

    return authHash;
  }

  /**
   * 获取盐值（从 localStorage）
   */
  getSalt(email: string): string | null {
    return localStorage.getItem(`anynote_salt_${email}`);
  }

  /**
   * 清除所有加密数据
   */
  clear() {
    this.encryptionKey = null;
  }

  /**
   * 加密数据
   */
  async encrypt(data: any): Promise<EncryptedPayload> {
    if (!this.encryptionKey) {
      throw new Error('加密密钥未初始化，请先登录');
    }

    return CryptoEngine.encrypt(data, this.encryptionKey);
  }

  /**
   * 解密数据
   */
  async decrypt(payload: EncryptedPayload, parseJson = true): Promise<any> {
    if (!this.encryptionKey) {
      throw new Error('加密密钥未初始化，请先登录');
    }

    return CryptoEngine.decrypt(payload, this.encryptionKey, parseJson);
  }

  /**
   * 生成随机密码
   */
  generatePassword(length = 16, options?: {
    uppercase?: boolean;
    lowercase?: boolean;
    digits?: boolean;
    symbols?: boolean;
  }): string {
    return CryptoEngine.generatePassword(length, options || {
      uppercase: true,
      lowercase: true,
      digits: true,
      symbols: true,
    });
  }

  /**
   * 计算密码强度
   */
  calculatePasswordStrength(password: string): number {
    return CryptoEngine.calculatePasswordStrength(password);
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * 获取加密密钥（用于持久化存储）
   */
  getEncryptionKey(): CryptoKey | null {
    return this.encryptionKey;
  }

  /**
   * 设置加密密钥（用于从持久化存储恢复）
   */
  setEncryptionKey(key: CryptoKey): void {
    this.encryptionKey = key;
  }
}

// 全局单例
export const crypto = new CryptoManager();
