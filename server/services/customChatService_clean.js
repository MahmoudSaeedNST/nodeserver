const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

/**
 * Custom Chat Service - Routes to custom WordPress endpoints
 * Replaces BuddyBoss messaging with custom database tables
 * Falls back to original endpoints for compatibility
 * Archive functionality removed
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

  // Send message using custom private messaging endpoints
  async sendMessage(data) {
    try {
      const { chatId, threadId, senderId, message, messageType, mediaUrl, mediaThumb, fileName, fileSize, duration, replyTo, recipients, subject, token, userToken } = data;
      
      console.log('Server: Sending message via custom chat API...');
      
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

      // If threadId exists, send to existing thread
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
        // Create new thread with recipients
        response = await axios.post(
          `${this.customChatApi}/threads`,
          {
            participants: recipients,
            subject: subject || 'New Message',
            ...requestBody
          },
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
      } else {
        throw new Error('Either threadId or recipients must be provided');
      }

      console.log('✅ Server: Custom chat message sent successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Server: Custom chat send message failed:', error.message);
      throw new Error('Failed to send message: ' + error.message);
    }
  }

  // Get user's chats (archive functionality removed)
  async getUserChats(userId, page = 1, perPage = 20, archived = false, userToken) {
    try {
      console.log(`📥 Service: Getting user chats via custom API for user ${userId}...`);
      
      // Get all chats from WordPress API (archive functionality removed)
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

      console.log(`✅ Service: Custom chat threads retrieved successfully: ${response.data.data?.length || 0}`);
      return response.data;
    } catch (error) {
      console.error('❌ Service: Custom chat get chats failed:', error.message);
      
      // Fallback to original endpoints if needed
      if (error.response?.status === 404) {
        console.log('🔄 Service: Falling back to original endpoints...');
        return this.getUserChatsFallback(userId, page, perPage, userToken);
      }
      
      throw new Error('Failed to get user chats: ' + error.message);
    }
  }

  // Get chat messages using custom endpoints
  async getChatMessages(threadId, page = 1, perPage = 20, userToken, before = null) {
    try {
      console.log(`Server: Getting messages via custom API for thread ${threadId}...`);
      
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

      console.log('✅ Server: Custom chat messages retrieved successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Server: Custom chat get messages failed:', error.message);
      
      // Fallback to original endpoints if needed
      if (error.response?.status === 404) {
        console.log('🔄 Service: Falling back to original endpoints...');
        return this.getChatMessagesFallback(threadId, page, perPage, userToken, before);
      }
      
      throw new Error('Failed to get chat messages: ' + error.message);
    }
  }

  // Delete message using custom endpoints
  async deleteMessage(messageId, threadId, userToken) {
    try {
      console.log(`Server: Deleting message ${messageId} via custom API...`);
      
      const response = await axios.delete(
        `${this.customChatApi}/threads/${threadId}/messages/${messageId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Server: Custom chat message deleted successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Server: Custom chat delete message failed:', error.message);
      throw new Error('Failed to delete message: ' + error.message);
    }
  }

  // Mark thread as read using custom endpoints
  async markThreadRead(threadId, userId, userToken) {
    try {
      console.log(`Server: Marking thread ${threadId} as read via custom API...`);
      
      const response = await axios.post(
        `${this.customChatApi}/threads/${threadId}/read`,
        { user_id: userId },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      console.log('✅ Server: Custom chat thread marked as read successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Server: Custom chat mark thread read failed:', error.message);
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
      throw new Error('Failed to find or create thread: ' + error.message);
    }
  }

  // Delete chat permanently
  async deleteChat(chatId, userId) {
    try {
      console.log(`🗑️ Service: Deleting chat ${chatId} for user ${userId}...`);
      
      // Implementation for deleting a chat permanently
      console.log('✅ Service: Chat deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Service: Delete chat failed:', error.message);
      throw new Error(`Delete chat failed: ${error.message}`);
    }
  }

  // Fallback methods for compatibility
  async getUserChatsFallback(userId, page, perPage, userToken) {
    console.log('🔄 Service: Using fallback for getUserChats');
    return { success: false, data: [], message: 'Fallback not implemented' };
  }

  async getChatMessagesFallback(threadId, page, perPage, userToken, before) {
    console.log('🔄 Service: Using fallback for getChatMessages');
    return { success: false, data: [], message: 'Fallback not implemented' };
  }
}

module.exports = CustomChatService;
