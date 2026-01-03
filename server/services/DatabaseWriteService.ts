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
  // CACHE SERVICE WRITE METHODS
  // These methods are specifically for CacheService to use
  // =====================================================

  /**
   * Create a song (for CacheService)
   */
  async createSongForCache(songData: any): Promise<void> {
    await this.db.query(`
      INSERT INTO songs (
        name, external_source_url,
        "LANGUAGE", deity, tempo, beat, raga, "LEVEL",
        audio_link, video_link, golden_voice,
        reference_gents_pitch, reference_ladies_pitch, created_by,
        lyrics, meaning, song_tags
      ) VALUES (
        :p_name, :p_external_source_url, :p_language, :p_deity, :p_tempo, :p_beat, :p_raga, :p_level,
        :p_audio_link, :p_video_link, :p_golden_voice,
        :p_reference_gents_pitch, :p_reference_ladies_pitch, :p_created_by,
        :p_lyrics, :p_meaning, :p_song_tags
      )
    `, {
      p_name: String(songData.name || ''),
      p_external_source_url: songData.external_source_url ? String(songData.external_source_url) : null,
      p_language: String(songData.language || ''),
      p_deity: String(songData.deity || ''),
      p_tempo: songData.tempo ? String(songData.tempo) : null,
      p_beat: songData.beat ? String(songData.beat) : null,
      p_raga: songData.raga ? String(songData.raga) : null,
      p_level: songData.level ? String(songData.level) : null,
      p_audio_link: songData.audio_link ? String(songData.audio_link) : null,
      p_video_link: songData.video_link ? String(songData.video_link) : null,
      p_golden_voice: (songData.golden_voice === true || songData.golden_voice === 1 || songData.golden_voice === '1') ? 1 : 0,
      p_reference_gents_pitch: songData.reference_gents_pitch ? String(songData.reference_gents_pitch) : null,
      p_reference_ladies_pitch: songData.reference_ladies_pitch ? String(songData.reference_ladies_pitch) : null,
      p_created_by: songData.created_by ? String(songData.created_by) : null,
      p_lyrics: songData.lyrics ? String(songData.lyrics) : null,
      p_meaning: songData.meaning ? String(songData.meaning) : null,
      p_song_tags: songData.song_tags ? String(songData.song_tags) : null
    }, {
      autoCommit: false
    });
  }

  /**
   * Update a song (for CacheService)
   */
  async updateSongForCache(id: string, songData: any): Promise<void> {
    await this.db.query(`
      UPDATE songs SET
        name = :p_name,
        external_source_url = :p_external_source_url,
        "LANGUAGE" = :p_language,
        deity = :p_deity,
        tempo = :p_tempo,
        beat = :p_beat,
        raga = :p_raga,
        "LEVEL" = :p_level,
        audio_link = :p_audio_link,
        video_link = :p_video_link,
        golden_voice = :p_golden_voice,
        reference_gents_pitch = :p_reference_gents_pitch,
        reference_ladies_pitch = :p_reference_ladies_pitch,
        updated_by = :p_updated_by,
        updated_at = CURRENT_TIMESTAMP,
        lyrics = :p_lyrics,
        meaning = :p_meaning,
        song_tags = :p_song_tags
      WHERE RAWTOHEX(id) = :p_id
    `, {
      p_name: String(songData.name || ''),
      p_external_source_url: songData.external_source_url ? String(songData.external_source_url) : null,
      p_language: String(songData.language || ''),
      p_deity: String(songData.deity || ''),
      p_tempo: songData.tempo ? String(songData.tempo) : null,
      p_beat: songData.beat ? String(songData.beat) : null,
      p_raga: songData.raga ? String(songData.raga) : null,
      p_level: songData.level ? String(songData.level) : null,
      p_audio_link: songData.audio_link ? String(songData.audio_link) : null,
      p_video_link: songData.video_link ? String(songData.video_link) : null,
      p_golden_voice: (songData.golden_voice === true || songData.golden_voice === 1 || songData.golden_voice === '1') ? 1 : 0,
      p_reference_gents_pitch: songData.reference_gents_pitch ? String(songData.reference_gents_pitch) : null,
      p_reference_ladies_pitch: songData.reference_ladies_pitch ? String(songData.reference_ladies_pitch) : null,
      p_updated_by: songData.updated_by ? String(songData.updated_by) : null,
      p_lyrics: songData.lyrics ? String(songData.lyrics) : null,
      p_meaning: songData.meaning ? String(songData.meaning) : null,
      p_song_tags: songData.song_tags ? String(songData.song_tags) : null,
      p_id: String(id)
    }, {
      autoCommit: true
    });
  }

  /**
   * Delete a song (for CacheService)
   */
  async deleteSongForCache(id: string): Promise<void> {
    await this.db.query(`DELETE FROM songs WHERE RAWTOHEX(id) = :1`, [id]);
  }

  /**
   * Create a singer (for CacheService)
   */
  async createSingerForCache(name: string, gender: string | null, email: string | null, centerIdsJson: string | null, editorForJson: string | null, createdBy: string | null): Promise<void> {
    await this.db.query(`INSERT INTO users (name, gender, email, center_ids, editor_for, created_by) VALUES (:1, :2, :3, :4, :5, :6)`, [name, gender || null, email || null, centerIdsJson, editorForJson, createdBy || null]);
  }

  /**
   * Update a singer (for CacheService)
   */
  async updateSingerForCache(id: string, name: string, gender: string | null, email: string | null, isAdmin: number, centerIdsJson: string | null, editorForJson: string | null, updatedBy: string | null): Promise<void> {
    await this.db.query(`
      UPDATE users SET
        name = :1,
        gender = :2,
        email = :3,
        is_admin = :4,
        center_ids = :5,
        editor_for = :6,
        updated_by = :7,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :8
      `, [name, gender || null, email || null, isAdmin, centerIdsJson, editorForJson, updatedBy || null, id]);
  }

  /**
   * Delete a singer (for CacheService)
   */
  async deleteSingerForCache(id: string): Promise<void> {
    await this.db.query(`DELETE FROM users WHERE RAWTOHEX(id) = :1`, [id]);
  }

  /**
   * Update user admin status (for CacheService)
   */
  async updateUserAdminStatusForCache(id: string, isAdmin: number): Promise<void> {
    await this.db.query(
      `UPDATE users SET is_admin = :1 WHERE RAWTOHEX(id) = :2`,
      [isAdmin, id]
    );
  }

  /**
   * Update user editor_for (for CacheService)
   */
  async updateUserEditorForForCache(id: string, editorForJson: string | null): Promise<void> {
    await this.db.query(
      `UPDATE users SET editor_for = :1 WHERE RAWTOHEX(id) = :2`,
      [editorForJson, id]
    );
  }

  /**
   * Add user editor access (for CacheService)
   */
  async addUserEditorAccessForCache(userId: string, editorForJson: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET editor_for = :1 WHERE RAWTOHEX(id) = :2`,
      [editorForJson, userId]
    );
  }

  /**
   * Remove user editor access (for CacheService)
   */
  async removeUserEditorAccessForCache(userId: string, editorForJson: string | null): Promise<void> {
    await this.db.query(
      `UPDATE users SET editor_for = :1 WHERE RAWTOHEX(id) = :2`,
      [editorForJson, userId]
    );
  }

  /**
   * Create a pitch (for CacheService)
   */
  async createPitchForCache(songId: string, singerId: string, pitch: string, createdBy: string | null): Promise<void> {
    await this.db.query(`
      INSERT INTO song_singer_pitches (song_id, singer_id, pitch, created_at, created_by)
      VALUES (HEXTORAW(:1), HEXTORAW(:2), :3, CURRENT_TIMESTAMP, :4)
    `, [songId, singerId, pitch, createdBy || null]);
  }

  /**
   * Update a pitch (for CacheService)
   */
  async updatePitchForCache(id: string, pitch: string, updatedBy: string | null): Promise<void> {
    await this.db.query(`
      UPDATE song_singer_pitches SET
        pitch = :1,
        updated_by = :2,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :3
    `, [pitch, updatedBy, id]);
  }

  /**
   * Delete a pitch (for CacheService)
   */
  async deletePitchForCache(id: string): Promise<void> {
    await this.db.query(`DELETE FROM song_singer_pitches WHERE RAWTOHEX(id) = :1`, [id]);
  }

  /**
   * Create a center (for CacheService)
   */
  async createCenterForCache(name: string, badgeTextColor: string, createdBy: string | null): Promise<void> {
    await this.db.query(
      `INSERT INTO centers (name, badge_text_color, created_by, created_at, updated_at) 
       VALUES (:1, :2, :3, SYSTIMESTAMP, SYSTIMESTAMP)`,
      [name, badgeTextColor, createdBy || null]
    );
  }

  /**
   * Update a center (for CacheService)
   */
  async updateCenterForCache(id: string | number, updates: string[], params: any[]): Promise<void> {
    // The id is already in params at the end, so use params.length as the parameter index
    // Oracle uses :1, :2, etc. for parameter binding
    const paramIndex = params.length;
    await this.db.query(
      `UPDATE centers SET ${updates.join(', ')} WHERE id = :${paramIndex}`,
      params
    );
  }

  /**
   * Delete a center (for CacheService)
   */
  async deleteCenterForCache(id: string | number): Promise<void> {
    await this.db.query(
      `DELETE FROM centers WHERE id = :1`,
      [id]
    );
  }

  /**
   * Create a session (for CacheService)
   */
  async createSessionForCache(name: string, description: string, centerIdsJson: string | null, createdBy: string | null): Promise<void> {
    await this.db.query(`
      INSERT INTO song_sessions (name, description, center_ids, created_by)
      VALUES (:1, :2, :3, :4)
    `, [String(name), String(description || ''), centerIdsJson, createdBy || null]);
  }

  /**
   * Update a session (for CacheService)
   */
  async updateSessionForCache(id: string, updateParts: string[], params: any[]): Promise<void> {
    await this.db.query(`
      UPDATE song_sessions 
      SET ${updateParts.join(', ')} 
      WHERE RAWTOHEX(id) = :${params.length}
    `, params);
  }

  /**
   * Delete a session (for CacheService)
   */
  async deleteSessionForCache(id: string): Promise<void> {
    await this.db.query(`DELETE FROM song_sessions WHERE RAWTOHEX(id) = :1`, [id]);
  }

  /**
   * Duplicate a session (for CacheService)
   */
  async duplicateSessionForCache(newName: string, description: string): Promise<void> {
    await this.db.query(`
      INSERT INTO song_sessions (name, description)
      VALUES (:1, :2)
    `, [String(newName), String(description || '')]);
  }

  /**
   * Copy session items (for CacheService)
   */
  async copySessionItemsForCache(newSessionId: string, oldSessionId: string): Promise<void> {
    await this.db.query(`
      INSERT INTO song_session_items (session_id, song_id, singer_id, pitch, sequence_order)
      SELECT HEXTORAW(:1), song_id, singer_id, pitch, sequence_order
      FROM song_session_items
      WHERE RAWTOHEX(session_id) = :2
    `, [newSessionId, oldSessionId]);
  }

  /**
   * Add a session item (for CacheService)
   */
  async addSessionItemForCache(sessionId: string, songId: string, singerId: string | null, pitch: string, sequenceOrder: number): Promise<void> {
    await this.db.query(`
      INSERT INTO song_session_items (session_id, song_id, singer_id, pitch, sequence_order)
      VALUES (
        HEXTORAW(:1),
        HEXTORAW(:2),
        ${singerId ? 'HEXTORAW(:3)' : 'NULL'},
        :${singerId ? '4' : '3'},
        :${singerId ? '5' : '4'}
      )
    `, singerId
      ? [sessionId, songId, singerId, String(pitch || ''), sequenceOrder]
      : [sessionId, songId, String(pitch || ''), sequenceOrder]
    );
  }

  /**
   * Update a session item (for CacheService)
   */
  async updateSessionItemForCache(id: string, updateParts: string[], params: any[]): Promise<void> {
    await this.db.query(`
      UPDATE song_session_items 
      SET ${updateParts.join(', ')} 
      WHERE RAWTOHEX(id) = :${params.length}
    `, params);
  }

  /**
   * Delete a session item (for CacheService)
   */
  async deleteSessionItemForCache(id: string): Promise<void> {
    await this.db.query(`DELETE FROM song_session_items WHERE RAWTOHEX(id) = :1`, [id]);
  }

  /**
   * Delete all session items (for CacheService)
   */
  async deleteAllSessionItemsForCache(sessionId: string): Promise<void> {
    await this.db.query(`
      DELETE FROM song_session_items 
      WHERE RAWTOHEX(session_id) = :1
    `, [sessionId]);
  }

  /**
   * Reorder session items (for CacheService)
   */
  async reorderSessionItemsForCache(sessionId: string, itemIds: string[]): Promise<void> {
    for (let i = 0; i < itemIds.length; i++) {
      await this.db.query(`
        UPDATE song_session_items 
        SET sequence_order = :1, updated_at = CURRENT_TIMESTAMP 
        WHERE RAWTOHEX(id) = :2 AND RAWTOHEX(session_id) = :3
      `, [i + 1, itemIds[i], sessionId]);
    }
  }

  /**
   * Save song mapping (for CacheService)
   */
  async saveSongMappingForCache(csvSongName: string, dbSongId: string, dbSongName: string, isUpdate: boolean): Promise<void> {
    if (isUpdate) {
      await this.db.query(`
        UPDATE csv_song_mappings
        SET db_song_id = HEXTORAW(:1),
            db_song_name = :2,
            updated_at = CURRENT_TIMESTAMP
        WHERE csv_song_name = :3
      `, [dbSongId, dbSongName, csvSongName]);
    } else {
      await this.db.query(`
        INSERT INTO csv_song_mappings (csv_song_name, db_song_id, db_song_name)
        VALUES (:1, HEXTORAW(:2), :3)
      `, [csvSongName, dbSongId, dbSongName]);
    }
  }

  /**
   * Delete song mapping (for CacheService)
   */
  async deleteSongMappingForCache(id: string): Promise<void> {
    await this.db.query(`DELETE FROM csv_song_mappings WHERE RAWTOHEX(id) = :1`, [id]);
  }

  /**
   * Save pitch mapping (for CacheService)
   */
  async savePitchMappingForCache(originalFormat: string, normalizedFormat: string, isUpdate: boolean): Promise<void> {
    if (isUpdate) {
      await this.db.query(`
        UPDATE csv_pitch_mappings
        SET normalized_format = :1,
            updated_at = CURRENT_TIMESTAMP
        WHERE original_format = :2
      `, [normalizedFormat, originalFormat]);
    } else {
      await this.db.query(`
        INSERT INTO csv_pitch_mappings (original_format, normalized_format)
        VALUES (:1, :2)
      `, [originalFormat, normalizedFormat]);
    }
  }

  /**
   * Delete pitch mapping (for CacheService)
   */
  async deletePitchMappingForCache(id: string): Promise<void> {
    await this.db.query(`DELETE FROM csv_pitch_mappings WHERE RAWTOHEX(id) = :1`, [id]);
  }

  /**
   * Create feedback (for CacheService)
   */
  async createFeedbackForCache(feedback: string, category: string, email: string | null, userAgent: string | null, url: string | null, ipAddress: string | null): Promise<void> {
    await this.db.query(
      `INSERT INTO feedback (feedback, category, email, user_agent, url, ip_address, status, created_at, updated_at)
       VALUES (:1, :2, :3, :4, :5, :6, 'new', SYSTIMESTAMP, SYSTIMESTAMP)`,
      [
        feedback,
        category,
        email,
        userAgent || null,
        url || null,
        ipAddress || null
      ]
    );
  }

  /**
   * Update feedback (for CacheService)
   */
  async updateFeedbackForCache(id: string | number, updates: string[], params: any[]): Promise<void> {
    await this.db.query(
      `UPDATE feedback SET ${updates.join(', ')} WHERE RAWTOHEX(id) = :${params.length}`,
      params
    );
  }

  /**
   * Delete feedback (for CacheService)
   */
  async deleteFeedbackForCache(id: string | number): Promise<void> {
    await this.db.query(
      `DELETE FROM feedback WHERE RAWTOHEX(id) = :1`,
      [id]
    );
  }
}

// Export singleton instance
export const databaseWriteService = new DatabaseWriteService();
export default databaseWriteService;

