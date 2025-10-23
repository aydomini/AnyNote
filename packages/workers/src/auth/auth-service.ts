import type { Env, CreateUserInput } from '../types';
import { UserRepository } from '../db/user-repository';
import {
  isValidEmail,
  generateSalt,
  constantTimeCompare,
  signJWT,
  verifyJWT,
} from '../utils/helpers';
import {
  isValidLength,
  isValidHex,
  containsDangerousChars,
} from '../utils/input-validator';

/**
 * 零知识认证服务
 */
export class AuthService {
  constructor(private env: Env) {
    // 强制验证 JWT_SECRET 是否已设置（安全要求）
    if (!this.env.JWT_SECRET || this.env.JWT_SECRET === 'default-secret-change-in-production') {
      throw new Error('FATAL: JWT_SECRET is not set in environment. Refusing to start for security reasons.');
    }
  }

  /**
   * 用户注册
   *
   * 流程：
   * 1. 验证邮箱格式和唯一性
   * 2. 客户端已派生 auth_hash（服务端无法获取主密码）
   * 3. 客户端传入盐值（用于派生密钥）
   * 4. 返回用户信息（不含敏感数据）
   */
  async register(email: string, authHash: string, salt: string): Promise<{
    user: { id: string; email: string };
    salt: string;
    token: string;
  }> {
    // 验证邮箱格式和长度（12-32 字符）
    if (!isValidEmail(email)) {
      if (email.length < 12) {
        throw new Error('邮箱地址过短，最少 12 个字符');
      } else if (email.length > 32) {
        throw new Error('邮箱地址过长，最多 32 个字符');
      }
      throw new Error('邮箱格式无效');
    }

    // 验证邮箱是否包含危险字符
    if (containsDangerousChars(email)) {
      throw new Error('Email contains invalid characters');
    }

    // 验证 auth_hash 格式（应为十六进制字符串）
    if (!isValidHex(authHash) || !isValidLength(authHash, 64, 256)) {
      throw new Error('Invalid auth_hash format');
    }

    // 验证 salt 格式（应为十六进制字符串）
    if (!isValidHex(salt) || !isValidLength(salt, 32, 64)) {
      throw new Error('Invalid salt format');
    }

    const userRepo = new UserRepository(this.env.DB);

    // 检查邮箱是否已存在
    if (await userRepo.emailExists(email)) {
      throw new Error('Email already exists');
    }

    // 使用客户端传入的盐值（确保前后端一致）
    // 注意：盐值由客户端生成，用于派生加密密钥和认证哈希

    // 创建用户
    const input: CreateUserInput = {
      email,
      auth_hash: authHash,
      salt,
    };

    const user = await userRepo.create(input);

    // 生成 JWT Token（JWT_SECRET 在构造函数中已验证，保证非空）
    const token = await signJWT(
      { user_id: user.id, email: user.email },
      this.env.JWT_SECRET!,
      this.env.JWT_EXPIRES_IN
    );

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      salt,
      token,
    };
  }

  /**
   * 用户登录
   *
   * 流程：
   * 1. 根据邮箱查找用户
   * 2. 获取用户的盐值
   * 3. 客户端使用盐值派生 auth_hash
   * 4. 服务端验证 auth_hash（常量时间比较）
   * 5. 返回 JWT Token
   */
  async login(email: string, authHash: string): Promise<{
    user: { id: string; email: string; encrypted_nickname?: string; nickname_iv?: string };
    token: string;
  }> {
    // 验证邮箱格式和长度（12-32 字符）
    if (!isValidEmail(email)) {
      if (email.length < 12) {
        throw new Error('邮箱地址过短，最少 12 个字符');
      } else if (email.length > 32) {
        throw new Error('邮箱地址过长，最多 32 个字符');
      }
      throw new Error('邮箱格式无效');
    }

    // 验证邮箱是否包含危险字符
    if (containsDangerousChars(email)) {
      throw new Error('Email contains invalid characters');
    }

    // 验证 auth_hash 格式
    if (!isValidHex(authHash) || !isValidLength(authHash, 64, 256)) {
      throw new Error('Invalid auth_hash format');
    }

    const userRepo = new UserRepository(this.env.DB);

    // 查找用户
    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // 验证 auth_hash（使用常量时间比较防止时序攻击）
    if (!constantTimeCompare(user.auth_hash, authHash)) {
      throw new Error('Invalid email or password');
    }

    // 生成 JWT Token（JWT_SECRET 在构造函数中已验证，保证非空）
    const token = await signJWT(
      { user_id: user.id, email: user.email },
      this.env.JWT_SECRET!,
      this.env.JWT_EXPIRES_IN
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        encrypted_nickname: user.encrypted_nickname || undefined,
        nickname_iv: user.nickname_iv || undefined,
      },
      token,
    };
  }

  /**
   * 获取用户的盐值（用于登录前的密钥派生）
   */
  async getSalt(email: string): Promise<string> {
    const userRepo = new UserRepository(this.env.DB);

    const user = await userRepo.findByEmail(email);
    if (!user) {
      // 安全提示：即使用户不存在，也返回随机盐（防止用户枚举）
      // 但标记为无效，客户端可选择是否提示用户
      return generateSalt(32);
    }

    return user.salt;
  }

  /**
   * 验证 JWT Token 并返回用户信息
   */
  async verifyToken(token: string): Promise<{ user_id: string; email: string }> {
    try {
      const payload = await verifyJWT(token, this.env.JWT_SECRET!);
      return {
        user_id: payload.user_id,
        email: payload.email,
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
}
