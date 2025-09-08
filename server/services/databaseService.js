const mysql = require('mysql2/promise');

/**
 * Database Service for direct WordPress database operations
 * Handles archive operations and other database updates
 */
class DatabaseService {
  constructor() {
    this.connection = null;
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wordpress',
      port: process.env.DB_PORT || 3306,
    };
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection(this.config);
      console.log('✅ Database Service: Connected to WordPress database');
      return this.connection;
    } catch (error) {
      console.error('❌ Database Service: Connection failed:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      console.log('📴 Database Service: Disconnected from database');
    }
  }

  async ensureConnection() {
    if (!this.connection) {
      await this.connect();
    }
    return this.connection;
  }

  /**
   * Archive or unarchive a chat thread for a specific user
   * Updates the wp_chat_participants table with archive status
   */
  async archiveThreadForUser(threadId, userId, archived = true) {
    try {
      await this.ensureConnection();
      
      console.log(`📦 Database Service: ${archived ? 'Archiving' : 'Unarchiving'} thread ${threadId} for user ${userId}`);

      // Check if wp_chat_participants has an is_archived column
      // If not, we'll use the wp_chat_thread_meta table
      
      // First, try to update wp_chat_participants table
      const updateParticipantsQuery = `
        UPDATE wp_chat_participants 
        SET is_archived = ? 
        WHERE thread_id = ? AND user_id = ?
      `;
      
      try {
        const [result] = await this.connection.execute(updateParticipantsQuery, [
          archived ? 1 : 0,
          threadId,
          userId
        ]);

        if (result.affectedRows > 0) {
          console.log(`✅ Database Service: Updated wp_chat_participants table`);
          return { success: true, method: 'participants_table' };
        }
      } catch (error) {
        console.log('⚠️ Database Service: wp_chat_participants update failed, trying metadata approach...');
      }

      // Fallback: Use metadata table approach
      const metaKey = `archived_${userId}`;
      const metaValue = archived ? '1' : '0';

      // Check if metadata exists
      const checkMetaQuery = `
        SELECT meta_id FROM wp_chat_thread_meta 
        WHERE thread_id = ? AND meta_key = ?
      `;
      
      const [metaRows] = await this.connection.execute(checkMetaQuery, [threadId, metaKey]);

      if (metaRows.length > 0) {
        // Update existing metadata
        const updateMetaQuery = `
          UPDATE wp_chat_thread_meta 
          SET meta_value = ? 
          WHERE thread_id = ? AND meta_key = ?
        `;
        
        await this.connection.execute(updateMetaQuery, [metaValue, threadId, metaKey]);
      } else {
        // Insert new metadata
        const insertMetaQuery = `
          INSERT INTO wp_chat_thread_meta (thread_id, meta_key, meta_value) 
          VALUES (?, ?, ?)
        `;
        
        await this.connection.execute(insertMetaQuery, [threadId, metaKey, metaValue]);
      }

      console.log(`✅ Database Service: Updated archive status via metadata table`);
      return { success: true, method: 'metadata_table' };

    } catch (error) {
      console.error('❌ Database Service: Archive operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get archived status for a thread and user
   */
  async isThreadArchivedForUser(threadId, userId) {
    try {
      await this.ensureConnection();

      // Try wp_chat_participants table first
      const participantsQuery = `
        SELECT is_archived FROM wp_chat_participants 
        WHERE thread_id = ? AND user_id = ?
      `;
      
      try {
        const [rows] = await this.connection.execute(participantsQuery, [threadId, userId]);
        if (rows.length > 0 && rows[0].is_archived !== undefined) {
          return !!rows[0].is_archived;
        }
      } catch (error) {
        // Column might not exist, continue to metadata check
      }

      // Fallback: Check metadata table
      const metaQuery = `
        SELECT meta_value FROM wp_chat_thread_meta 
        WHERE thread_id = ? AND meta_key = ?
      `;
      
      const [metaRows] = await this.connection.execute(metaQuery, [threadId, `archived_${userId}`]);
      
      if (metaRows.length > 0) {
        return metaRows[0].meta_value === '1';
      }

      return false;
    } catch (error) {
      console.error('❌ Database Service: Check archive status failed:', error.message);
      return false;
    }
  }

  /**
   * Get all archived threads for a user
   */
  async getArchivedThreadsForUser(userId, limit = 50, offset = 0) {
    try {
      await this.ensureConnection();

      // Try to get from wp_chat_participants first
      const participantsQuery = `
        SELECT t.*, p.is_archived
        FROM wp_chat_threads t
        JOIN wp_chat_participants p ON t.id = p.thread_id
        WHERE p.user_id = ? AND p.is_archived = 1
        ORDER BY t.last_activity DESC
        LIMIT ? OFFSET ?
      `;

      try {
        const [rows] = await this.connection.execute(participantsQuery, [userId, limit, offset]);
        if (rows.length > 0) {
          console.log(`✅ Database Service: Found ${rows.length} archived threads via participants table`);
          return rows;
        }
      } catch (error) {
        console.log('⚠️ Database Service: participants table query failed, trying metadata...');
      }

      // Fallback: Get from metadata table
      const metaQuery = `
        SELECT DISTINCT t.*
        FROM wp_chat_threads t
        JOIN wp_chat_thread_meta m ON t.id = m.thread_id
        WHERE m.meta_key = ? AND m.meta_value = '1'
        ORDER BY t.last_activity DESC
        LIMIT ? OFFSET ?
      `;

      const [metaRows] = await this.connection.execute(metaQuery, [`archived_${userId}`, limit, offset]);
      console.log(`✅ Database Service: Found ${metaRows.length} archived threads via metadata table`);
      return metaRows;

    } catch (error) {
      console.error('❌ Database Service: Get archived threads failed:', error.message);
      return [];
    }
  }
}

module.exports = new DatabaseService();
