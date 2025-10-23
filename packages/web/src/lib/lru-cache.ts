/**
 * LRU（最近最少使用）缓存实现
 * 用于缓存解密结果，避免重复解密操作
 */

export class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, V>;

  constructor(maxSize: number = 200) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * 获取缓存值
   * @param key 缓存键
   * @returns 缓存值，如果不存在则返回 undefined
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // LRU 策略：将访问的项移到最后（最新）
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   */
  set(key: K, value: V): void {
    // 如果已存在，先删除（为了更新顺序）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 如果缓存已满，删除最旧的项（第一个）
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // 添加新项到末尾（最新）
    this.cache.set(key, value);
  }

  /**
   * 检查缓存中是否存在指定键
   * @param key 缓存键
   * @returns 是否存在
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   */
  delete(key: K): void {
    this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取当前缓存大小
   * @returns 缓存项数量
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取缓存容量
   * @returns 最大缓存项数量
   */
  capacity(): number {
    return this.maxSize;
  }
}
