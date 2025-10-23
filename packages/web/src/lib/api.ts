/**
 * API 客户端封装
 * 负责所有与后端的通信
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private onUnauthorized: ((errorCode: string) => void) | null = null;
  private isRefreshing: boolean = false; // 防止重复刷新
  private refreshPromise: Promise<boolean> | null = null; // 共享刷新Promise

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null, expiresAt?: number | null) {
    this.token = token;
    this.tokenExpiresAt = expiresAt || null;
  }

  setRefreshToken(refreshToken: string | null) {
    this.refreshToken = refreshToken;
  }

  /**
   * 设置 401 未授权回调（用于自动登出）
   * @param handler 回调函数，接收错误码参数（UNAUTHORIZED | SESSION_INVALID）
   */
  setUnauthorizedHandler(handler: (errorCode: string) => void) {
    this.onUnauthorized = handler;
  }

  /**
   * 🔐 安全增强：检查 Token 是否即将过期（提前1分钟）
   */
  private isTokenExpiringSoon(): boolean {
    if (!this.tokenExpiresAt) {
      return false;
    }
    const now = Date.now();
    const buffer = 60 * 1000; // 提前1分钟
    return now + buffer >= this.tokenExpiresAt;
  }

  /**
   * 🔐 安全增强：刷新 Access Token
   */
  private async refreshAccessToken(): Promise<boolean> {
    // 如果已经在刷新，等待已有的刷新Promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.refreshToken) {
      console.warn('[API] 无法刷新 Token：缺少 refresh_token');
      return false;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: this.refreshToken }),
        });

        if (!response.ok) {
          console.error('[API] 刷新 Token 失败:', response.status);
          return false;
        }

        const data = await response.json();
        if (data.success && data.data?.token) {
          const expiresAt = Date.now() + (data.data.expires_in || 900) * 1000;
          this.setToken(data.data.token, expiresAt);

          // 同步到 auth-store
          const { useAuthStore } = await import('@/stores/auth-store');
          useAuthStore.getState().setToken(data.data.token, data.data.expires_in);

          console.log('[API] Token 刷新成功');
          return true;
        }

        return false;
      } catch (error) {
        console.error('[API] 刷新 Token 异常:', error);
        return false;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeout: number = 30000 // 默认30秒超时
  ): Promise<ApiResponse<T>> {
    // 🔐 安全增强：Token 即将过期时自动刷新
    if (this.isTokenExpiringSoon() && !endpoint.includes('/auth/refresh')) {
      console.log('[API] Token 即将过期，自动刷新...');
      await this.refreshAccessToken();
    }

    // 🌐 国际化：从 settings-store 获取当前语言
    let currentLanguage = 'zh-CN'; // 默认中文
    try {
      const { useSettingsStore } = await import('@/stores/settings-store');
      currentLanguage = useSettingsStore.getState().language;
    } catch (error) {
      console.warn('[API] 无法获取语言设置，使用默认语言');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept-Language': currentLanguage,
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      // 使用 AbortController 实现超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 处理 401 未授权错误（尝试刷新一次）
      if (response.status === 401 && !endpoint.includes('/auth/refresh')) {
        console.log('[API] 收到 401 错误，尝试刷新 Token...');
        const refreshed = await this.refreshAccessToken();

        if (refreshed) {
          // 刷新成功，重新发起请求
          console.log('[API] Token 刷新成功，重新发起请求');
          return this.request<T>(endpoint, options, timeout);
        }
      }

      // 原有的 401 处理逻辑
      if (response.status === 401) {
        // 尝试解析响应体，获取错误码
        let errorCode = 'UNAUTHORIZED'; // 默认错误码
        let errorMessage = '会话已失效，请重新登录';

        try {
          const errorData = await response.json();
          if (errorData.error?.code) {
            errorCode = errorData.error.code;
            errorMessage = errorData.error.message || errorMessage;
          }
        } catch (e) {
          // 忽略 JSON 解析错误，使用默认值
        }

        // 触发登出回调，传递错误码
        if (this.onUnauthorized) {
          this.onUnauthorized(errorCode);
        }

        return {
          success: false,
          error: {
            code: errorCode,
            message: errorMessage,
          },
        };
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      // 检测是否为超时错误
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: '请求超时，请检查网络连接后重试',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || '网络请求失败',
        },
      };
    }
  }

  // ============================================================================
  // 认证 API
  // ============================================================================

  async getSalt(email: string): Promise<ApiResponse<{ salt: string }>> {
    return this.request('/auth/salt', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async register(
    email: string,
    authHash: string,
    salt: string,
    inviteCode?: string,
    turnstileToken?: string
  ): Promise<ApiResponse<{ user: { id: string; email: string }; salt: string; token: string }>> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        auth_hash: authHash,
        salt,
        invite_code: inviteCode,
        turnstile_token: turnstileToken
      }),
    });
  }

  async login(
    email: string,
    authHash: string,
    deviceId: string,
    deviceName: string,
    turnstileToken?: string
  ): Promise<ApiResponse<{
    user: { id: string; email: string };
    token: string;
    refresh_token?: string;  // 🔐 Refresh Token（7天）
    expires_in?: number;     // 🔐 Access Token 过期时间（秒）
  }>> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        auth_hash: authHash,
        device_id: deviceId,
        device_name: deviceName,
        turnstile_token: turnstileToken
      }),
    });
  }

  // ============================================================================
  // 笔记 API
  // ============================================================================

  async getNotesCount(): Promise<ApiResponse<{ total: number }>> {
    return this.request('/notes/count');
  }

  async getNotes(limit = 50, offset = 0): Promise<
    ApiResponse<{
      notes: any[];
      pagination: { limit: number; offset: number; total: number };
    }>
  > {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    return this.request(`/notes?${params}`);
  }

  async getNote(id: string): Promise<ApiResponse<any>> {
    return this.request(`/notes/${id}`);
  }

  async createNote(data: {
    title?: string;
    encrypted_content: string;
    iv: string;
    auth_tag?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNote(
    id: string,
    data: {
      title?: string;
      encrypted_content?: string;
      iv?: string;
      auth_tag?: string;
      version: number;
    }
  ): Promise<ApiResponse<any>> {
    return this.request(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNote(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.request(`/notes/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // 密码 API
  // ============================================================================

  async getPasswordsCount(): Promise<ApiResponse<{ total: number }>> {
    return this.request('/passwords/count');
  }

  async getPasswords(limit = 50, offset = 0): Promise<
    ApiResponse<{
      passwords: any[];
      pagination: { limit: number; offset: number; total: number };
    }>
  > {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    return this.request(`/passwords?${params}`);
  }

  async createPassword(data: {
    encrypted_site: string;
    encrypted_username: string;
    encrypted_password: string;
    encrypted_recovery?: string;
    encrypted_notes?: string;
    iv: string;
    auth_tag?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/passwords', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePassword(
    id: string,
    data: {
      encrypted_site?: string;
      encrypted_username?: string;
      encrypted_password?: string;
      encrypted_recovery?: string;
      encrypted_notes?: string;
      iv?: string;
      auth_tag?: string;
      version: number;
    }
  ): Promise<ApiResponse<any>> {
    return this.request(`/passwords/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePassword(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.request(`/passwords/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // 设备管理 API
  // ============================================================================

  /**
   * 获取设备列表
   */
  async getSessions(): Promise<ApiResponse<{
    sessions: Array<{
      id: string;
      device_name: string | null;
      device_type: string | null;
      browser_name: string | null;
      os_name: string | null;
      ip_address: string | null;
      location: string | null;
      is_active: boolean;
      is_current: boolean;
      created_at: number;
    }>;
    max_devices: number;
  }>> {
    return this.request('/sessions', {
      method: 'GET',
    });
  }

  /**
   * 远程登出其他设备
   * @param sessionId 会话 ID
   */
  async revokeSession(sessionId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * 当前设备登出
   */
  async logout(): Promise<ApiResponse<{ message: string }>> {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  /**
   * 心跳检测（用于检测会话是否有效）
   */
  async heartbeat(): Promise<ApiResponse<{ user_id: string; session_id: string; timestamp: number }>> {
    return this.request('/auth/heartbeat', {
      method: 'GET',
    });
  }

  /**
   * 更新用户昵称（端到端加密）
   */
  async updateNickname(encrypted_nickname: string, nickname_iv: string): Promise<ApiResponse<{ user: any }>> {
    return this.request('/users/nickname', {
      method: 'PUT',
      body: JSON.stringify({ encrypted_nickname, nickname_iv }),
    });
  }

  // ============================================================================
  // 邀请码管理 API（站长专用）
  // ============================================================================

  /**
   * 验证管理员密码
   */
  async verifyAdminPassword(password: string): Promise<ApiResponse<{ message: string; expires_at: number }>> {
    return this.request('/admin/verify', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  /**
   * 创建邀请码
   */
  async createInviteCode(data: {
    code: string;
    max_uses?: number;
    expires_at?: number | null;
    note?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/admin/invite-codes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 获取邀请码列表
   */
  async getInviteCodes(limit = 100, offset = 0): Promise<ApiResponse<{
    invite_codes: any[];
    pagination: { limit: number; offset: number; total: number };
  }>> {
    return this.request(`/admin/invite-codes?limit=${limit}&offset=${offset}`, {
      method: 'GET',
    });
  }

  /**
   * 更新邀请码
   */
  async updateInviteCode(id: string, data: {
    max_uses?: number;
    expires_at?: number | null;
    is_active?: number;
    note?: string;
  }): Promise<ApiResponse<any>> {
    return this.request(`/admin/invite-codes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * 删除邀请码
   */
  async deleteInviteCode(id: string): Promise<ApiResponse<{ id: string }>> {
    return this.request(`/admin/invite-codes/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 获取用户列表（管理员功能）
   */
  async getUsers(): Promise<ApiResponse<{
    users: Array<{
      id: string;
      email: string;
      created_at: number;
      updated_at: number;
      notes_count: number;
      passwords_count: number;
      devices_count: number;
    }>;
    total: number;
  }>> {
    return this.request('/admin/users', {
      method: 'GET',
    });
  }

  /**
   * 删除用户（管理员功能）
   */
  async deleteUser(userId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  /**
   * 获取数据库统计信息（管理员功能）
   */
  async getAdminStats(password: string): Promise<ApiResponse<{
    total: {
      users: number;
      notes: number;
      passwords: number;
      sessions: number;
      invite_codes: number;
    };
    active: {
      sessions: number;
      invite_codes: number;
    };
    expired: {
      sessions: number;
      invite_codes: number;
    };
    inactive: {
      sessions: number;
    };
    storage: {
      actualUsageMB: number;
      actualUsageBytes: number;
      limitMB: number;
      usagePercent: number;
      status: 'normal' | 'warning' | 'critical';
    };
    quota: {
      notes: {
        softLimit: number;
        hardLimit: number;
        usersNearSoftLimit: number;
        usersAtSoftLimit: number;
        usersAtHardLimit: number;
      };
      passwords: {
        softLimit: number;
        hardLimit: number;
        usersNearSoftLimit: number;
        usersAtSoftLimit: number;
        usersAtHardLimit: number;
      };
    };
  }>> {
    return this.request('/admin/stats', {
      method: 'GET',
      headers: {
        'X-Admin-Password': password,
      },
    });
  }

  /**
   * 手动触发数据清理（管理员功能）
   */
  async cleanupData(password: string): Promise<ApiResponse<{
    cleaned: {
      expired_sessions: number;
      inactive_sessions: number;
      expired_invite_codes: number;
    };
    message: string;
  }>> {
    return this.request('/admin/cleanup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }
}

export const api = new ApiClient();
