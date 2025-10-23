import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

interface User {
  id: string;
  user_id: string;
  email: string;
  encrypted_nickname?: string;  // 加密后的昵称（端到端加密）
  nickname_iv?: string;          // 昵称加密的初始化向量
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  refreshToken: string | null;       // 🔐 Refresh Token（7天有效期）
  tokenExpiresAt: number | null;     // 🔐 Access Token 过期时间（Unix 毫秒时间戳）

  login: (user: User, token: string, refreshToken?: string, expiresIn?: number) => void;
  logout: () => void;
  setToken: (token: string, expiresIn?: number) => void;
  updateUserNickname: (nickname: { encrypted_nickname: string; nickname_iv: string } | null) => void;  // 更新用户昵称（加密）
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      tokenExpiresAt: null,

      login: (user, token, refreshToken, expiresIn) => {
        const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;
        set({
          isAuthenticated: true,
          user,
          token,
          refreshToken: refreshToken || null,
          tokenExpiresAt: expiresAt,
        });
      },

      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          refreshToken: null,
          tokenExpiresAt: null,
        });
        // 仅清空认证数据，保留主题设置等其他数据
        localStorage.removeItem('anynote-auth-storage');
      },

      setToken: (token, expiresIn) => {
        const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;
        set({ token, tokenExpiresAt: expiresAt });
      },

      updateUserNickname: (nickname) => {
        set((state) => ({
          user: state.user ? {
            ...state.user,
            encrypted_nickname: nickname?.encrypted_nickname || undefined,
            nickname_iv: nickname?.nickname_iv || undefined,
          } : null,
        }));
      },
    }),
    {
      name: 'anynote-auth-storage',
      // 💡 关键修复：Zustand 从 localStorage 恢复数据后，同步 token 和 refresh_token 到 api 客户端
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.setToken(state.token, state.tokenExpiresAt);
        }
        if (state?.refreshToken) {
          api.setRefreshToken(state.refreshToken);
        }
      },
    }
  )
);
