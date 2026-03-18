import { Injectable, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import dragonflyConfig from '../../config/dragonfly.config';

@Injectable()
export class DragonflyService implements OnModuleDestroy {
  private readonly logger = new Logger(DragonflyService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(
    @Inject(dragonflyConfig.KEY)
    private readonly config: any,
  ) {
    if (this.config.enabled) {
      this.initClient();
    }
  }

  private initClient() {
    this.logger.log(
      `Initializing DragonflyDB connection to ${this.config.host}:${this.config.port}`,
    );

    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      // Retry strategy: keep trying to reconnect but don't block
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
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
      this.logger.log('✅ Connected to DragonflyDB');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      this.logger.error(`❌ DragonflyDB Error: ${err.message}`);
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
      await this.client.quit();
    }
  }

  get enabled(): boolean {
    return this.config.enabled && this.isConnected && !!this.client;
  }

  /**
   * Get value from cache safely. Returns null if error or miss.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.client) return null;

    try {
      const data = await this.client.get(key);
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
    if (!this.enabled || !this.client) return;

    try {
      const serialized = JSON.stringify(value);
      const effectiveTTL = ttl || this.config.ttl;

      if (effectiveTTL > 0) {
        await this.client.set(key, serialized, 'EX', effectiveTTL);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.logger.warn(`Failed to set cache key ${key}: ${error.message}`);
    }
  }

  /**
   * Delete key from cache safely
   */
  async del(key: string): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.del(key);
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
    if (!this.enabled || !this.client) return false;

    try {
      const result = await this.client.exists(key);
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
    if (!this.enabled || !this.client) return false;

    try {
      const result = await this.client.expire(key, ttl);
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
    if (!this.enabled || !this.client) return false;

    try {
      const serialized = JSON.stringify(value);
      const result = await this.client.set(
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
