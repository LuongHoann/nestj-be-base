import { Injectable, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import dragonflyConfig from '../../config/dragonfly.config';

type MemoryCacheEntry = {
  value: string;
  expiresAt: number | null;
};

@Injectable()
export class DragonflyService implements OnModuleDestroy {
  private readonly logger = new Logger(DragonflyService.name);
  private client: Redis | null = null;
  private readonly memoryStore = new Map<string, MemoryCacheEntry>();
  private isConnected = false;
  private lastErrorMessage: string | null = null;
  private lastErrorLoggedAt = 0;
  private suppressedErrorCount = 0;
  private readonly errorThrottleMs = 30000;

  constructor(
    @Inject(dragonflyConfig.KEY)
    private readonly config: any,
  ) {
    if (this.config.enabled) {
      this.initClient();
    } else {
      this.logger.warn(
        'DragonflyDB is disabled. Falling back to in-memory cache for the current process.',
      );
    }
  }

  private get shouldUseMemoryFallback(): boolean {
    return !this.config.enabled || !this.client || !this.isConnected;
  }

  private getExpiresAt(ttlSeconds?: number): number | null {
    const effectiveTTL = ttlSeconds ?? this.config.ttl;

    if (!effectiveTTL || effectiveTTL <= 0) {
      return null;
    }

    return Date.now() + effectiveTTL * 1000;
  }

  private readMemoryEntry(key: string): MemoryCacheEntry | null {
    const entry = this.memoryStore.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
      return null;
    }

    return entry;
  }

  private writeMemoryEntry(key: string, value: string, ttlSeconds?: number): void {
    this.memoryStore.set(key, {
      value,
      expiresAt: this.getExpiresAt(ttlSeconds),
    });
  }

  private initClient() {
    this.logger.log(
      `Initializing DragonflyDB connection to ${this.config.host}:${this.config.port}`,
    );

    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      connectTimeout: 5000,
      // Retry strategy: keep trying to reconnect but don't block
      retryStrategy: (times) => {
        const delay = Math.min(times * 250, 5000);
        return delay;
      },
      maxRetriesPerRequest: 1,
      // Don't crash on connection error
      enableOfflineQueue: false,
      lazyConnect: true, // Don't connect immediately in constructor
    });

    this.client.connect().catch((err) => {
      this.logger.error(
        `Failed to connect to DragonflyDB initialy: ${err.message}`,
      );
    });

    this.client.on('connect', () => {
      if (this.suppressedErrorCount > 0) {
        this.logger.warn(
          `DragonflyDB reconnected after ${this.suppressedErrorCount} suppressed connection errors`,
        );
        this.suppressedErrorCount = 0;
      }
      this.logger.log('✅ Connected to DragonflyDB');
      this.isConnected = true;
      this.lastErrorMessage = null;
      this.lastErrorLoggedAt = 0;
    });

    this.client.on('error', (err) => {
      this.logConnectionError(err);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      if (this.isConnected) {
        this.logger.warn('DragonflyDB connection closed');
        this.isConnected = false;
      }
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }

  private logConnectionError(err: Error) {
    const message = err.message || 'Unknown DragonflyDB error';
    const now = Date.now();
    const shouldLog =
      this.lastErrorMessage !== message ||
      now - this.lastErrorLoggedAt >= this.errorThrottleMs;

    if (shouldLog) {
      if (this.suppressedErrorCount > 0) {
        this.logger.warn(
          `Suppressed ${this.suppressedErrorCount} repeated DragonflyDB connection errors`,
        );
        this.suppressedErrorCount = 0;
      }

      this.logger.error(
        `❌ DragonflyDB unavailable. Cache is temporarily disabled: ${message}`,
      );
      this.lastErrorMessage = message;
      this.lastErrorLoggedAt = now;
      return;
    }

    this.suppressedErrorCount += 1;
  }

  get enabled(): boolean {
    return !this.shouldUseMemoryFallback;
  }

  /**
   * Get value from cache safely. Returns null if error or miss.
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.shouldUseMemoryFallback) {
      const entry = this.readMemoryEntry(key);
      if (!entry) {
        return null;
      }

      try {
        return JSON.parse(entry.value) as T;
      } catch (error) {
        this.logger.warn(`Failed to parse memory cache key ${key}: ${error.message}`);
        this.memoryStore.delete(key);
        return null;
      }
    }

    const client = this.client;
    if (!client) {
      return null;
    }

    try {
      const data = await client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.warn(`Failed to get cache key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Set value to cache safely.
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (this.shouldUseMemoryFallback) {
      try {
        this.writeMemoryEntry(key, JSON.stringify(value), ttl);
      } catch (error) {
        this.logger.warn(`Failed to set memory cache key ${key}: ${error.message}`);
      }
      return;
    }

    const client = this.client;
    if (!client) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      const effectiveTTL = ttl || this.config.ttl;

      if (effectiveTTL > 0) {
        await client.set(key, serialized, 'EX', effectiveTTL);
      } else {
        await client.set(key, serialized);
      }
    } catch (error) {
      this.logger.warn(`Failed to set cache key ${key}: ${error.message}`);
    }
  }

  /**
   * Delete key from cache safely
   */
  async del(key: string): Promise<void> {
    if (this.shouldUseMemoryFallback) {
      this.memoryStore.delete(key);
      return;
    }

    const client = this.client;
    if (!client) {
      return;
    }

    try {
      await client.del(key);
    } catch (error) {
      this.logger.warn(`Failed to del cache key ${key}: ${error.message}`);
    }
  }
  /**
   * Check if a key exists in cache
   * @param key - The cache key to check
   * @returns true if key exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    if (this.shouldUseMemoryFallback) {
      return this.readMemoryEntry(key) !== null;
    }

    const client = this.client;
    if (!client) {
      return false;
    }

    try {
      const result = await client.exists(key);
      return result === 1; // Redis EXISTS returns number of keys that exist (1 or 0 for single key)
    } catch (error) {
      this.logger.warn(
        `Failed to check existence of key ${key}: ${error.message}`,
      );
      return false;
    }
  }
  /**
   * Set expiration time for a key (in seconds)
   * @param key - The cache key
   * @param ttl - Time to live in seconds
   * @returns true if expiration was set, false otherwise
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    if (this.shouldUseMemoryFallback) {
      const entry = this.readMemoryEntry(key);
      if (!entry) {
        return false;
      }

      this.memoryStore.set(key, {
        ...entry,
        expiresAt: this.getExpiresAt(ttl),
      });
      return true;
    }

    const client = this.client;
    if (!client) {
      return false;
    }

    try {
      const result = await client.expire(key, ttl);
      return result === 1; // Redis EXPIRE returns 1 if successful, 0 if key doesn't exist
    } catch (error) {
      this.logger.warn(
        `Failed to set expiration for key ${key}: ${error.message}`,
      );
      return false;
    }
  }
  /**
   * Set value ONLY if it does not exist (SET NX).
   * @returns true if set, false if already exists
   */
  async setIfNotExist(
    key: string,
    value: any,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (this.shouldUseMemoryFallback) {
      if (this.readMemoryEntry(key)) {
        return false;
      }

      try {
        this.writeMemoryEntry(key, JSON.stringify(value), ttlSeconds);
        return true;
      } catch (error) {
        this.logger.warn(`Failed to set NX memory cache key ${key}: ${error.message}`);
        return false;
      }
    }

    const client = this.client;
    if (!client) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      const result = await client.set(
        key,
        serialized,
        'EX',
        ttlSeconds,
        'NX',
      );
      return result === 'OK';
    } catch (error) {
      this.logger.warn(`Failed to set NX cache key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Add members to a set safely
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.enabled || !this.client) return 0;
    try {
      return await this.client.sadd(key, ...members);
    } catch (error) {
      this.logger.warn(`Failed to sadd to key ${key}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Remove members from a set safely
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.enabled || !this.client) return 0;
    try {
      return await this.client.srem(key, ...members);
    } catch (error) {
      this.logger.warn(`Failed to srem from key ${key}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get all members of a set safely
   */
  async smembers(key: string): Promise<string[]> {
    if (!this.enabled || !this.client) return [];
    try {
      return await this.client.smembers(key);
    } catch (error) {
      this.logger.warn(`Failed to smembers for key ${key}: ${error.message}`);
      return [];
    }
  }
}
