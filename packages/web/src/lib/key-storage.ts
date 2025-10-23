/**
 * IndexedDB 密钥存储管理器
 * 用于持久化存储加密密钥（"记住我7天"功能）
 */

import { openDB, type IDBPDatabase } from 'idb';
import { getDeviceFingerprint, verifyDeviceFingerprint } from './device-fingerprint';

const DB_NAME = 'anynote-keys';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

interface KeyEntry {
  deviceId: string;
  wrappedKey: ArrayBuffer;  // 加密密钥被包装密钥加密后的结果
  iv: Uint8Array;           // 解包装时需要的 IV
  expiresAt: number;        // 过期时间戳（毫秒）
  fingerprint: string;      // 设备指纹（防止密钥在不同设备间被复制）
}

/**
 * 打开 IndexedDB 数据库
 */
async function getDB(): Promise<IDBPDatabase<any>> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db: IDBPDatabase<any>) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'deviceId' });
      }
    },
  });
}

/**
 * 生成包装密钥（用于包装实际的加密密钥）
 * 包装密钥存储在 IndexedDB 中，extractable: false 保证安全性
 */
async function generateWrappingKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // extractable: false - 无法导出
    ['wrapKey', 'unwrapKey']
  );
}

/**
 * 获取或创建包装密钥
 */
async function getWrappingKey(): Promise<CryptoKey> {
  const db = await getDB();
  const wrappingKeyData = await db.get(STORE_NAME, '__wrapping_key__');

  if (wrappingKeyData && wrappingKeyData.wrappingKey) {
    // 从 IndexedDB 恢复包装密钥
    return wrappingKeyData.wrappingKey;
  }

  // 生成新的包装密钥并保存到 IndexedDB
  const wrappingKey = await generateWrappingKey();
  await db.put(STORE_NAME, {
    deviceId: '__wrapping_key__',
    wrappingKey,
    expiresAt: 0, // 包装密钥不过期
  });

  return wrappingKey;
}

/**
 * 保存加密密钥到 IndexedDB（使用包装密钥加密）
 * @param deviceId 设备 ID
 * @param key 要保存的加密密钥
 * @param expiresAt 过期时间戳（毫秒）
 */
export async function saveEncryptionKey(
  deviceId: string,
  key: CryptoKey,
  expiresAt: number
): Promise<void> {
  const db = await getDB();
  const wrappingKey = await getWrappingKey();

  // 生成随机 IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 使用包装密钥包装加密密钥
  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',
    key,
    wrappingKey,
    {
      name: 'AES-GCM',
      iv,
    }
  );

  // 获取设备指纹
  const fingerprint = await getDeviceFingerprint();

  // 保存到 IndexedDB
  const entry: KeyEntry = {
    deviceId,
    wrappedKey,
    iv,
    expiresAt,
    fingerprint, // 保存设备指纹
  };

  await db.put(STORE_NAME, entry);
}

/**
 * 从 IndexedDB 获取加密密钥（自动检查过期）
 * @param deviceId 设备 ID
 * @returns 加密密钥（如果存在且未过期），否则返回 null
 */
export async function getEncryptionKey(deviceId: string): Promise<CryptoKey | null> {
  const db = await getDB();
  const entry = await db.get(STORE_NAME, deviceId) as KeyEntry | undefined;

  if (!entry) {
    return null;
  }

  // 检查是否过期
  if (Date.now() > entry.expiresAt) {
    // 过期，删除并返回 null
    await db.delete(STORE_NAME, deviceId);
    return null;
  }

  // 🔐 安全增强：验证设备指纹（防止密钥在不同设备间被复制）
  if (entry.fingerprint) {
    const fingerprintMatches = await verifyDeviceFingerprint(entry.fingerprint);
    if (!fingerprintMatches) {
      console.warn('[KeyStorage] 设备指纹验证失败，密钥可能被复制到其他设备');
      // 删除无效密钥
      await db.delete(STORE_NAME, deviceId);
      return null;
    }
  }

  // 解包装密钥
  const wrappingKey = await getWrappingKey();

  try {
    // 确保 IV 是正确的类型
    const iv = new Uint8Array(entry.iv);

    const unwrappedKey = await crypto.subtle.unwrapKey(
      'raw',
      entry.wrappedKey,
      wrappingKey,
      {
        name: 'AES-GCM',
        iv: iv,
      },
      {
        name: 'AES-GCM',
        length: 256,
      },
      false, // extractable: false - 保持安全性
      ['encrypt', 'decrypt']
    );

    return unwrappedKey;
  } catch (error) {
    console.error('解包装密钥失败:', error);
    // 解包装失败，删除损坏的条目
    await db.delete(STORE_NAME, deviceId);
    return null;
  }
}

/**
 * 清除指定设备的加密密钥
 * @param deviceId 设备 ID
 */
export async function clearEncryptionKey(deviceId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, deviceId);
}

/**
 * 清除所有设备的加密密钥（登出时使用）
 */
export async function clearAllKeys(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).clear();
  await tx.done;
}

/**
 * 获取密钥过期时间
 * @param deviceId 设备 ID
 * @returns 过期时间戳（毫秒），如果不存在返回 null
 */
export async function getKeyExpiry(deviceId: string): Promise<number | null> {
  const db = await getDB();
  const entry = await db.get(STORE_NAME, deviceId) as KeyEntry | undefined;

  if (!entry) {
    return null;
  }

  return entry.expiresAt;
}

/**
 * 检查是否有有效的持久化密钥
 * @param deviceId 设备 ID
 * @returns true 如果存在且未过期，否则 false
 */
export async function hasValidKey(deviceId: string): Promise<boolean> {
  const db = await getDB();
  const entry = await db.get(STORE_NAME, deviceId) as KeyEntry | undefined;

  if (!entry) {
    return false;
  }

  // 检查是否过期
  return Date.now() <= entry.expiresAt;
}
