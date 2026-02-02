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
    this.logger.log(`Initializing DragonflyDB connection to ${this.config.host}:${this.config.port}`);
    
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

    this.client.connect().catch(err => {
        this.logger.error(`Failed to connect to DragonflyDB initialy: ${err.message}`);
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
}
