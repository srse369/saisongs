import { databaseReadService } from './DatabaseReadService.js';

/**
 * DatabaseWriteService handles all WRITE operations (INSERT, UPDATE, DELETE).
 * 
 * This service depends on DatabaseReadService for:
 * - Connection pool management
 * - Base query execution
 * - Read operations needed before writes
 * 
 * Dependency structure:
 * - CacheService → DatabaseReadService (for cached reads)
 * - DatabaseWriteService → DatabaseReadService (for query execution)
 * - Routes → DatabaseWriteService (for mutations)
 */
class DatabaseWriteService {
  private db = databaseReadService;

  // =====================================================
  // OTP WRITE METHODS
  // =====================================================

  /**
   * Insert OTP code into database
   */
  async insertOTPCode(email: string, code: string, expiresAt: Date): Promise<void> {
    await this.db.query<any>(
      `INSERT INTO otp_codes (email, code, expires_at) 
       VALUES (:1, :2, :3)`,
      [email.toLowerCase().trim(), code, expiresAt]
    );
  }

  /**
   * Mark OTP as used
   */
  async markOTPAsUsed(otpId: string | number): Promise<void> {
    await this.db.query<any>(
      'UPDATE otp_codes SET used = 1 WHERE id = :1',
      [otpId]
    );
  }

  /**
   * Clean up expired OTP codes (calls database procedure)
   */
  async cleanupExpiredOTPs(): Promise<void> {
    await this.db.query('BEGIN cleanup_expired_otp_codes; END;');
  }

  // =====================================================
  // SONG WRITE METHODS
  // =====================================================

  /**
   * Update song with extracted data from external source
   * Accepts camelCase fields and builds dynamic UPDATE query
   * @returns Object with updated fields, or null if no fields to update
   */
  async syncSongFromExtracted(songId: string, extracted: {
    refGents?: string;
    refLadies?: string;
    lyrics?: string;
    meaning?: string;
    audioLink?: string;
    videoLink?: string;
    deity?: string;
    language?: string;
    raga?: string;
    beat?: string;
    level?: string;
    tempo?: string;
    songTags?: string[];
    goldenVoice?: boolean;
  }): Promise<Record<string, any> | null> {
    // Build list of fields to update (only non-empty values)
    const fieldsToUpdate: { column: string; value: any }[] = [];

    if (extracted.refGents) fieldsToUpdate.push({ column: 'reference_gents_pitch', value: extracted.refGents });
    if (extracted.refLadies) fieldsToUpdate.push({ column: 'reference_ladies_pitch', value: extracted.refLadies });
    if (extracted.lyrics) fieldsToUpdate.push({ column: 'lyrics', value: extracted.lyrics });
    if (extracted.meaning) fieldsToUpdate.push({ column: 'meaning', value: extracted.meaning });
    if (extracted.audioLink) fieldsToUpdate.push({ column: 'audio_link', value: extracted.audioLink });
    if (extracted.videoLink) fieldsToUpdate.push({ column: 'video_link', value: extracted.videoLink });
    if (extracted.deity) fieldsToUpdate.push({ column: 'deity', value: extracted.deity });
    if (extracted.language) fieldsToUpdate.push({ column: 'language', value: extracted.language });
    if (extracted.raga) fieldsToUpdate.push({ column: 'raga', value: extracted.raga });
    if (extracted.beat) fieldsToUpdate.push({ column: 'beat', value: extracted.beat });
    if (extracted.level) fieldsToUpdate.push({ column: 'level', value: extracted.level });
    if (extracted.tempo) fieldsToUpdate.push({ column: 'tempo', value: extracted.tempo });
    if (Array.isArray(extracted.songTags) && extracted.songTags.length) {
      fieldsToUpdate.push({ column: 'song_tags', value: extracted.songTags.join(',') });
    }
    if (typeof extracted.goldenVoice === 'boolean') {
      fieldsToUpdate.push({ column: 'golden_voice', value: extracted.goldenVoice ? 1 : 0 });
    }

    if (fieldsToUpdate.length === 0) {
      return null;
    }

    // Build dynamic UPDATE with proper column quoting for Oracle reserved words
    const setParts: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const quoteColumn = (col: string) => {
      const reserved = ['language', 'level'];
      if (reserved.includes(col.toLowerCase())) {
        return `"${col.toUpperCase()}"`;
      }
      return col;
    };

    for (const f of fieldsToUpdate) {
      setParts.push(`${quoteColumn(f.column)} = :${idx}`);
      params.push(f.value);
      idx++;
    }

    setParts.push('updated_at = CURRENT_TIMESTAMP');
    const updateQuery = `UPDATE songs SET ${setParts.join(', ')} WHERE id = HEXTORAW(:${idx})`;
    params.push(songId);

    await this.db.query(updateQuery, params);

    // Return summary of updated fields
    const updates: Record<string, any> = {};
    for (const f of fieldsToUpdate) {
      updates[f.column] = f.value;
    }
    return updates;
  }

  // =====================================================
  // PITCH WRITE METHODS
  // =====================================================

  /**
   * Delete a pitch by ID
   */
  async deletePitchById(pitchId: string): Promise<void> {
    await this.db.query<any>(
      'DELETE FROM song_singer_pitches WHERE id = HEXTORAW(:1)',
      [pitchId]
    );
  }

  /**
   * Update pitch to new singer (transfer pitch)
   */
  async updatePitchSinger(pitchId: string, newSingerId: string): Promise<void> {
    await this.db.query<any>(
      'UPDATE song_singer_pitches SET singer_id = HEXTORAW(:1), updated_at = CURRENT_TIMESTAMP WHERE id = HEXTORAW(:2)',
      [newSingerId, pitchId]
    );
  }

  // =====================================================
  // TEMPLATE WRITE METHODS
  // =====================================================

  /**
   * Unset all templates as default
   */
  async unsetAllDefaultTemplates(updatedBy: string): Promise<void> {
    await this.db.query('UPDATE presentation_templates SET is_default = 0, updated_at = CURRENT_TIMESTAMP, updated_by = :1', [updatedBy]);
  }

  /**
   * Create a new template
   */
  async createTemplate(id: string, name: string, description: string | null, templateJson: string, centerIdsJson: string | null, isDefault: boolean, createdBy: string): Promise<void> {
    await this.db.query(`
      INSERT INTO presentation_templates
      (id, name, description, template_json, center_ids, is_default, created_at, created_by)
      VALUES (:1, :2, :3, :4, :5, :6, CURRENT_TIMESTAMP, :7)
    `, [id, name, description, templateJson, centerIdsJson, isDefault ? 1 : 0, createdBy]);
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, name: string, description: string | null, templateJson: string, centerIdsJson: string | null, isDefault: boolean, updatedBy: string): Promise<void> {
    await this.db.query(`
      UPDATE presentation_templates
      SET name = :1, description = :2, template_json = :3, center_ids = :4, is_default = :5, updated_at = CURRENT_TIMESTAMP, updated_by = :6
      WHERE id = :6
    `, [name, description, templateJson, centerIdsJson, isDefault ? 1 : 0, updatedBy, id]);
  }

  /**
   * Set template as default
   */
  async setTemplateAsDefault(id: string, updatedBy: string): Promise<void> {
    // First, unset all other templates as default
    await this.unsetAllDefaultTemplates(updatedBy);

    await this.db.query(
      'UPDATE presentation_templates SET is_default = 1, updated_at = CURRENT_TIMESTAMP, updated_by = :2 WHERE id = :1',
      [updatedBy, id]
    );
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    await this.db.query('DELETE FROM presentation_templates WHERE id = :1', [id]);
  }

  // =====================================================
  // ANALYTICS WRITE METHODS
  // =====================================================

  /**
   * Record a visitor analytics entry
   */
  async recordVisitorAnalytics(data: {
    ipAddress: string;
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    userAgent?: string;
    pagePath?: string;
    referrer?: string;
    userRole?: string;
  }): Promise<void> {
    await this.db.query(`
      INSERT INTO visitor_analytics (
        ip_address, country, country_code, region, city,
        latitude, longitude, user_agent, page_path,
        referrer, user_role
      ) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11)
    `, [
      data.ipAddress,
      data.country || null,
      data.countryCode || null,
      data.region || null,
      data.city || null,
      data.latitude || null,
      data.longitude || null,
      data.userAgent || null,
      data.pagePath || null,
      data.referrer || null,
      data.userRole || 'public'
    ]);
  }

  // =====================================================
  // SESSION STORE WRITE METHODS
  // =====================================================

  /**
   * Create sessions table if not exists
   */
  async createSessionsTableIfNotExists(): Promise<void> {
    await this.db.query(`
      BEGIN
        EXECUTE IMMEDIATE 'CREATE TABLE sessions (
          sid VARCHAR2(255) PRIMARY KEY,
          sess CLOB NOT NULL,
          expire TIMESTAMP NOT NULL
        )';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN
            RAISE;
          END IF;
      END;
    `);
  }

  /**
   * Upsert session (merge insert/update)
   */
  async upsertSession(sid: string, sess: string, expire: Date): Promise<void> {
    await this.db.query(
      `MERGE INTO sessions s
       USING (SELECT :1 as sid, :2 as sess, :3 as expire FROM dual) src
       ON (s.sid = src.sid)
       WHEN MATCHED THEN
         UPDATE SET s.sess = src.sess, s.expire = src.expire
       WHEN NOT MATCHED THEN
         INSERT (sid, sess, expire) VALUES (src.sid, src.sess, src.expire)`,
      [sid, sess, expire]
    );
  }

  /**
   * Delete session by SID
   */
  async deleteSession(sid: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE sid = :1', [sid]);
  }

  /**
   * Clear all sessions
   */
  async clearAllSessions(): Promise<void> {
    await this.db.query('DELETE FROM sessions');
  }

  // =====================================================
  // RAW QUERY EXECUTION (for CacheService complex operations)
  // These methods should ONLY be called from CacheService
  // =====================================================

  /**
   * Execute a raw write query (INSERT, UPDATE, DELETE)
   * @internal For use by CacheService only
   */
  async executeQuery<T = any>(sql: string, params: any[] | Record<string, any> = [], options: any = {}): Promise<T[]> {
    return await this.db.query<T>(sql, params, options);
  }
}

// Export singleton instance
export const databaseWriteService = new DatabaseWriteService();
export default databaseWriteService;

