import type { Env } from '../types';

/**
 * Cloudflare Turnstile 验证服务
 * 文档：https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export class TurnstileVerifier {
  private secretKey: string;

  constructor(env: Env) {
    // 从环境变量获取密钥
    this.secretKey = env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA'; // 测试密钥
  }

  /**
   * 验证 Turnstile token
   * @param token 前端返回的 token
   * @param remoteip 可选：用户 IP 地址
   * @returns 验证是否成功
   */
  async verify(token: string, remoteip?: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!token) {
      return {
        success: false,
        error: 'Token is required',
      };
    }

    try {
      // 调用 Cloudflare Siteverify API
      const formData = new FormData();
      formData.append('secret', this.secretKey);
      formData.append('response', token);
      if (remoteip) {
        formData.append('remoteip', remoteip);
      }

      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json() as TurnstileResponse;

      if (!data.success) {
        const errorCodes = data['error-codes'] || [];
        return {
          success: false,
          error: `Turnstile verification failed: ${errorCodes.join(', ')}`,
        };
      }

      return {
        success: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Turnstile verification error: ${error.message}`,
      };
    }
  }
}
