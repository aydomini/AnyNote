/**
 * User-Agent Parser
 * 从 User-Agent 字符串解析设备信息
 *
 * 使用简单正则解析，无需外部依赖
 * 适用于 Cloudflare Workers 环境
 */

import type { DeviceInfo } from '../types';

/**
 * 解析 User-Agent 字符串
 * @param ua User-Agent 字符串
 * @returns 设备信息
 */
export function parseUserAgent(ua: string): DeviceInfo {
  // 设备类型检测
  let deviceType: 'mobile' | 'tablet' | 'desktop' | null = 'desktop';
  if (/Mobile|Android|iPhone/.test(ua)) {
    deviceType = 'mobile';
  } else if (/iPad|Tablet/.test(ua)) {
    deviceType = 'tablet';
  }

  // 浏览器检测（优先匹配具体浏览器，避免 Chrome 误识别）
  let browserName = 'Unknown Browser';
  let browserVersion = '';

  if (ua.includes('Edg/') || ua.includes('Edge/')) {
    browserName = 'Edge';
    const match = ua.match(/Edg?\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('Chrome/') && !ua.includes('Chromium')) {
    browserName = 'Chrome';
    const match = ua.match(/Chrome\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('Firefox/')) {
    browserName = 'Firefox';
    const match = ua.match(/Firefox\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browserName = 'Safari';
    const match = ua.match(/Version\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('Opera/') || ua.includes('OPR/')) {
    browserName = 'Opera';
    const match = ua.match(/(?:Opera|OPR)\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : '';
  }

  // 操作系统检测（优先检测移动端，避免 iOS 被误识别为 macOS）
  let osName = 'Unknown OS';
  let osVersion = '';

  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
    // iOS 设备（必须优先检测，因为 iOS Safari 的 UA 也包含 "Mac OS X"）
    osName = 'iOS';
    const match = ua.match(/OS (\d+[._]\d+)/);
    if (match) {
      osVersion = match[1].replace('_', '.');
    }
  } else if (ua.includes('Android')) {
    osName = 'Android';
    const match = ua.match(/Android (\d+(?:\.\d+)?)/);
    osVersion = match ? match[1] : '';
  } else if (ua.includes('Windows')) {
    osName = 'Windows';
    if (ua.includes('Windows NT 10.0')) {
      osVersion = '10/11';
    } else if (ua.includes('Windows NT 6.3')) {
      osVersion = '8.1';
    } else if (ua.includes('Windows NT 6.2')) {
      osVersion = '8';
    } else if (ua.includes('Windows NT 6.1')) {
      osVersion = '7';
    }
  } else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) {
    osName = 'macOS';
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    if (match) {
      osVersion = match[1].replace('_', '.');
    }
  } else if (ua.includes('Linux')) {
    osName = 'Linux';
  }

  return {
    device: { type: deviceType },
    browser: { name: browserName, version: browserVersion },
    os: { name: osName, version: osVersion },
  };
}

/**
 * 生成友好的设备名称
 * @param deviceInfo 设备信息
 * @returns 设备显示名称（如 "💻 Chrome (macOS 14.2) - 10/19"）
 */
export function generateDeviceName(deviceInfo: DeviceInfo): string {
  // 设备图标
  const icon = deviceInfo.device.type === 'mobile' ? '📱' :
               deviceInfo.device.type === 'tablet' ? '📱' : '💻';

  // 浏览器名称
  const browser = deviceInfo.browser.name;

  // 操作系统名称（含版本）
  const os = deviceInfo.os.version
    ? `${deviceInfo.os.name} ${deviceInfo.os.version}`
    : deviceInfo.os.name;

  // 当前日期（MM/DD 格式）
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const date = `${month}/${day}`;

  return `${icon} ${browser} (${os}) - ${date}`;
}
