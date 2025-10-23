import type { D1Database } from '@cloudflare/workers-types';
import type { Note, CreateNoteInput, UpdateNoteInput, PaginationParams } from '../types';
import { generateUUID, getCurrentTimestamp } from '../utils/helpers';

/**
 * 笔记仓储层（Note Repository）
 * 负责与 D1 数据库交互，处理笔记相关的 CRUD 操作
 */
export class NoteRepository {
  constructor(private db: D1Database) {}

  /**
   * 创建新笔记
   */
  async create(userId: string, input: CreateNoteInput): Promise<Note> {
    const id = generateUUID();
    const timestamp = getCurrentTimestamp();

    const result = await this.db
      .prepare(
        `INSERT INTO notes (
          id, user_id, title, encrypted_content, iv, auth_tag,
          algorithm, created_at, updated_at, version, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        userId,
        input.title || null,
        input.encrypted_content,
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
      throw new Error('Failed to create note');
    }

    return {
      id,
      user_id: userId,
      title: input.title || null,
      encrypted_content: input.encrypted_content,
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
   * 获取用户的所有笔记（支持分页）
   */
  async findByUserId(
    userId: string,
    params: PaginationParams = {}
  ): Promise<Note[]> {
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const result = await this.db
      .prepare(
        `SELECT * FROM notes
         WHERE user_id = ?
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(userId, limit, offset)
      .all<Note>();

    return result.results || [];
  }

  /**
   * 根据 ID 获取笔记
   */
  async findById(id: string, userId: string): Promise<Note | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM notes
         WHERE id = ? AND user_id = ?
         LIMIT 1`
      )
      .bind(id, userId)
      .first<Note>();

    return result || null;
  }

  /**
   * 更新笔记（使用乐观锁防止冲突）
   */
  async update(
    id: string,
    userId: string,
    input: UpdateNoteInput
  ): Promise<Note | null> {
    const timestamp = getCurrentTimestamp();
    const fields = [];
    const values = [];

    if (input.title !== undefined) {
      fields.push('title = ?');
      values.push(input.title || null);
    }

    if (input.encrypted_content) {
      fields.push('encrypted_content = ?');
      values.push(input.encrypted_content);
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
        `UPDATE notes
         SET ${fields.join(', ')}
         WHERE id = ? AND user_id = ? AND version = ?`
      )
      .bind(...values)
      .run();

    if (!result.success) {
      throw new Error('Failed to update note');
    }

    // 检查是否实际更新了行（版本冲突时不会更新）
    if (result.meta.changes === 0) {
      throw new Error('Version conflict: note was modified by another client');
    }

    return this.findById(id, userId);
  }

  /**
   * 软删除笔记
   */
  async softDelete(id: string, userId: string): Promise<boolean> {
    const timestamp = getCurrentTimestamp();

    const result = await this.db
      .prepare(
        `UPDATE notes
         SET is_deleted = 1, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(timestamp, id, userId)
      .run();

    return result.success && result.meta.changes > 0;
  }

  /**
   * 永久删除笔记
   */
  async hardDelete(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run();

    return result.success && result.meta.changes > 0;
  }

  /**
   * 获取用户笔记总数
   */
  async countByUserId(userId: string): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM notes
         WHERE user_id = ?`
      )
      .bind(userId)
      .first<{ count: number }>();

    return result?.count ?? 0;
  }

  /**
   * 获取最近更新的笔记（用于同步）
   */
  async findUpdatedSince(
    userId: string,
    timestamp: number,
    limit: number = 100
  ): Promise<Note[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM notes
         WHERE user_id = ? AND updated_at > ?
         ORDER BY updated_at DESC
         LIMIT ?`
      )
      .bind(userId, timestamp, limit)
      .all<Note>();

    return result.results || [];
  }
}
