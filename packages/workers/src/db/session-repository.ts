/**
 * Session Repository
 * 会话管理数据访问层
 *
 * 包含并发安全优化：
 * - 使用 SQLite RETURNING 子句避免竞态条件
 * - 原子性操作：查询 + 撤销一次完成
 */

import type { Session, CreateSessionInput } from '../types';

export class SessionRepository {
  constructor(private db: D1Database) {}

  /**
   * 创建会话
   * @param session 会话信息
   */
  async create(session: CreateSessionInput): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO sessions (
          id, user_id, device_id, device_name, device_type,
          browser_name, os_name, ip_address, location, user_agent,
          is_active, created_at, expires_at, refresh_token
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        session.id,
        session.user_id,
        session.device_id,
        session.device_name || null,
        session.device_type || null,
        session.browser_name || null,
        session.os_name || null,
        session.ip_address || null,
        session.location || null,
        session.user_agent,
        session.is_active ? 1 : 0,
        session.created_at,
        session.expires_at,
        session.refresh_token || null
      )
      .run();
  }

  /**
   * 查询活跃会话列表（按登录时间排序）
   * @param userId 用户 ID
   * @returns 活跃会话数组
   */
  async findActive(userId: string): Promise<Session[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM sessions
        WHERE user_id = ? AND is_active = 1 AND expires_at > ?
        ORDER BY created_at ASC
      `)
      .bind(userId, Date.now())
      .all<Session>();

    return result.results || [];
  }

  /**
   * 根据 session_id 查询会话（用于 API 验证）
   * @param sessionId 会话 ID
   * @returns 会话对象或 null
   */
  async findById(sessionId: string): Promise<Session | null> {
    const result = await this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<Session>();

    return result;
  }

  /**
   * 撤销最老设备（并发安全版本）
   *
   * 使用 RETURNING 子句实现原子性操作：
   * - 单次查询完成"查询 + 撤销"
   * - 消除竞态窗口
   * - 即使并发执行，最多只踢出 1 个设备
   *
   * @param userId 用户 ID
   * @returns 被撤销的会话对象，如果没有则返回 null
   */
  async revokeOldestSession(userId: string): Promise<Session | null> {
    const result = await this.db
      .prepare(`
        UPDATE sessions
        SET is_active = 0
        WHERE id = (
          SELECT id FROM sessions
          WHERE user_id = ? AND is_active = 1 AND expires_at > ?
          ORDER BY created_at ASC
          LIMIT 1
        )
        RETURNING *
      `)
      .bind(userId, Date.now())
      .first<Session>();

    return result || null;
  }

  /**
   * 撤销指定会话（标记为无效）
   * @param sessionId 会话 ID
   */
  async revoke(sessionId: string): Promise<void> {
    await this.db
      .prepare('UPDATE sessions SET is_active = 0 WHERE id = ?')
      .bind(sessionId)
      .run();
  }

  /**
   * 查询用户所有会话（包括已登出设备，用于设备管理页面）
   * @param userId 用户 ID
   * @returns 会话数组（按登录时间倒序）
   */
  async findByUserId(userId: string): Promise<Session[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM sessions
        WHERE user_id = ? AND expires_at > ?
        ORDER BY created_at DESC
      `)
      .bind(userId, Date.now())
      .all<Session>();

    return result.results || [];
  }

  /**
   * 统计活跃会话数量
   * @param userId 用户 ID
   * @returns 活跃会话数量
   */
  async countActive(userId: string): Promise<number> {
    const result = await this.db
      .prepare(`
        SELECT COUNT(*) as count FROM sessions
        WHERE user_id = ? AND is_active = 1 AND expires_at > ?
      `)
      .bind(userId, Date.now())
      .first<{ count: number }>();

    return result?.count || 0;
  }

  /**
   * 清理过期会话（定时任务使用）
   * @returns 清理的会话数量
   */
  async cleanExpired(): Promise<number> {
    const result = await this.db
      .prepare('DELETE FROM sessions WHERE expires_at < ?')
      .bind(Date.now())
      .run();

    return result.meta.changes || 0;
  }

  /**
   * 🔐 安全增强：通过 refresh_token 查找会话
   * @param refreshToken Refresh Token
   * @returns 会话对象（如果存在且有效）
   */
  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    const result = await this.db
      .prepare(`
        SELECT * FROM sessions
        WHERE refresh_token = ? AND is_active = 1 AND expires_at > ?
      `)
      .bind(refreshToken, Date.now())
      .first<Session>();

    return result || null;
  }
}
