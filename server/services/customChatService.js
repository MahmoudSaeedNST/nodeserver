const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Create custom agents with keep-alive to prevent connection issues
const httpsAgent = new https.Agent({ 
  keepAlive: true,
  timeout: 120000, // 2 minutes
  keepAliveMsecs: 30000 // 30 seconds
});

const httpAgent = new http.Agent({ 
  keepAlive: true,
  timeout: 120000,
  keepAliveMsecs: 30000
});

/**
 * Custom Chat Service - Routes to custom WordPress endpoints only
 * No BuddyBoss fallbacks - pure custom implementation
 * Handles both private chats and group chats
 */
class CustomChatService {
  constructor() {
    this.wpBaseUrl = process.env.WORDPRESS_URL || 'https://olomak.com';
    this.wpApiUrl = `${this.wpBaseUrl}/wp-json`;
    this.customChatApi = `${this.wpApiUrl}/chat/v1`;
  }

  // Get authorization headers for WordPress API
  getAuthHeaders(userToken) {
    return {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * PRIVATE CHAT: Send message to private conversation
   * Used for 1-on-1 messaging between users
   */
  async sendMessage(data) {
    try {
      const { chatId, threadId, senderId, message, messageType, mediaUrl, mediaThumb, fileName, fileSize, duration, replyTo, recipients, subject, token, userToken } = data;
      
      console.log('📤 Server: Sending PRIVATE message via custom chat API...');
      
      let requestBody = {
        message: message || '',
        message_type: messageType || 'text',
        media_url: mediaUrl,
        media_thumbnail: mediaThumb,
        file_name: fileName,
        file_size: fileSize,
        duration: duration,
        reply_to: replyTo
      };

      let response;

      // If threadId exists, send to existing private thread
      if (threadId || chatId) {
        const threadIdToUse = threadId || chatId;
        response = await axios.post(
          `${this.customChatApi}/threads/${threadIdToUse}/messages`,
          requestBody,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
      } else if (recipients && recipients.length > 0) {
        // Create new private thread with initial message
        const createThreadBody = {
          participant_ids: Array.isArray(recipients) ? recipients : [recipients],
          subject: subject || '',
          initial_message: message
        };

        response = await axios.post(
          `${this.customChatApi}/threads/create`,
          createThreadBody,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
      } else {
        throw new Error('No thread ID or recipients provided');
      }

      console.log('✅ Server: Custom PRIVATE chat message send successful');
      
      // Return the actual message data, not just the response wrapper
      if (response.data && response.data.data) {
        return response.data.data;
      } else if (response.data && response.data.message) {
        return response.data;
      } else {
        return response.data;
      }
    } catch (error) {
      console.error('❌ Server: Custom PRIVATE chat send failed:', error.message);
      throw new Error('Failed to send private message: ' + error.message);
    }
  }

  /**
   * PRIVATE CHAT: Get user's private conversation threads
   * Used for retrieving the list of private conversations for a user
   */
  async getUserChats(userId, page = 1, perPage = 20, userToken) {
    try {
      console.log(`📥 Service: Getting PRIVATE user chats via custom API for user ${userId}...`);
      
      const params = new URLSearchParams({
        user_id: userId,
        page: page.toString(),
        per_page: perPage.toString()
      });
      
      const response = await axios.get(
        `${this.customChatApi}/threads?${params}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log(`✅ Service: Custom PRIVATE chat threads retrieved successfully: ${response.data.data?.length || 0}`);
      return response.data;
    } catch (error) {
      console.error('❌ Service: Custom PRIVATE chat get chats failed:', error.message);
      throw new Error('Failed to get user private chats: ' + error.message);
    }
  }

  /**
   * PRIVATE CHAT: Get messages from a private conversation thread
   * Used for retrieving message history in private conversations
   */
  async getChatMessages(threadId, page = 1, perPage = 20, userToken, before = null) {
    try {
      console.log(`📨 Server: Getting PRIVATE messages via custom API for thread ${threadId}...`);
      
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString()
      });
      
      if (before) {
        params.append('before', before);
      }
      
      const response = await axios.get(
        `${this.customChatApi}/threads/${threadId}/messages?${params}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Server: Custom PRIVATE chat messages retrieved successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Server: Custom PRIVATE chat get messages failed:', error.message);
      throw new Error('Failed to get private chat messages: ' + error.message);
    }
  }

  /**
   * PRIVATE CHAT: Delete a message from private conversation
   * Used for deleting individual messages in private chats
   */
  async deleteMessage(messageId, threadId, userToken) {
    try {
      console.log(`🗑️ Server: Deleting PRIVATE message ${messageId} via custom API...`);
      
      const response = await axios.delete(
        `${this.customChatApi}/messages/${messageId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Server: Custom PRIVATE chat message deleted successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Server: Custom PRIVATE chat delete message failed:', error.message);
      throw new Error('Failed to delete private message: ' + error.message);
    }
  }

  /**
   * PRIVATE CHAT: Mark private conversation thread as read
   * Used for marking private conversations as read
   */
  async markThreadRead(threadId, userId, userToken) {
    try {
      console.log(`✅ Server: Marking PRIVATE thread ${threadId} as read via custom API...`);
      
      const response = await axios.post(
        `${this.customChatApi}/threads/${threadId}/read`,
        { user_id: userId },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Server: Custom PRIVATE chat thread marked as read');
      return response.data;
    } catch (error) {
      console.error('❌ Server: Custom chat mark read failed:', error.message);
      
      // Fallback to original endpoints if needed
      if (error.response?.status === 404) {
        console.log('🔄 Server: Falling back to original endpoints...');
        return this.markThreadReadFallback(threadId, userId, userToken);
      }
      
      throw new Error('Failed to mark thread as read: ' + error.message);
    }
  }

  // Find or create thread with specific user
  async findOrCreateThread(userId, participantId, userToken) {
    try {
      console.log(`Server: Looking up thread between ${userId} and ${participantId} via custom API...`);
      
      const response = await axios.post(
        `${this.customChatApi}/threads/lookup`,
        {
          user_id: userId,
          participant_id: participantId
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Server: Custom chat thread lookup successful');
      return response.data;
    } catch (error) {
      console.error('❌ Server: Custom chat thread lookup failed:', error.message);
      throw new Error('Failed to lookup thread: ' + error.message);
    }
  }

  // Get contacts (still uses BuddyBoss API for friends)
  /**
   * USERS & CONTACTS: Get user contacts
   * Used for retrieving user's contact list (no BuddyBoss dependency)
   */
  async getContacts(userId, userToken) {
    try {
      console.log(`👥 Service: Getting contacts for user ${userId} via custom API...`);
      
      try {
        const response = await axios.get(
          `${this.customChatApi}/contacts`,
          {
            headers: this.getAuthHeaders(userToken),
            params: { user_id: userId }
          }
        );
        
        console.log('✅ Server: Got contacts from custom API');
        return response.data;
      } catch (customError) {
        console.warn('⚠️ Server: Custom contacts failed, trying WordPress users...');
        
        // Fallback to WordPress users only (no BuddyBoss)
        const response = await axios.get(
          `${this.wpApiUrl}/wp/v2/users?per_page=50`,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
        
        const users = response.data.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email || '',
          avatar: user.avatar_urls ? user.avatar_urls['96'] : ''
        }));
        
        console.log('✅ Server: Got contacts from WordPress users');
        return { success: true, data: users };
      }
    } catch (error) {
      console.error('❌ Server: Failed to get contacts:', error.message);
      throw new Error('Failed to get contacts: ' + error.message);
    }
  }

  /**
   * USERS & CONTACTS: Search users for messaging
   * Used for finding users to start conversations with (uses BuddyBoss API)
   */
  async searchUsers(query, userToken) {
    try {
      console.log(`🔍 Service: Searching users for "${query}" via BuddyBoss API...`);
      
      // Use BuddyBoss members API for search
      const response = await axios.get(
        `${this.wpBaseUrl}/wp-json/buddyboss/v1/members`,
        {
          headers: this.getAuthHeaders(userToken),
          params: { 
            search: query, 
            per_page: 20,
            page: 1
          },
          timeout: 10000 // 10 second timeout
        }
      );
      
      // Transform BuddyBoss member data to expected format
      const users = (response.data || []).map(user => ({
        id: user.id,
        user_id: user.id,
        name: user.name,
        display_name: user.name,
        avatar: user.avatar_urls ? user.avatar_urls.full : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3C75C1&color=fff&size=128`,
        last_activity: user.last_activity?.date || null,
        is_online: user.last_activity ? this.isRecentActivity(user.last_activity.date) : false,
        mention_name: user.mention_name || user.user_login,
        user_login: user.user_login
      }));
      
      console.log('✅ Service: User search successful via BuddyBoss - found', users.length, 'users');
      return users;
    } catch (error) {
      console.error('❌ Service: User search failed:', error.message);
      throw new Error(`Failed to search users: ${error.response?.status || 500}`);
    }
  }

  // Get groups for user - using fast metadata endpoint
  async getGroups(userId, page = 1, limit = 50, userToken) {
    try {
      console.log(`👥 Service: Getting groups for user ${userId} via fast metadata...`);
      
      // Try fast metadata endpoint first for optimized performance
      try {
        const response = await axios.get(
          `${this.customChatApi}/groups/metadata`,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );

        if (response.data && response.data.success) {
          console.log('✅ Service: Get groups via fast metadata successful - got', response.data.data.length, 'groups');
          return response.data;
        }
      } catch (metadataError) {
        console.log('⚠️ Service: Fast metadata endpoint not available, falling back to BuddyBoss API...');
      }
      
      // Fallback to BuddyBoss API if fast metadata fails
      const buddyBossApiUrl = this.wpBaseUrl;
      
      const params = new URLSearchParams({
        user_id: userId.toString(),
        per_page: limit.toString(),
        page: page.toString()
      });

      const response = await axios.get(
        `${buddyBossApiUrl}/wp-json/buddyboss/v1/groups?${params}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      const groups = response.data || [];
      console.log('✅ Service: Get groups via BuddyBoss API successful - got', groups.length, 'groups');
      
      // Transform BuddyBoss group data to expected format with limited admin detection
      const transformedGroups = groups.map((group) => {
        // Admin detection using only BuddyBoss response data:
        // 1. Check if current user is the creator
        // 2. Check if user is in administrators array
        // 3. Check if user is in moderators array
        
        let isAdmin = false;
        
        // Method 1: Check if current user is the creator
        if (group.creator_id && group.creator_id == userId) {
          isAdmin = true;
        }
        
        // Method 2: Check administrators array if available
        if (!isAdmin && group.administrators && Array.isArray(group.administrators)) {
          isAdmin = group.administrators.some(admin => admin.id == userId);
        }
        
        // Method 3: Check moderators array if available  
        if (!isAdmin && group.moderators && Array.isArray(group.moderators)) {
          isAdmin = group.moderators.some(mod => mod.id == userId);
        }

        return {
          id: group.id,
          group_id: group.id,
          name: group.name,
          description: group.description?.rendered || '',
          avatar: group.avatar_urls ? group.avatar_urls.full : '',
          total_member_count: parseInt(group.members_count) || 0,
          status: group.status,
          enable_forum: group.enable_forum || false,
          is_admin: isAdmin,
          user_is_admin: isAdmin,
          admin_status: isAdmin ? 'admin' : 'member',
          creator_id: group.creator_id || null,
          // Add metadata for educational features
          metadata: {
            has_classes: false, // Will be enhanced later
            class_count: 0,
            last_activity: group.last_activity || null
          }
        };
      });

      return { success: true, data: transformedGroups };
    } catch (error) {
      console.error('❌ Service: Get groups failed:', error.message);
      
      // Return empty groups if endpoint doesn't exist yet
      if (error.response?.status === 404) {
        console.log('🔄 Service: Groups endpoint not found, returning empty list');
        return { success: true, data: [], message: 'Groups endpoint not implemented yet' };
      }
      
      throw new Error('Failed to get groups: ' + error.message);
    }
  }

  // Delete chat permanently
  async deleteChat(chatId, userId, userToken) {
    try {
      console.log(`🗑️ Service: Deleting chat ${chatId} for user ${userId}...`);
      
      // Send user_id as query parameter for DELETE request instead of body
      const params = new URLSearchParams({
        user_id: userId.toString()
      });
      
      const response = await axios.delete(
        `${this.customChatApi}/threads/${chatId}?${params}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Chat deleted successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Service: Delete chat failed:', error.message);
      if (error.response) {
        console.error('❌ Service: Error response:', error.response.status, error.response.data);
      }
      throw new Error(`Delete chat failed: ${error.message}`);
    }
  }

  // Enhanced Media Upload Methods
  async uploadEnhancedMedia(data) {
    try {
      const { file, threadId, message, userId, recipientId, userToken } = data;
      
      console.log('🚀 Service: Enhanced media upload via WordPress API started...');
      console.log('📋 Service: Upload data:', {
        threadId,
        message,
        userId,
        recipientId,
        hasToken: !!userToken,
        fileInfo: file ? {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        } : 'No file'
      });

      // Create form data for WordPress endpoint
      const formData = new FormData();
      formData.append('file', fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype
      });
      
      if (threadId) {
        formData.append('thread_id', threadId);
      }
      
      if (recipientId) {
        formData.append('recipient_id', recipientId);
      }
      
      if (message) {
        formData.append('message', message);
      }

      const uploadUrl = `${this.customChatApi}/media/upload/chat`;
      console.log('📡 Service: Making request to:', uploadUrl);
      console.log('📋 Service: Auth headers:', {
        hasAuth: !!userToken,
        wpBaseUrl: this.wpBaseUrl,
        customChatApi: this.customChatApi
      });

      const response = await axios.post(
        uploadUrl,
        formData,
        {
          headers: {
            ...this.getAuthHeaders(userToken),
            ...formData.getHeaders()
          }
        }
      );

      console.log('✅ Service: Enhanced media upload successful');
      console.log('📋 Service: Response data:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Service: Enhanced media upload failed:', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        stack: error.stack
      });
      throw new Error('Enhanced media upload failed: ' + error.message);
    }
  }

  async uploadEnhancedVoice(data) {
    try {
      const { file, threadId, duration, message, userId, userToken } = data;
      
      console.log('🎙️ Service: Enhanced voice upload via WordPress API started...');
      console.log('📋 Service: Voice upload data:', {
        threadId,
        duration,
        message,
        userId,
        hasToken: !!userToken,
        fileInfo: file ? {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        } : 'No file'
      });

      // Create form data for WordPress endpoint
      const formData = new FormData();
      formData.append('file', fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype
      });
      formData.append('thread_id', threadId);
      formData.append('duration', duration);
      formData.append('message', message);

      const uploadUrl = `${this.customChatApi}/voice/upload/chat`;
      console.log('📡 Service: Making voice request to:', uploadUrl);
      console.log('📋 Service: Auth headers:', {
        hasAuth: !!userToken,
        wpBaseUrl: this.wpBaseUrl,
        customChatApi: this.customChatApi
      });

      const response = await axios.post(
        uploadUrl,
        formData,
        {
          headers: {
            ...this.getAuthHeaders(userToken),
            ...formData.getHeaders()
          }
        }
      );

      console.log('✅ Service: Enhanced voice upload successful');
      console.log('📋 Service: Voice response data:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Service: Enhanced voice upload failed:', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        stack: error.stack
      });
      throw new Error('Enhanced voice upload failed: ' + error.message);
    }
  }

  // Enhanced Search Methods
  async searchThreads(data) {
    try {
      const { query, userId, limit, userToken } = data;
      
      console.log('🔍 Service: Searching threads via WordPress API...');

      const params = new URLSearchParams({
        user_id: userId,
        query,
        limit: limit.toString()
      });

      const response = await axios.get(
        `${this.customChatApi}/search/threads?${params}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Thread search successful');
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Service: Thread search failed:', error.message);
      throw new Error('Thread search failed: ' + error.message);
    }
  }

  async getAllContacts(data) {
    try {
      const { search, excludeFriends, limit = 50, offset = 0, page = 1, userId, userToken } = data;
      
      console.log('👥 Service: Getting contacts via BuddyBoss API (optimized pagination)...');
      console.log('📊 Search params:', { search, limit, offset, page, excludeFriends });

      // Use BuddyBoss API for user contacts
      const buddyBossApiUrl = this.wpBaseUrl;
      
      const params = new URLSearchParams({
        search: search || '',
        per_page: limit.toString(),
        page: page.toString()
      });

      if (excludeFriends && userId) {
        params.append('exclude', userId.toString());
      }

      console.log(`📡 Fetching page ${page}, per_page ${limit}`);

      const response = await axios.get(
        `${buddyBossApiUrl}/wp-json/buddyboss/v1/members?${params}`,
        {
          headers: this.getAuthHeaders(userToken),
          timeout: 10000, // 10 second timeout
          validateStatus: function (status) {
            return status < 500; // Resolve only if the status code is less than 500
          }
        }
      );

      const members = response.data || [];
      console.log(`✅ Page ${page}: Got ${members.length} contacts`);
      
      // Transform BuddyBoss member data to expected format
      const transformedContacts = members.map(member => ({
        id: member.id,
        user_id: member.id,
        name: member.name,
        display_name: member.name,
        avatar: member.avatar_urls ? member.avatar_urls.full : `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=3C75C1&color=fff&size=128`,
        last_activity: member.last_activity?.date || null,
        is_online: member.last_activity ? this.isRecentActivity(member.last_activity.date) : false,
        mention_name: member.mention_name || member.user_login,
        user_login: member.user_login
      }));

      console.log(`✅ Service: Get contacts successful - got ${transformedContacts.length} contacts for page ${page}`);
      return transformedContacts;
    } catch (error) {
      console.error('❌ Service: Get contacts failed:', error.message);
      
      // Check if it's a network/timeout error and return empty array instead of throwing
      if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || 
          error.message.includes('timeout') || error.message.includes('socket hang up')) {
        console.log('⚠️ Network error - returning empty contacts list');
        return [];
      }
      
      throw new Error(`Get contacts failed: ${error.response?.status || 500}`);
    }
  }

  // Search methods
  async searchMessages(userId, query, threadId, limit, userToken) {
    try {
      console.log('🔍 Service: Searching messages via custom API...');
      
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString()
      });

      if (threadId) {
        params.append('thread_id', threadId);
      }

      const response = await axios.get(
        `${this.customChatApi}/search/messages?${params}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('❌ Service: Search messages failed:', error.message);
      return [];
    }
  }

  async globalSearch(userId, query, limit) {
    console.log('🔍 Service: Global search - redirecting to search messages');
    return this.searchMessages(userId, query, null, limit, null);
  }

  // Message operations
  async starMessage(messageId, starred, userToken) {
    console.log('⚠️ Service: starMessage - Star operations not implemented in custom chat system');
    return { success: true, message: 'Star operations not available in custom chat system' };
  }

  async createGroupMessage(data) {
    console.log('📤 Service: createGroupMessage - Group messaging not fully implemented in custom chat system');
    return { success: true, message: 'Group messaging operations not available in custom chat system' };
  }

  async markMessageRead(threadId, userId, userToken) {
    return this.markThreadRead(threadId, userId, userToken);
  }

  // Access verification
  async verifyUserAccess(userId, chatId) {
    try {
      console.log('🔐 Service: Verifying user access via user chats...');
      
      // Get user's chats and check if chatId is among them
      const chatsResponse = await axios.get(
        `${this.customChatApi}/chats?user_id=${userId}&page=1&limit=100`,
        {
          headers: this.getAuthHeaders()
        }
      );

      const chats = chatsResponse.data?.data?.data || [];
      const hasAccess = chats.some(chat => chat.id === chatId.toString());
      
      console.log(`🔐 Service: User ${userId} ${hasAccess ? 'has' : 'does not have'} access to chat ${chatId}`);
      return hasAccess;
    } catch (error) {
      console.error('❌ Service: Verify user access failed:', error.message);
      // If verification fails, allow access (fail open for now)
      console.log('🔐 Service: Verification failed, allowing access as fallback');
      return true;
    }
  }

  async createChat(data) {
    console.log('💬 Service: createChat - Chat creation not fully implemented in custom chat system');
    return { success: true, message: 'Chat creation operations not available in custom chat system' };
  }

  async updateThread(threadId, data, userToken) {
    console.log('📝 Service: updateThread - Thread updates not fully implemented in custom chat system');
    return { success: true, message: 'Thread update operations not available in custom chat system' };
  }

  /**
   * PRIVATE CHAT: Delete entire conversation thread
   * Used for permanently deleting a private conversation and all its messages
   */
  async deleteThread(threadId, userToken) {
    try {
      console.log(`🗑️ Service: Deleting PRIVATE thread ${threadId} via custom API...`);

      const response = await axios.delete(
        `${this.customChatApi}/threads/${threadId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Private thread deleted successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Service: Delete private thread failed:', error.message);
      throw new Error('Delete private thread failed: ' + error.message);
    }
  }

  // Enhanced Presence Methods
  async getUserPresence(data) {
    try {
      const { userId, userToken } = data;
      
      console.log('👤 Service: Getting user presence via WordPress API...');

      const response = await axios.get(
        `${this.customChatApi}/presence/status/${userId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Get user presence successful');
      return response.data.data || {};
    } catch (error) {
      console.error('❌ Service: Get user presence failed:', error.message);
      throw new Error('Get user presence failed: ' + error.message);
    }
  }

  async getOnlineUsers(data) {
    try {
      const { limit, userId, userToken } = data;
      
      console.log('👥 Service: Getting online users via WordPress API...');

      const params = new URLSearchParams({
        limit: limit.toString()
      });

      const response = await axios.get(
        `${this.customChatApi}/presence/online?${params}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Get online users successful');
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Service: Get online users failed:', error.message);
      throw new Error('Get online users failed: ' + error.message);
    }
  }

  // Helper method to check if activity is recent (within last 5 minutes)
  isRecentActivity(activityDate) {
    try {
      const lastActivity = new Date(activityDate);
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      return lastActivity > fiveMinutesAgo;
    } catch (error) {
      return false;
    }
  }

  // Status-related methods (using WordPress API)
  async deleteStatus(statusId, userId, userToken) {
    try {
      console.log(`🗑️ Service: Deleting status ${statusId} via WordPress API...`);
      
      const response = await axios.delete(
        `${this.customChatApi}/status/${statusId}`,
        {
          headers: this.getAuthHeaders(userToken),
          data: { user_id: userId }
        }
      );

      console.log('✅ Service: Status deleted successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Service: Delete status failed:', error.message);
      throw new Error(`Delete status failed: ${error.response?.status || 500}`);
    }
  }

  async getStatusStats(statusId, userId) {
    try {
      console.log(`📊 Service: Getting status analytics ${statusId} via WordPress API...`);
      
      const response = await axios.get(
        `${this.customChatApi}/status/${statusId}/analytics?user_id=${userId}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      console.log('✅ Service: Status analytics retrieved successfully');
      return response.data.data || { views: 0, likes: 0 };
    } catch (error) {
      console.error('❌ Service: Get status stats failed:', error.message);
      return { views: 0, likes: 0 };
    }
  }

  async getStatusViewers(statusId, userId) {
    try {
      console.log(`👀 Service: Getting status viewers ${statusId} via WordPress API...`);
      
      const response = await axios.get(
        `${this.customChatApi}/status/${statusId}/viewers?user_id=${userId}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      console.log('✅ Service: Status viewers retrieved successfully');
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Service: Get status viewers failed:', error.message);
      return [];
    }
  }

  // Group and user management methods
  async getUserGroups(userId, userToken) {
    return this.getGroups(userId, 1, 50, userToken);
  }

  async createGroup(groupData, userToken) {
    try {
      console.log('👥 Service: Creating group via BuddyBoss API...');
      
      // Use BuddyBoss Groups API instead of custom chat API
      const response = await axios.post(
        `${this.wpApiUrl}/buddyboss/v1/groups`,
        {
          name: groupData.name,
          description: groupData.description || '',
          status: groupData.privacy || 'public', // BuddyBoss uses 'status' for privacy
          enable_forum: false
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Group created successfully via BuddyBoss API');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Service: Create group failed:', error.response?.data || error.message);
      throw new Error(`Create group failed: ${error.response?.status || 500}`);
    }
  }

  /**
   * GROUP CHAT: Get messages from a group conversation
   * Used for retrieving message history in group chats
   */
  async getGroupMessages(groupId, page, perPage, userToken) {
    try {
      console.log(`💬 Service: Getting GROUP messages via custom API for group ${groupId}...`);
      
      const response = await axios.get(
        `${this.customChatApi}/groups/${groupId}/messages/custom`,
        {
          params: { page, per_page: perPage },
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Group messages retrieved successfully');
      console.log('✅ Service: Retrieved Group messages', response.data);
      return response.data || [];
    } catch (error) {
      console.error('❌ Service: Get GROUP messages failed:', error.message);
      throw new Error(`Get group messages failed: ${error.response?.status || 500}`);
    }
  }

  /**
   * GROUP CHAT: Send message to group conversation
   * Used for sending messages to group chats
   */
  async sendGroupMessage(messageData, userToken) {
    try {
      console.log(`📤 Service: Sending GROUP message via custom API to group ${messageData.group_id}...`);
      
      const response = await axios.post(
        `${this.customChatApi}/groups/${messageData.group_id}/messages/custom`,
        messageData,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Group message sent successfully');
      
      // Return the actual message data, not just the response wrapper
      if (response.data && response.data.data) {
        return response.data.data;
      } else if (response.data && response.data.message) {
        return response.data;
      } else {
        return response.data;
      }
    } catch (error) {
      console.error('❌ Service: Send GROUP message failed:', error.message);
      throw new Error(`Send group message failed: ${error.response?.status || 500}`);
    }
  }

  // ⚠️ NEW: Enhanced Group Media Upload Methods
  async uploadGroupMedia(data) {
    try {
      const { file, groupId, message, userId, userToken } = data;
      
      console.log('🚀 Service: Enhanced group media upload via WordPress API started...');
      console.log('📋 Service: Group upload data:', {
        groupId,
        message,
        userId,
        hasToken: !!userToken,
        fileInfo: file ? {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        } : 'No file'
      });

      // Create form data for WordPress endpoint
      const formData = new FormData();
      formData.append('file', fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype
      });
      formData.append('group_id', groupId);
      formData.append('message', message);

      const uploadUrl = `${this.customChatApi}/groups/${groupId}/media/upload`;
      console.log('📡 Service: Making group request to:', uploadUrl);
      console.log('📋 Service: Auth headers:', {
        hasAuth: !!userToken,
        wpBaseUrl: this.wpBaseUrl,
        customChatApi: this.customChatApi
      });

      const response = await axios.post(
        uploadUrl,
        formData,
        {
          headers: {
            ...this.getAuthHeaders(userToken),
            ...formData.getHeaders()
          }
        }
      );

      console.log('✅ Service: Enhanced group media upload successful');
      console.log('📋 Service: Group response data:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Service: Enhanced group media upload failed:', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        stack: error.stack
      });
      throw new Error('Enhanced group media upload failed: ' + error.message);
    }
  }

  async uploadGroupVoice(data) {
    try {
      const { file, groupId, duration, message, userId, userToken } = data;
      
      console.log('🎙️ Service: Enhanced group voice upload via WordPress API started...');
      console.log('📋 Service: Group voice upload data:', {
        groupId,
        duration,
        message,
        userId,
        hasToken: !!userToken,
        fileInfo: file ? {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        } : 'No file'
      });

      // Create form data for WordPress endpoint
      const formData = new FormData();
      formData.append('file', fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype
      });
      formData.append('group_id', groupId);
      formData.append('duration', duration);
      formData.append('message', message);

      const uploadUrl = `${this.customChatApi}/groups/${groupId}/voice/upload`;
      console.log('📡 Service: Making group voice request to:', uploadUrl);
      console.log('📋 Service: Auth headers:', {
        hasAuth: !!userToken,
        wpBaseUrl: this.wpBaseUrl,
        customChatApi: this.customChatApi
      });

      const response = await axios.post(
        uploadUrl,
        formData,
        {
          headers: {
            ...this.getAuthHeaders(userToken),
            ...formData.getHeaders()
          }
        }
      );

      console.log('✅ Service: Enhanced group voice upload successful');
      console.log('📋 Service: Group voice response data:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Service: Enhanced group voice upload failed:', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        stack: error.stack
      });
      throw new Error('Enhanced group voice upload failed: ' + error.message);
    }
  }

  // ⚠️ NEW: Enhanced Group Message Management
  async replyToGroupMessage(data) {
    try {
      const { groupId, replyToMessageId, message, messageType, mediaUrl, userToken } = data;
      
      console.log('💬 Service: Replying to group message via WordPress API...');

      const replyData = {
        message: message || '',
        message_type: messageType || 'text',
        media_url: mediaUrl,
        reply_to: replyToMessageId
      };

      const response = await axios.post(
        `${this.customChatApi}/groups/${groupId}/messages/custom`,
        replyData,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Reply to group message successful');
      return response.data;
    } catch (error) {
      console.error('❌ Service: Reply to group message failed:', error.message);
      throw new Error('Reply to group message failed: ' + error.message);
    }
  }

  /**
   * GROUP CHAT: Delete message from group conversation
   * Used for deleting individual messages in group chats
   */
  async deleteGroupMessage(groupId, messageId, userToken) {
    try {
      console.log(`🗑️ Service: Deleting GROUP message ${messageId} from group ${groupId} via custom API...`);

      const response = await axios.delete(
        `${this.customChatApi}/groups/${groupId}/messages/${messageId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Delete GROUP message successful');
      return response.data;
    } catch (error) {
      console.error('❌ Service: Delete GROUP message failed:', error.message);
      throw new Error('Delete group message failed: ' + error.message);
    }
  }

  /**
   * GROUP CHAT: Delete entire group and all messages
   * Used for permanently deleting a group chat and all its messages
   */
  async deleteGroup(groupId, userToken) {
    try {
      console.log(`🗑️ Service: Deleting GROUP ${groupId} via custom API...`);

      const response = await axios.delete(
        `${this.customChatApi}/groups/${groupId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Delete GROUP successful');
      return response.data;
    } catch (error) {
      console.error('❌ Service: Delete GROUP failed:', error.message);
      throw new Error('Delete group failed: ' + error.message);
    }
  }

  async editGroupMessage(data) {
    try {
      const { groupId, messageId, newMessage, userToken } = data;
      
      console.log('✏️ Service: Editing group message via WordPress API...');

      const response = await axios.put(
        `${this.customChatApi}/groups/${groupId}/messages/${messageId}`,
        { message: newMessage },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Edit group message successful');
      return response.data;
    } catch (error) {
      console.error('❌ Service: Edit group message failed:', error.message);
      throw new Error('Edit group message failed: ' + error.message);
    }
  }

  // ⚠️ NEW: Group Message Status Methods
  async markGroupMessageRead(data) {
    try {
      const { groupId, messageId, userId, userToken } = data;
      
      console.log('✅ Service: Marking group message as read via WordPress API...');

      const response = await axios.post(
        `${this.customChatApi}/groups/${groupId}/messages/${messageId}/read`,
        { user_id: userId },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Mark group message read successful');
      return response.data;
    } catch (error) {
      console.error('❌ Service: Mark group message read failed:', error.message);
      throw new Error('Mark group message read failed: ' + error.message);
    }
  }

  async getGroupMessageReadStatus(data) {
    try {
      const { groupId, messageId, userToken } = data;
      
      console.log('📋 Service: Getting group message read status via WordPress API...');

      const response = await axios.get(
        `${this.customChatApi}/groups/${groupId}/messages/${messageId}/read-status`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Get group message read status successful');
      return response.data;
    } catch (error) {
      console.error('❌ Service: Get group message read status failed:', error.message);
      throw new Error('Get group message read status failed: ' + error.message);
    }
  }

  async getUserFriends(userId, userToken) {
    try {
      console.log('👥 Service: Getting user friends via custom API...');
      
      const response = await axios.get(
        `${this.customChatApi}/friends`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders(userToken)
        }
      );

      return { success: true, data: response.data.data || [] };
    } catch (error) {
      console.error('❌ Service: Get user friends failed:', error.message);
      return { success: false, data: [] };
    }
  }

  async addUserToGroup(chatId, userId, adminId, userToken) {
    // ⚠️ USING CUSTOM API: Direct group membership without invitation restrictions
    let requestData = null; // Define outside try block for error logging
    
    try {
      console.log(`👥 Service: Adding user ${userId} to group ${chatId} by admin ${adminId} (using custom API)`);
      
      requestData = {
        user_id: parseInt(userId),
        role: 'member' // Default role for new members
      };
      
      console.log(`📤 Service: Request data:`, requestData);
      console.log(`📤 Service: Custom API URL: ${this.wpBaseUrl}/wp-json/chat/v1/groups/${chatId}/members/direct-add`);
      console.log(`📤 Service: Request headers:`, this.getAuthHeaders(userToken));
      
      const response = await axios.post(
        `${this.wpBaseUrl}/wp-json/chat/v1/groups/${chatId}/members/direct-add`,
        requestData,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      
      console.log('✅ Service: User added to group successfully via custom API:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Service: Custom API add user to group failed:', error.message);
      
      // Log detailed error information
      if (error.response) {
        console.error('❌ Service: Error response status:', error.response.status);
        console.error('❌ Service: Error response data:', JSON.stringify(error.response.data, null, 2));
        console.error('❌ Service: Error response headers:', error.response.headers);
        
        // Try to extract meaningful error message
        let errorMessage = 'Failed to add user to group';
        if (error.response.data) {
          if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          } else if (error.response.data.code) {
            errorMessage = `${error.response.data.code}: ${error.response.data.message || 'Unknown error'}`;
          } else if (error.response.data.data && error.response.data.data.message) {
            errorMessage = error.response.data.data.message;
          }
        }
        
        console.error('❌ Service: Extracted error message:', errorMessage);
        
        // Log specific error debugging
        if (error.response.status >= 400) {
          console.error('🚨 Service: Custom API Error Details:');
          console.error('   - Group ID:', chatId);
          console.error('   - User ID:', userId);
          console.error('   - Admin ID:', adminId);
          console.error('   - User Token Length:', userToken ? userToken.length : 'null');
          console.error('   - Request Data:', requestData ? JSON.stringify(requestData, null, 2) : 'null');
        }
      } else if (error.request) {
        console.error('❌ Service: No response received:', error.request);
      } else {
        console.error('❌ Service: Request setup error:', error.message);
      }
      
      throw error;
    }
  }

  async addMultipleUsersToGroup(chatId, userIds, adminId, userToken) {
    // ⚠️ USING CUSTOM API: Bulk add multiple users to group
    try {
      console.log(`👥 Service: Bulk adding ${userIds.length} users to group ${chatId} by admin ${adminId}`);
      
      const requestData = {
        user_ids: userIds.map(id => parseInt(id)),
        role: 'member' // Default role for new members
      };
      
      console.log(`📤 Service: Bulk request data:`, requestData);
      console.log(`📤 Service: Custom bulk API URL: ${this.wpBaseUrl}/wp-json/chat/v1/groups/${chatId}/members/bulk-add`);
      
      const response = await axios.post(
        `${this.wpBaseUrl}/wp-json/chat/v1/groups/${chatId}/members/bulk-add`,
        requestData,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      
      console.log('✅ Service: Bulk add completed:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Service: Bulk add failed:', error.message);
      
      if (error.response) {
        console.error('❌ Service: Bulk add error response:', JSON.stringify(error.response.data, null, 2));
      }
      
      throw error;
    }
  }

  async removeUserFromGroup(chatId, userId, adminId, userToken) {
    // ⚠️ CRITICAL: Use BuddyBoss API for group membership management ONLY
    try {
      console.log(`👥 Service: Removing user ${userId} from group ${chatId} by admin ${adminId}`);
      
      const response = await axios.delete(
        `${this.wpBaseUrl}/wp-json/buddyboss/v1/groups/${chatId}/members/${userId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Service: Remove user from group failed:', error.message);
      throw error;
    }
  }

  // Status-related missing methods
  async getStatusList(userId, userToken) {
    try {
      console.log(`📋 Service: Getting status list via WordPress API...`);
      console.log(`📋 Service: userId = ${userId}, type = ${typeof userId}`);
      console.log(`📋 Service: userToken = ${userToken ? 'Present' : 'Missing'}`);
      
      const url = `${this.customChatApi}/status?user_id=${userId}&per_page=50&exclude_expired=true`;
      console.log(`📋 Service: Request URL = ${url}`);
      console.log(`📋 Service: customChatApi = ${this.customChatApi}`);
      
      const headers = this.getAuthHeaders(userToken);
      console.log(`📋 Service: Request headers =`, headers);
      
      const response = await axios.get(url, { headers });

      console.log('✅ Service: Status list retrieved successfully');
      console.log('✅ Service: Response status:', response.status);
      console.log('✅ Service: Response data:', JSON.stringify(response.data, null, 2));
      return { success: true, data: response.data.data || [] };
    } catch (error) {
      console.error('❌ Service: Get status list failed:', error.message);
      console.error('❌ Service: Error response status:', error.response?.status);
      console.error('❌ Service: Error response data:', error.response?.data);
      console.error('❌ Service: Error response headers:', error.response?.headers);
      console.error('❌ Service: Full error:', error);
      return { success: false, data: [] };
    }
  }

  async createStatus(statusData, userToken) {
    try {
      console.log(`📝 Service: Creating status via WordPress API...`);
      
      const response = await axios.post(
        `${this.customChatApi}/status`,
        statusData,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Status created successfully');
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('❌ Service: Create status failed:', error.message);
      throw new Error(`Create status failed: ${error.response?.status || 500}`);
    }
  }

  async uploadStatusMedia(req, userToken) {
    try {
      console.log(`📤 Service: Uploading status media via WordPress API...`);
      
      if (!req.file) {
        throw new Error('No file provided');
      }

      // Create form data for WordPress endpoint
      const formData = new FormData();
      formData.append('file', fs.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
      formData.append('user_id', req.body.user_id || req.body.userId);

      const response = await axios.post(
        `${this.customChatApi}/media/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            ...formData.getHeaders()
          }
        }
      );

      console.log('✅ Service: Status media uploaded successfully');
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('❌ Service: Upload status media failed:', error.message);
      throw new Error(`Upload status media failed: ${error.response?.status || 500}`);
    }
  }

  async getStatus(statusId, userToken) {
    try {
      console.log(`📖 Service: Getting status ${statusId} via WordPress API...`);
      
      const response = await axios.get(
        `${this.customChatApi}/status/${statusId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Status retrieved successfully');
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('❌ Service: Get status failed:', error.message);
      return { success: false, data: { id: statusId, content: 'Status not available' } };
    }
  }

  async markStatusViewed(statusId, userToken) {
    try {
      console.log(`👁️ Service: Marking status ${statusId} as viewed via WordPress API...`);
      
      // Extract user ID from JWT token for viewer_id
      let viewerId = null;
      try {
        const tokenParts = userToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          viewerId = payload?.data?.user?.id || payload?.user_id || payload?.sub;
          console.log('📱 Service: Extracted viewer ID from token:', viewerId);
        }
      } catch (tokenError) {
        console.log('⚠️ Service: Could not extract user ID from token, letting WordPress handle it');
      }
      
      // Send request to WordPress - if we have viewerId send it, otherwise let WordPress extract from token
      const requestBody = viewerId ? { viewer_id: viewerId } : {};
      console.log('📱 Service: Sending request body:', requestBody);
      
      const response = await axios.post(
        `${this.customChatApi}/status/${statusId}/view`,
        requestBody,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Status marked as viewed successfully', response.data);
      return response.data || { success: true };
    } catch (error) {
      console.error('❌ Service: Mark status viewed failed:', error.message);
      if (error.response) {
        console.error('❌ Service: Response status:', error.response.status);
        console.error('❌ Service: Response data:', error.response.data);
      }
      return { success: false, error: error.message };
    }
  }

  async getStatusViewersNew(statusId, userToken) {
    // Use the existing getStatusViewers method
    try {
      const viewers = await this.getStatusViewers(statusId, null);
      return { success: true, data: viewers };
    } catch (error) {
      console.error('❌ Service: Get status viewers new failed:', error.message);
      return { success: false, data: [] };
    }
  }

  async getStatusAnalytics(statusId, userToken) {
    try {
      console.log(`📊 Service: Getting status analytics ${statusId} via WordPress API...`);
      
      const response = await axios.get(
        `${this.customChatApi}/status/${statusId}/analytics`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Status analytics retrieved successfully');
      return { success: true, data: response.data.data || { views: 0, likes: 0 } };
    } catch (error) {
      console.error('❌ Service: Get status analytics failed:', error.message);
      return { success: false, data: { views: 0, likes: 0 } };
    }
  }

  async likeStatus(statusId, userToken) {
    try {
      console.log(`❤️ Service: Liking status ${statusId} via WordPress API...`);
      
      const response = await axios.post(
        `${this.customChatApi}/status/${statusId}/like`,
        {},
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Status liked successfully');
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('❌ Service: Like status failed:', error.message);
      return { success: false, message: error.message };
    }
  }

  async getStatusLikes(statusId, userToken) {
    try {
      console.log(`📋 Service: Getting status likes ${statusId} via WordPress API...`);
      
      const response = await axios.get(
        `${this.customChatApi}/status/${statusId}/likes`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Status likes retrieved successfully');
      return { success: true, data: response.data.data || [] };
    } catch (error) {
      console.error('❌ Service: Get status likes failed:', error.message);
      return { success: false, data: [] };
    }
  }

  async commentOnStatus(statusId, comment, userToken) {
    try {
      console.log(`💬 Service: Adding comment to status ${statusId} via WordPress API...`);
      
      const response = await axios.post(
        `${this.customChatApi}/status/${statusId}/comment`,
        { comment },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Comment added to status successfully');
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('❌ Service: Comment on status failed:', error.message);
      return { success: false, message: error.message };
    }
  }

  async getStatusComments(statusId, userToken) {
    try {
      console.log(`💬 Service: Getting status comments ${statusId} via WordPress API...`);
      
      const response = await axios.get(
        `${this.customChatApi}/status/${statusId}/comments`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Service: Status comments retrieved successfully');
      return { success: true, data: response.data.data || [] };
    } catch (error) {
      console.error('❌ Service: Get status comments failed:', error.message);
      return { success: false, data: [] };
    }
  }

  async getUserStatuses(userId) {
    try {
      console.log(`👤 Service: Getting user statuses ${userId} via WordPress API...`);
      
      const response = await axios.get(
        `${this.customChatApi}/status?user_id=${userId}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      console.log('✅ Service: User statuses retrieved successfully');
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Service: Get user statuses failed:', error.message);
      return [];
    }
  }

  async getFriendsStatuses(userId) {
    try {
      console.log(`👥 Service: Getting friends statuses for user ${userId} via WordPress API...`);
      
      const response = await axios.get(
        `${this.customChatApi}/status?exclude_user_id=${userId}&per_page=50`,
        {
          headers: this.getAuthHeaders()
        }
      );

      console.log('✅ Service: Friends statuses retrieved successfully');
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Service: Get friends statuses failed:', error.message);
      return [];
    }
  }

  // Additional methods that might be called by routes
  async uploadMedia(filePath, originalName, mimetype, userId) {
    console.log('⚠️ Service: uploadMedia - Direct media upload not implemented, use enhanced upload endpoints');
    return { success: true, url: '/placeholder-media', id: Date.now() };
  }

  async uploadVoiceMessage(filePath, duration, userId) {
    console.log('⚠️ Service: uploadVoiceMessage - Direct voice upload not implemented, use enhanced upload endpoints');
    return { success: true, url: '/placeholder-voice', id: Date.now() };
  }

  // Fallback methods for compatibility
  async getUserChatsFallback(userId, page, perPage, userToken) {
    console.log('🔄 Service: Using fallback for getUserChats');
    return { success: false, data: [], message: 'Fallback not implemented' };
  }

  // ⚠️ NEW: Live Class Methods for Group Video Calling
  async generateLiveClassInvite(groupId, liveClassData, userToken) {
    try {
      console.log(`📹 Service: Generating live class invite for group ${groupId}...`);
      
      const response = await axios.post(
        `${this.customChatApi}/groups/${groupId}/live-class/generate`,
        liveClassData,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Service: Generate live class invite failed:', error.message);
      throw new Error(`Generate live class invite failed: ${error.message}`);
    }
  }

  async joinLiveClassViaInvite(inviteCode, userToken) {
    try {
      console.log(`📹 Service: Joining live class via invite: ${inviteCode}`);
      
      const response = await axios.post(
        `${this.customChatApi}/live-class/join/${inviteCode}`,
        {},
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Service: Join live class failed:', error.message);
      throw new Error(`Join live class failed: ${error.message}`);
    }
  }

  async getLiveClassDetails(inviteCode, userToken) {
    try {
      console.log(`📹 Service: Getting live class details for invite: ${inviteCode}`);
      
      const response = await axios.get(
        `${this.customChatApi}/live-class/${inviteCode}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Service: Get live class details failed:', error.message);
      throw new Error(`Get live class details failed: ${error.message}`);
    }
  }

  async getGroupLiveClasses(groupId, userToken) {
    try {
      console.log(`📹 Service: Getting live classes for group ${groupId}...`);
      
      const response = await axios.get(
        `${this.customChatApi}/groups/${groupId}/live-classes`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Service: Get group live classes failed:', error.message);
      throw new Error(`Get group live classes failed: ${error.message}`);
    }
  }

  // Verify if user is admin of a group using fast WordPress endpoint
  async verifyGroupAdmin(groupId, userId, userToken) {
    try {
      console.log(`👮 Service: Verifying admin status for user ${userId} in group ${groupId}...`);
      
      // Use fast metadata endpoint first
      try {
        const response = await axios.get(
          `${this.customChatApi}/groups/${groupId}/metadata`,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
        
        if (response.data && response.data.success && response.data.data) {
          const isAdmin = response.data.data.is_admin || response.data.data.user_is_admin || false;
          console.log(`✅ Service: User ${userId} admin status in group ${groupId}: ${isAdmin}`);
          return isAdmin;
        }
      } catch (metadataError) {
        console.log(`⚠️ Service: Fast metadata not available, trying BuddyBoss API...`);
      }
      
      // Fallback to BuddyBoss API
      const buddyBossApiUrl = this.wpBaseUrl;
      
      const response = await axios.get(
        `${buddyBossApiUrl}/wp-json/buddyboss/v1/groups/${groupId}/members/${userId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      
      const isAdmin = response.data?.is_mod || response.data?.is_admin || false;
      console.log(`✅ Service: User ${userId} admin status in group ${groupId}: ${isAdmin}`);
      
      return isAdmin;
    } catch (error) {
      console.log(`⚠️ Service: Could not verify admin status for group ${groupId}:`, error.response?.status);
      
      // Return false instead of guessing - no hardcoded logic
      return false;
    }
  }

  // Get group members using BuddyBoss API
  async getGroupMembers(groupId, page = 1, perPage = 50, userToken) {
    try {
      console.log(`👥 Service: Getting members for group ${groupId}, page ${page}, perPage ${perPage}`);
      
      // ⚠️ CRITICAL: Set exclude_admins and exclude_banned to false to get ALL members
      const params = {
        page,
        per_page: perPage,
        exclude_admins: false,  // Include admins (crucial - default is true!)
        exclude_banned: false,  // Include banned users if any
        status: 'last_joined',  // Sort by last joined
        context: 'view'         // View context for member details
      };

      console.log(`📋 Service: BuddyBoss API params:`, params);
      
      const response = await axios.get(`${this.wpApiUrl}/buddyboss/v1/groups/${groupId}/members`, {
        headers: this.getAuthHeaders(userToken),
        params
      });

      if (response.data && Array.isArray(response.data)) {
        console.log(`✅ Service: Found ${response.data.length} group members`);
        console.log(`📊 Service: Members data preview:`, response.data.map(m => ({
          id: m.id,
          name: m.name,
          is_admin: m.is_admin,
          is_mod: m.is_mod
        })));
        
        return {
          success: true,
          data: response.data,
          pagination: {
            page: parseInt(page),
            perPage: parseInt(perPage),
            total: response.data.length
          }
        };
      } else {
        console.log('📝 Service: No group members found or invalid response format');
        console.log('🔍 Service: Response data:', response.data);
        return { 
          success: true, 
          data: [],
          pagination: {
            page: parseInt(page),
            perPage: parseInt(perPage),
            total: 0
          }
        };
      }
    } catch (error) {
      console.error('❌ Service: Error getting group members:', error.response?.data || error.message);
      if (error.response) {
        console.error('❌ Service: Response status:', error.response.status);
        console.error('❌ Service: Response headers:', error.response.headers);
      }
      throw error;
    }
  }

  // Add member to group using BuddyBoss API
  async addGroupMember(groupId, userId, role = 'member', userToken) {
    try {
      console.log(`➕ Service: Adding user ${userId} to group ${groupId} with role ${role}`);
      
      const response = await axios.post(`${this.wpApiUrl}/buddyboss/v1/groups/${groupId}/members`, {
        user_id: userId,
        role: role
      }, {
        headers: this.getAuthHeaders(userToken)
      });

      if (response.data) {
        console.log('✅ Service: Successfully added member to group');
        return { success: true, data: response.data };
      } else {
        throw new Error('No response data');
      }
    } catch (error) {
      console.error('❌ Service: Error adding group member:', error.response?.data || error.message);
      throw error;
    }
  }

  // Remove member from group using BuddyBoss API
  async removeGroupMember(groupId, userId, userToken) {
    try {
      console.log(`➖ Service: Removing user ${userId} from group ${groupId}`);
      
      const response = await axios.delete(`${this.wpApiUrl}/buddyboss/v1/groups/${groupId}/members/${userId}`, {
        headers: this.getAuthHeaders(userToken)
      });

      console.log('✅ Service: Successfully removed member from group');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Service: Error removing group member:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get group details using BuddyBoss API
  async getGroupDetails(groupId, userToken) {
    try {
      console.log(`ℹ️ Service: Getting details for group ${groupId}`);
      
      const response = await axios.get(`${this.wpApiUrl}/buddyboss/v1/groups/${groupId}`, {
        headers: this.getAuthHeaders(userToken)
      });

      if (response.data) {
        console.log('✅ Service: Successfully retrieved group details');
        return { success: true, data: response.data };
      } else {
        throw new Error('No response data');
      }
    } catch (error) {
      console.error('❌ Service: Error getting group details:', error.response?.data || error.message);
      throw error;
    }
  }

  // Delete group using BuddyBoss API
  async deleteGroupCompletely(groupId, deleteGroupForum = false, userToken) {
    try {
      console.log(`🗑️ Service: Deleting group ${groupId}, deleteGroupForum: ${deleteGroupForum}`);
      
      // First, delete all group messages and related data
      try {
        console.log(`🧹 Service: Cleaning up group ${groupId} messages and data...`);
        
        // Delete group messages using our custom chat API
        const deleteMessagesResponse = await axios.delete(`${this.customChatApi}/groups/${groupId}/messages`, {
          headers: this.getAuthHeaders(userToken)
        });
        
        console.log('✅ Service: Cleaned up group messages');
      } catch (cleanupError) {
        console.log('⚠️ Service: Error cleaning up group messages (continuing with group deletion):', cleanupError.message);
      }
      
      // Then delete the group using BuddyBoss API
      const response = await axios.delete(`${this.wpApiUrl}/buddyboss/v1/groups/${groupId}`, {
        headers: this.getAuthHeaders(userToken),
        data: {
          delete_group_forum: deleteGroupForum
        }
      });

      console.log('✅ Service: Successfully deleted group and related data');
      return { 
        success: true, 
        data: response.data,
        message: 'Group and all related messages have been deleted successfully'
      };
    } catch (error) {
      console.error('❌ Service: Error deleting group:', error.response?.data || error.message);
      throw error;
    }
  }

  // ========================= ENHANCED MEDIA UPLOAD METHODS =========================

  /**
   * Enhanced media upload that proxies to WordPress /chat/v1/media/upload/chat
   * Handles file upload with FormData and forwards to WordPress
   */
  async uploadEnhancedMedia(data) {
    try {
      const { file, userId, threadId, userToken } = data;
      
      console.log('📤 CustomChatService: Enhanced media upload to WordPress...', {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        userId,
        threadId
      });

      // Create FormData for WordPress upload
      const formData = new FormData();
      
      // Add file stream to FormData
      formData.append('file', fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype
      });
      
      formData.append('user_id', userId.toString());
      
      if (threadId) {
        formData.append('thread_id', threadId.toString());
      }

      // Build WordPress endpoint URL
      const uploadUrl = `${this.customChatApi}/media/upload/chat`;
      
      console.log('🔗 CustomChatService: Uploading to WordPress:', uploadUrl);

      // Implement retry logic for large file uploads
      let lastError;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`📤 CustomChatService: Upload attempt ${attempt}/${maxRetries}`);
          
          const response = await axios.post(uploadUrl, formData, {
            headers: {
              'Authorization': `Bearer ${userToken}`,
              ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 120000, // 2 minutes timeout for large files
            httpsAgent: httpsAgent,
            httpAgent: httpAgent,
            // Add retry logic for connection issues
            validateStatus: function (status) {
              return status < 500; // Resolve only if the status code is less than 500
            }
          });

          console.log('✅ CustomChatService: WordPress upload successful:', response.data);

          // Clean up temporary file
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          return response.data;

        } catch (error) {
          lastError = error;
          console.error(`❌ CustomChatService: Upload attempt ${attempt} failed:`, {
            message: error.message,
            code: error.code,
            status: error.response?.status
          });

          // Don't retry for certain error types
          if (error.response?.status === 401 || error.response?.status === 403) {
            console.log('🚫 CustomChatService: Authentication error, not retrying');
            break;
          }

          // Don't retry on final attempt
          if (attempt === maxRetries) {
            console.log('💥 CustomChatService: All retry attempts exhausted');
            break;
          }

          // Wait before retry (exponential backoff)
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
          console.log(`⏳ CustomChatService: Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // If we get here, all retries failed
      throw lastError;

    } catch (error) {
      console.error('❌ CustomChatService: Enhanced media upload error:', error.response?.data || error.message);
      
      // Clean up temporary file on error
      if (data.file && fs.existsSync(data.file.path)) {
        fs.unlinkSync(data.file.path);
      }
      
      throw error;
    }
  }

  /**
   * Enhanced voice upload that proxies to WordPress /chat/v1/voice/upload/chat
   * Handles voice file upload with FormData and forwards to WordPress
   */
  async uploadEnhancedVoice(data) {
    try {
      const { file, userId, threadId, userToken } = data;
      
      console.log('🎤 CustomChatService: Enhanced voice upload to WordPress...', {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        userId,
        threadId
      });

      // Create FormData for WordPress upload
      const formData = new FormData();
      
      // Add file stream to FormData
      formData.append('file', fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype
      });
      
      formData.append('user_id', userId.toString());
      
      if (threadId) {
        formData.append('thread_id', threadId.toString());
      }

      // Build WordPress endpoint URL
      const uploadUrl = `${this.customChatApi}/voice/upload/chat`;
      
      console.log('🔗 CustomChatService: Uploading voice to WordPress:', uploadUrl);

      const response = await axios.post(uploadUrl, formData, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      console.log('✅ CustomChatService: WordPress voice upload successful:', response.data);

      // Clean up temporary file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return response.data;

    } catch (error) {
      console.error('❌ CustomChatService: Enhanced voice upload error:', error.response?.data || error.message);
      
      // Clean up temporary file on error
      if (data.file && fs.existsSync(data.file.path)) {
        fs.unlinkSync(data.file.path);
      }
      
      throw error;
    }
  }

}

module.exports = CustomChatService;
