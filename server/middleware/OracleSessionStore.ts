import { Store } from 'express-session';
import { databaseReadService } from '../services/DatabaseReadService.js';
import { databaseWriteService } from '../services/DatabaseWriteService.js';

interface SessionData {
  cookie: any;
  [key: string]: any;
}

interface CachedSession {
  data: SessionData;
  expire: Date;
  fetchedAt: number;
}

export class OracleSessionStore extends Store {
  private sessionCache: Map<string, CachedSession> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // Cache sessions for 5 minutes

  constructor() {
    super();
    this.createTableIfNotExists();
    
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [sid, cached] of this.sessionCache.entries()) {
        if (now - cached.fetchedAt > this.CACHE_TTL || cached.expire < new Date()) {
          this.sessionCache.delete(sid);
        }
      }
    }, 5 * 60 * 1000);
  }

  private async createTableIfNotExists() {
    try {
      await databaseWriteService.createSessionsTableIfNotExists();
    } catch (error) {
      // Table likely already exists, which is fine
      console.log('Session table initialization:', error instanceof Error ? error.message : 'OK');
    }
  }

  async get(sid: string, callback: (err?: any, session?: SessionData | null) => void) {
    try {
      // Check cache first
      const cached = this.sessionCache.get(sid);
      if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL) {
        // Check if session expired
        if (cached.expire < new Date()) {
          this.sessionCache.delete(sid);
          return this.destroy(sid, callback);
        }
        return callback(null, cached.data);
      }

      const row = await databaseReadService.getSessionBySid(sid);

      if (!row) {
        this.sessionCache.delete(sid);
        return callback(null, null);
      }

      const expire = new Date(row.EXPIRE || row.expire);
      
      // Check if session expired
      if (expire < new Date()) {
        this.sessionCache.delete(sid);
        return this.destroy(sid, callback);
      }

      const sess = row.SESS || row.sess;
      const sessionData = JSON.parse(sess);
      
      // Cache the session
      this.sessionCache.set(sid, {
        data: sessionData,
        expire,
        fetchedAt: Date.now(),
      });
      
      callback(null, sessionData);
    } catch (error) {
      callback(error);
    }
  }

  async set(sid: string, session: SessionData, callback?: (err?: any) => void) {
    try {
      const expire = session.cookie?.expires 
        ? new Date(session.cookie.expires)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default
      
      const sess = JSON.stringify(session);

      // Update cache
      this.sessionCache.set(sid, {
        data: session,
        expire,
        fetchedAt: Date.now(),
      });

      // Use MERGE to handle both insert and update atomically
      await databaseWriteService.upsertSession(sid, sess, expire);

      callback?.();
    } catch (error) {
      console.error(`[SESSION STORE] Error setting session ${sid.substring(0, 8)}:`, error);
      callback?.(error);
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    try {
      this.sessionCache.delete(sid);
      await databaseWriteService.deleteSession(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  async touch(sid: string, session: SessionData, callback?: (err?: any) => void) {
    // Don't update database on every touch - let cache handle it
    // Only update cache expiry time
    const cached = this.sessionCache.get(sid);
    if (cached) {
      const expire = session.cookie?.expires 
        ? new Date(session.cookie.expires)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      cached.expire = expire;
      cached.fetchedAt = Date.now();
    }
    callback?.();
  }

  async clear(callback?: (err?: any) => void) {
    try {
      await databaseWriteService.clearAllSessions();
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  async length(callback: (err: any, length?: number) => void) {
    try {
      const count = await databaseReadService.getActiveSessionCount();
      callback(null, count);
    } catch (error) {
      callback(error);
    }
  }
}
