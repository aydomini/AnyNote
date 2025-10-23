import type { D1Database } from '@cloudflare/workers-types';
import type {
  Password,
  CreatePasswordInput,
  UpdatePasswordInput,
  PaginationParams,
} from '../types';
import { generateUUID, getCurrentTimestamp } from '../utils/helpers';

/**
 * 密码仓储层（Password Repository）
 * 负责与 D1 数据库交互，处理密码相关的 CRUD 操作
 */
export class PasswordRepository {
  constructor(private db: D1Database) {}

  /**
   * 创建新密码条目
   */
  async create(userId: string, input: CreatePasswordInput): Promise<Password> {
    const id = generateUUID();
    const timestamp = getCurrentTimestamp();

    const result = await this.db
      .prepare(
        `INSERT INTO passwords (
          id, user_id, encrypted_site, encrypted_username, encrypted_password,
          encrypted_recovery, encrypted_notes, iv, auth_tag,
          algorithm, created_at, updated_at, version, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        userId,
        input.encrypted_site,
        input.encrypted_username,
        input.encrypted_password,
        input.encrypted_recovery || null,
        input.encrypted_notes || null,
        input.iv,
        input.auth_tag || null,
        'AES-256-GCM',
        timestamp,
        timestamp,
        1,  // 初始版本号
        0   // 未删除
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to create password');
    }

    return {
      id,
      user_id: userId,
      encrypted_site: input.encrypted_site,
      encrypted_username: input.encrypted_username,
      encrypted_password: input.encrypted_password,
      encrypted_recovery: input.encrypted_recovery || null,
      encrypted_notes: input.encrypted_notes || null,
      iv: input.iv,
      auth_tag: input.auth_tag || null,
      algorithm: 'AES-256-GCM',
      created_at: timestamp,
      updated_at: timestamp,
      version: 1,
      is_deleted: 0,
    };
  }

  /**
   * 获取用户的所有密码条目（支持分页）
   */
  async findByUserId(
    userId: string,
    params: PaginationParams = {}
  ): Promise<Password[]> {
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const result = await this.db
      .prepare(
        `SELECT * FROM passwords
         WHERE user_id = ?
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(userId, limit, offset)
      .all<Password>();

    return result.results || [];
  }

  /**
   * 根据 ID 获取密码条目
   */
  async findById(id: string, userId: string): Promise<Password | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM passwords
         WHERE id = ? AND user_id = ?
         LIMIT 1`
      )
      .bind(id, userId)
      .first<Password>();

    return result || null;
  }

  /**
   * 更新密码条目（使用乐观锁防止冲突）
   */
  async update(
    id: string,
    userId: string,
    input: UpdatePasswordInput
  ): Promise<Password | null> {
    const timestamp = getCurrentTimestamp();
    const fields = [];
    const values = [];

    if (input.encrypted_site) {
      fields.push('encrypted_site = ?');
      values.push(input.encrypted_site);
    }

    if (input.encrypted_username) {
      fields.push('encrypted_username = ?');
      values.push(input.encrypted_username);
    }

    if (input.encrypted_password) {
      fields.push('encrypted_password = ?');
      values.push(input.encrypted_password);
    }

    if (input.encrypted_recovery !== undefined) {
      fields.push('encrypted_recovery = ?');
      values.push(input.encrypted_recovery || null);
    }

    if (input.encrypted_notes !== undefined) {
      fields.push('encrypted_notes = ?');
      values.push(input.encrypted_notes || null);
    }

    if (input.iv) {
      fields.push('iv = ?');
      values.push(input.iv);
    }

    if (input.auth_tag !== undefined) {
      fields.push('auth_tag = ?');
      values.push(input.auth_tag || null);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // 添加版本号递增和更新时间
    fields.push('version = version + 1');
    fields.push('updated_at = ?');
    values.push(timestamp);

    // 添加 WHERE 条件的参数
    values.push(id);
    values.push(userId);
    values.push(input.version);  // 乐观锁：仅当版本号匹配时更新

    const result = await this.db
      .prepare(
        `UPDATE passwords
         SET ${fields.join(', ')}
         WHERE id = ? AND user_id = ? AND version = ?`
      )
      .bind(...values)
      .run();

    if (!result.success) {
      throw new Error('Failed to update password');
    }

    // 检查是否实际更新了行（版本冲突时不会更新）
    if (result.meta.changes === 0) {
      throw new Error('Version conflict: password was modified by another client');
    }

    return this.findById(id, userId);
  }

  /**
   * 软删除密码条目
   */
  async softDelete(id: string, userId: string): Promise<boolean> {
    const timestamp = getCurrentTimestamp();

    const result = await this.db
      .prepare(
        `UPDATE passwords
         SET is_deleted = 1, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(timestamp, id, userId)
      .run();

    return result.success && result.meta.changes > 0;
  }

  /**
   * 永久删除密码条目
   */
  async hardDelete(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM passwords WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run();

    return result.success && result.meta.changes > 0;
  }

  /**
   * 获取用户密码条目总数
   */
  async countByUserId(userId: string): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM passwords
         WHERE user_id = ?`
      )
      .bind(userId)
      .first<{ count: number }>();

    return result?.count ?? 0;
  }

  /**
   * 获取最近更新的密码条目（用于同步）
   */
  async findUpdatedSince(
    userId: string,
    timestamp: number,
    limit: number = 100
  ): Promise<Password[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM passwords
         WHERE user_id = ? AND updated_at > ?
         ORDER BY updated_at DESC
         LIMIT ?`
      )
      .bind(userId, timestamp, limit)
      .all<Password>();

    return result.results || [];
  }
}
