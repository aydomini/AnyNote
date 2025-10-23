/**
 * 设备指纹工具
 * 使用 FingerprintJS 生成浏览器唯一指纹
 *
 * 用途：防止 IndexedDB 密钥在不同设备间被复制
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<string> | null = null;

/**
 * 获取设备指纹（缓存结果，避免重复计算）
 * @returns 设备指纹字符串（64字符 SHA-256 哈希）
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (fpPromise) {
    return fpPromise;
  }

  fpPromise = (async () => {
    try {
      // 加载 FingerprintJS 库
      const fp = await FingerprintJS.load();

      // 生成指纹
      const result = await fp.get();

      // 返回 visitorId（稳定的设备标识）
      return result.visitorId;
    } catch (error) {
      console.error('[DeviceFingerprint] 生成设备指纹失败', error);
      // 降级方案：使用 userAgent + 屏幕尺寸 + 语言 生成简易指纹
      const fallbackData = `${navigator.userAgent}-${screen.width}x${screen.height}-${navigator.language}`;
      const buffer = new TextEncoder().encode(fallbackData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  })();

  return fpPromise;
}

/**
 * 验证设备指纹是否匹配
 * @param storedFingerprint 存储的设备指纹
 * @returns 是否匹配
 */
export async function verifyDeviceFingerprint(storedFingerprint: string): Promise<boolean> {
  const currentFingerprint = await getDeviceFingerprint();
  return currentFingerprint === storedFingerprint;
}
