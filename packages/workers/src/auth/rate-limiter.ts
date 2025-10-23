/**
 * 速率限制服务
 *
 * 功能：
 * 1. 单次密码错误：5秒等待
 * 2. 1小时内5次失败：封禁2小时
 * 3. IP 全局限制：1小时内10次登录尝试
 * 4. 使用 KV 存储状态
 */

import type { Env } from '../types';

interface RateLimitState {
  failureCount: number;      // 失败次数
  firstFailureAt: number;     // 首次失败时间
  lastFailureAt: number;      // 最后失败时间
  banUntil?: number;          // 封禁到期时间
}

interface IPRateLimitState {
  attemptCount: number;       // 尝试次数
  firstAttemptAt: number;     // 首次尝试时间
  lastAttemptAt: number;      // 最后尝试时间
}

export class RateLimiter {
  private kv: KVNamespace;

  constructor(env: Env) {
    this.kv = env.RATE_LIMIT;
  }

  /**
   * 生成 KV 键名（基于邮箱）
   */
  private getKey(email: string): string {
    return `login:${email}`;
  }

  /**
   * 检查是否被封禁
   * @returns { isBanned: boolean, banUntil?: number, waitSeconds?: number }
   */
  async checkRateLimit(email: string): Promise<{
    allowed: boolean;
    reason?: string;
    waitSeconds?: number;
    banUntil?: number;
  }> {
    const key = this.getKey(email);
    const stateJson = await this.kv.get(key);

    if (!stateJson) {
      // 首次登录，允许
      return { allowed: true };
    }

    const state: RateLimitState = JSON.parse(stateJson);
    const now = Date.now();

    // 检查是否处于封禁期
    if (state.banUntil && now < state.banUntil) {
      const waitSeconds = Math.ceil((state.banUntil - now) / 1000);
      return {
        allowed: false,
        reason: 'ACCOUNT_BANNED',
        waitSeconds,
        banUntil: state.banUntil,
      };
    }

    // 检查是否在5秒冷却期内（上次失败后5秒内不允许再次尝试）
    if (state.lastFailureAt && (now - state.lastFailureAt) < 5000) {
      const waitSeconds = Math.ceil((5000 - (now - state.lastFailureAt)) / 1000);
      return {
        allowed: false,
        reason: 'TOO_FREQUENT',
        waitSeconds,
      };
    }

    // 允许尝试
    return { allowed: true };
  }

  /**
   * 记录登录失败
   */
  async recordFailure(email: string): Promise<void> {
    const key = this.getKey(email);
    const stateJson = await this.kv.get(key);
    const now = Date.now();

    let state: RateLimitState;

    if (!stateJson) {
      // 首次失败
      state = {
        failureCount: 1,
        firstFailureAt: now,
        lastFailureAt: now,
      };
    } else {
      state = JSON.parse(stateJson);

      // 如果距离首次失败超过1小时，重置计数器
      if (now - state.firstFailureAt > 3600000) {
        state = {
          failureCount: 1,
          firstFailureAt: now,
          lastFailureAt: now,
        };
      } else {
        // 累加失败次数
        state.failureCount += 1;
        state.lastFailureAt = now;

        // 达到5次失败，封禁2小时
        if (state.failureCount >= 5) {
          state.banUntil = now + 7200000; // 2小时后
        }
      }
    }

    // 写入 KV，设置 TTL 为 3 小时（封禁2小时 + 1小时缓冲）
    await this.kv.put(key, JSON.stringify(state), {
      expirationTtl: 10800, // 3小时
    });
  }

  /**
   * 记录登录成功（清除失败记录）
   */
  async recordSuccess(email: string): Promise<void> {
    const key = this.getKey(email);
    await this.kv.delete(key);
  }

  /**
   * 获取当前状态（用于调试）
   */
  async getState(email: string): Promise<RateLimitState | null> {
    const key = this.getKey(email);
    const stateJson = await this.kv.get(key);
    return stateJson ? JSON.parse(stateJson) : null;
  }

  /**
   * 🔐 安全增强：IP 全局速率限制
   * 检查 IP 是否超过限制（1小时内最多10次登录尝试）
   */
  async checkIPRateLimit(ip: string): Promise<{
    allowed: boolean;
    reason?: string;
    waitSeconds?: number;
  }> {
    const key = `ip:${ip}`;
    const stateJson = await this.kv.get(key);

    if (!stateJson) {
      // 首次尝试，允许
      return { allowed: true };
    }

    const state: IPRateLimitState = JSON.parse(stateJson);
    const now = Date.now();

    // 检查是否在1小时内超过10次
    if ((now - state.firstAttemptAt) < 3600000 && state.attemptCount >= 10) {
      const waitSeconds = Math.ceil((3600000 - (now - state.firstAttemptAt)) / 1000);
      return {
        allowed: false,
        reason: 'IP_RATE_LIMIT',
        waitSeconds,
      };
    }

    // 允许尝试
    return { allowed: true };
  }

  /**
   * 🔐 安全增强：记录 IP 登录尝试
   */
  async recordIPAttempt(ip: string): Promise<void> {
    const key = `ip:${ip}`;
    const stateJson = await this.kv.get(key);
    const now = Date.now();

    let state: IPRateLimitState;

    if (!stateJson) {
      // 首次尝试
      state = {
        attemptCount: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      };
    } else {
      state = JSON.parse(stateJson);

      // 如果距离首次尝试超过1小时，重置计数器
      if (now - state.firstAttemptAt > 3600000) {
        state = {
          attemptCount: 1,
          firstAttemptAt: now,
          lastAttemptAt: now,
        };
      } else {
        // 累加尝试次数
        state.attemptCount += 1;
        state.lastAttemptAt = now;
      }
    }

    // 写入 KV，设置 TTL 为 2 小时（1小时窗口 + 1小时缓冲）
    await this.kv.put(key, JSON.stringify(state), {
      expirationTtl: 7200, // 2小时
    });
  }

  /**
   * 🔐 管理员密码验证速率限制
   * 生成 KV 键名（基于 IP）
   */
  private getAdminKey(ip: string): string {
    return `admin:${ip}`;
  }

  /**
   * 🔐 管理员密码验证：检查速率限制
   * 规则：5次失败封禁2小时
   */
  async checkAdminRateLimit(ip: string): Promise<{
    allowed: boolean;
    reason?: string;
    waitSeconds?: number;
    banUntil?: number;
    failureCount?: number;
  }> {
    const key = this.getAdminKey(ip);
    const stateJson = await this.kv.get(key);

    if (!stateJson) {
      // 首次验证，允许
      return { allowed: true };
    }

    const state: RateLimitState = JSON.parse(stateJson);
    const now = Date.now();

    // 检查是否处于封禁期
    if (state.banUntil && now < state.banUntil) {
      const waitSeconds = Math.ceil((state.banUntil - now) / 1000);
      return {
        allowed: false,
        reason: 'ADMIN_BANNED',
        waitSeconds,
        banUntil: state.banUntil,
        failureCount: state.failureCount,
      };
    }

    // 允许尝试，返回当前失败次数
    return {
      allowed: true,
      failureCount: state.failureCount || 0,
    };
  }

  /**
   * 🔐 管理员密码验证：记录失败
   */
  async recordAdminFailure(ip: string): Promise<void> {
    const key = this.getAdminKey(ip);
    const stateJson = await this.kv.get(key);
    const now = Date.now();

    let state: RateLimitState;

    if (!stateJson) {
      // 首次失败
      state = {
        failureCount: 1,
        firstFailureAt: now,
        lastFailureAt: now,
      };
    } else {
      state = JSON.parse(stateJson);

      // 如果距离首次失败超过1小时，重置计数器
      if (now - state.firstFailureAt > 3600000) {
        state = {
          failureCount: 1,
          firstFailureAt: now,
          lastFailureAt: now,
        };
      } else {
        // 累加失败次数
        state.failureCount += 1;
        state.lastFailureAt = now;

        // 达到5次失败，封禁2小时
        if (state.failureCount >= 5) {
          state.banUntil = now + 7200000; // 2小时后
        }
      }
    }

    // 写入 KV，设置 TTL 为 3 小时（封禁2小时 + 1小时缓冲）
    await this.kv.put(key, JSON.stringify(state), {
      expirationTtl: 10800, // 3小时
    });
  }

  /**
   * 🔐 管理员密码验证：记录成功（清除失败记录）
   */
  async recordAdminSuccess(ip: string): Promise<void> {
    const key = this.getAdminKey(ip);
    await this.kv.delete(key);
  }
}
