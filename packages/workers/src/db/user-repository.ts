import type { D1Database } from '@cloudflare/workers-types';
import type { User, CreateUserInput } from '../types';
import { generateUUID, getCurrentTimestamp } from '../utils/helpers';

/**
 * 用户仓储层（User Repository）
 * 负责与 D1 数据库交互，处理用户相关的 CRUD 操作
 */
export class UserRepository {
  constructor(private db: D1Database) {}

  /**
   * 创建新用户
   */
  async create(input: CreateUserInput): Promise<User> {
    const id = generateUUID();
    const timestamp = getCurrentTimestamp();

    const result = await this.db
      .prepare(
        `INSERT INTO users (id, email, auth_hash, salt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.email.toLowerCase(),  // 邮箱统一小写存储
        input.auth_hash,
        input.salt,
        timestamp,
        timestamp
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to create user');
    }

    return {
      id,
      email: input.email.toLowerCase(),
      auth_hash: input.auth_hash,
      salt: input.salt,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT id, email, auth_hash, salt, encrypted_nickname, nickname_iv, created_at, updated_at FROM users WHERE email = ? LIMIT 1')
      .bind(email.toLowerCase())
      .first<User>();

    return result || null;
  }

  /**
   * 根据 ID 查找用户
   */
  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT id, email, auth_hash, salt, encrypted_nickname, nickname_iv, created_at, updated_at FROM users WHERE id = ? LIMIT 1')
      .bind(id)
      .first<User>();

    return result || null;
  }

  /**
   * 检查邮箱是否已存在
   */
  async emailExists(email: string): Promise<boolean> {
    const result = await this.db
      .prepare('SELECT COUNT(*) as count FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first<{ count: number }>();

    return (result?.count ?? 0) > 0;
  }

  /**
   * 更新用户信息（例如重置认证哈希）
   */
  async update(
    id: string,
    updates: Partial<Pick<User, 'auth_hash' | 'salt'>>
  ): Promise<User | null> {
    const timestamp = getCurrentTimestamp();
    const fields = [];
    const values = [];

    if (updates.auth_hash) {
      fields.push('auth_hash = ?');
      values.push(updates.auth_hash);
    }

    if (updates.salt) {
      fields.push('salt = ?');
      values.push(updates.salt);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push('updated_at = ?');
    values.push(timestamp);
    values.push(id);

    const result = await this.db
      .prepare(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`
      )
      .bind(...values)
      .run();

    if (!result.success) {
      throw new Error('Failed to update user');
    }

    return this.findById(id);
  }

  /**
   * 删除用户（级联删除所有关联数据）
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM users WHERE id = ?')
      .bind(id)
      .run();

    return result.success;
  }
}
