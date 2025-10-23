/**
 * 设备 ID 管理
 * 生成并持久化客户端唯一标识符
 */

const STORAGE_KEY = 'anynote-device-id';

/**
 * 获取或创建设备 ID
 * @returns UUID v4 格式的设备 ID
 */
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(STORAGE_KEY);

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, deviceId);
  }

  return deviceId;
}

/**
 * 生成设备显示名称
 * @returns 如 "💻 Chrome (macOS) - 10/19" 或 "📱 Safari (iOS) - 10/19"
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent;

  // 设备图标
  let icon = '💻';  // 默认桌面端

  // 浏览器检测
  let browser = 'Unknown Browser';
  if (ua.includes('Edg/') || ua.includes('Edge/')) {
    browser = 'Edge';
  } else if (ua.includes('Chrome/') && !ua.includes('Chromium')) {
    browser = 'Chrome';
  } else if (ua.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari';
  } else if (ua.includes('Opera/') || ua.includes('OPR/')) {
    browser = 'Opera';
  }

  // 操作系统检测（含移动端）
  let os = 'Unknown OS';

  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
    icon = '📱';
    os = 'iOS';
    const match = ua.match(/OS (\d+)[._]\d+/);
    if (match) {
      os = `iOS ${match[1]}`;
    }
  } else if (ua.includes('Android')) {
    icon = '📱';
    os = 'Android';
    const match = ua.match(/Android (\d+(?:\.\d+)?)/);
    if (match) {
      os = `Android ${match[1]}`;
    }
  } else if (ua.includes('Windows')) {
    os = 'Windows';
    if (ua.includes('Windows NT 10.0')) {
      os = 'Windows 10/11';
    }
  } else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) {
    os = 'macOS';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  }

  // 当前日期（MM/DD 格式）
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const date = `${month}/${day}`;

  return `${icon} ${browser} (${os}) - ${date}`;
}

/**
 * 清除设备 ID（用于测试或重置）
 */
export function clearDeviceId(): void {
  localStorage.removeItem(STORAGE_KEY);
}
