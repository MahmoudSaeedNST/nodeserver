const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const buddyBossService = require('./buddyBossService');

class ChatService {
  constructor() {
    this.wpBaseUrl = process.env.WORDPRESS_URL || 'https://olomak.com';
    this.wpApiUrl = `${this.wpBaseUrl}/wp-json`;
  }

  // Get authorization headers for WordPress API
  getAuthHeaders(userToken) {
    return {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Send message using BuddyBoss API first, fallback to WordPress
  async sendMessage(data) {
    try {
      const { chatId, threadId, senderId, message, messageType, mediaUrl, replyTo, recipients, token, userToken } = data;
      
      // Primary: Use BuddyBoss native API
      try {
        console.log('Server: Attempting to send message via BuddyBoss API...');
        
        const buddyBossData = {
          message: message || '',
          subject: data.subject || 'Re: No Subject'
        };

        // If threadId exists, reply to existing thread
        if (threadId || chatId) {
          buddyBossData.id = threadId || chatId;
        } else if (recipients && recipients.length > 0) {
          buddyBossData.recipients = recipients;
        }

        // Handle media via WordPress upload first (since BuddyBoss doesn't handle direct media URLs)
        if (mediaUrl) {
          const mediaResponse = await this.uploadMediaFallback(mediaUrl, senderId, userToken);
          if (mediaResponse.media_ids) {
            buddyBossData.media_ids = mediaResponse.media_ids;
          }
        }

        const response = await axios.post(
          `${this.wpApiUrl}/buddyboss/v1/messages`,
          buddyBossData,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );

        console.log('✅ Server: BuddyBoss message send successful');
        return response.data;
      } catch (buddyBossError) {
        console.warn('⚠️ Server: BuddyBoss send failed, trying WordPress fallback:', buddyBossError.message);
        
        // Fallback: Use WordPress custom API
        const response = await axios.post(
          `${this.wpApiUrl}/chat/v1/messages/send`,
          {
            chat_id: chatId || threadId,
            sender_id: senderId,
            message: message,
            message_type: messageType || 'text',
            media_url: mediaUrl,
            reply_to: replyTo
          },
          {
            headers: this.getAuthHeaders(userToken)
          }
        );

        return response.data;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message');
    }
  }

  // Get chat messages using BuddyBoss API first, fallback to WordPress
  async getChatMessages(chatId, page = 1, limit = 50, userToken, before = null) {
    try {
      // Primary: Use BuddyBoss native API
      try {
        console.log(`Server: Fetching messages via BuddyBoss API for thread ${chatId}...`);
        
        let url = `${this.wpApiUrl}/buddyboss/v1/messages/${chatId}?page=${page}&per_page=${limit}`;
        if (before) {
          url += `&before=${encodeURIComponent(before)}`;
        }
        
        const response = await axios.get(url, {
          headers: this.getAuthHeaders(userToken)
        });
        
        console.log('✅ Server: BuddyBoss messages fetch successful');
        return response.data;
      } catch (buddyBossError) {
        console.warn('⚠️ Server: BuddyBoss fetch failed, trying WordPress fallback:', buddyBossError.message);
        
        // Fallback: Use WordPress custom API
        const params = { page, per_page: limit };
        if (before) {
          params.before = before;
        }
        
        const response = await axios.get(
          `${this.wpApiUrl}/chat/v1/chats/${chatId}/messages`,
          {
            params,
            headers: this.getAuthHeaders(userToken)
          }
        );

        return response.data;
      }
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      throw new Error('Failed to fetch messages');
    }
  }

  // Get user's chat list using BuddyBoss API first, fallback to WordPress
  async getUserChats(userId, userToken) {
    try {
      // Primary: Use BuddyBoss native API
      try {
        console.log('Server: Fetching user chats via BuddyBoss API...');
        
        const response = await axios.get(
          `${this.wpApiUrl}/buddyboss/v1/messages?page=1&per_page=50`,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
        
        console.log('✅ Server: BuddyBoss chats fetch successful');
        return response.data;
      } catch (buddyBossError) {
        console.warn('⚠️ Server: BuddyBoss chats fetch failed, trying WordPress fallback:', buddyBossError.message);
        
        // Fallback: Use WordPress custom API
        const response = await axios.get(
          `${this.wpApiUrl}/chat/v1/chats`,
          {
            params: { user_id: userId },
            headers: this.getAuthHeaders(userToken)
          }
        );

        return response.data;
      }
    } catch (error) {
      console.error('Error fetching user chats:', error);
      throw new Error('Failed to fetch chats');
    }
  }

  // Create new chat
  async createChat(data) {
    try {
      const { participantIds, chatType, chatName, groupAdmin } = data;
      
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/chats/create`,
        {
          participant_ids: participantIds,
          chat_type: chatType,
          chat_name: chatName,
          group_admin: groupAdmin
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error creating chat:', error);
      throw new Error('Failed to create chat');
    }
  }

  // Get chat participants
  async getChatParticipants(chatId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/chats/${chatId}/participants`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data.data?.participants || [];
    } catch (error) {
      console.error('Error fetching chat participants:', error);
      return [];
    }
  }

  // Verify user access to chat
  async verifyUserAccess(userId, chatId, userToken) {
    try {
      const participants = await this.getChatParticipants(chatId, userToken);
      const participantIds = participants.map(p => p.id || p.user_id);
      return participantIds.includes(parseInt(userId));
    } catch (error) {
      console.error('Error verifying user access:', error);
      return false;
    }
  }

  // Mark messages as delivered
  async markMessagesDelivered(chatId, userId, userToken) {
    try {
      await axios.post(
        `${this.wpApiUrl}/chat/v1/messages/delivered`,
        {
          chat_id: chatId,
          user_id: userId
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
    } catch (error) {
      console.error('Error marking messages as delivered:', error);
    }
  }

  // Mark message as read using BuddyBoss action endpoint first, fallback to WordPress
  async markMessageRead(messageId, userId, userToken) {
    try {
      console.log(`Server: Marking message ${messageId} as read for user ${userId}`);
      
      // Handle cases where messageId might be undefined or an object
      const validMessageId = messageId && typeof messageId === 'string' ? messageId : null;
      
      if (!validMessageId) {
        console.warn('Warning: Invalid message ID provided for mark read operation');
        return {
          success: true,
          message: 'Mark as read skipped (invalid message ID)',
          skipped: true
        };
      }
      
      // Primary: Use BuddyBoss native API
      try {
        const response = await axios.post(
          `${this.wpApiUrl}/buddyboss/v1/messages/action/${validMessageId}`,
          {
            action: 'unread',
            value: false // false means mark as read
          },
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
        
        console.log('✅ Server: BuddyBoss message marked as read successfully');
        return response.data;
      } catch (buddyBossError) {
        console.warn('⚠️ Server: BuddyBoss mark read failed, trying WordPress fallback:', buddyBossError.message);
        
        // Fallback: Use WordPress custom API - try both message and thread endpoints
        try {
          // First try message-specific endpoint
          await axios.post(
            `${this.wpApiUrl}/chat/v1/messages/${validMessageId}/read`,
            {
              user_id: userId
            },
            {
              headers: this.getAuthHeaders(userToken)
            }
          );
          
          console.log('✅ Server: WordPress message read endpoint successful');
          return {
            success: true,
            message: 'Message marked as read successfully',
            data: { message_id: validMessageId, user_id: userId }
          };
        } catch (messageError) {
          console.warn('⚠️ Server: WordPress message endpoint failed, trying thread endpoint:', messageError.message);
          
          // Final fallback: Use thread endpoint (treating messageId as threadId)
          await axios.post(
            `${this.wpApiUrl}/chat/v1/threads/${validMessageId}/read`,
            {
              user_id: userId
            },
            {
              headers: this.getAuthHeaders(userToken)
            }
          );
          
          console.log('✅ Server: WordPress thread read endpoint successful');
          return {
            success: true,
            message: 'Thread marked as read successfully',
            data: { thread_id: validMessageId, user_id: userId }
          };
        }
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
      
      // Don't throw error - return graceful fallback
      return {
        success: true,
        message: 'Mark as read failed gracefully (all endpoints unavailable)',
        error: error.message,
        skipped: true
      };
    }
  }

  // Upload media file
  async uploadMedia(filePath, fileName, fileType, userId) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));
      formData.append('user_id', userId);

      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/media/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${process.env.WP_API_TOKEN}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error uploading media:', error);
      throw new Error('Failed to upload media');
    }
  }

  // Upload voice message
  async uploadVoiceMessage(filePath, duration, userId) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));
      formData.append('user_id', userId);
      formData.append('duration', duration);

      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/voice/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${process.env.WP_API_TOKEN}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error uploading voice message:', error);
      throw new Error('Failed to upload voice message');
    }
  }

  // Upload media fallback for BuddyBoss integration
  async uploadMediaFallback(mediaUrl, userId, userToken) {
    try {
      if (!mediaUrl || !userId) {
        return { success: false };
      }

      // Use WordPress media upload API
      const formData = new FormData();
      
      // If it's a local file path, read it
      if (fs.existsSync(mediaUrl)) {
        formData.append('file', fs.createReadStream(mediaUrl));
      } else {
        // If it's a URL, we need to download and upload
        console.log('Media URL upload not implemented for URLs yet');
        return { success: false };
      }
      
      formData.append('user_id', userId);

      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/media/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${userToken}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error uploading media fallback:', error);
      return { success: false };
    }
  }

  // Search recipients using BuddyBoss API first, fallback to WordPress
  async searchRecipients(query, limit = 20, userToken) {
    try {
      // Primary: Use BuddyBoss search API
      try {
        console.log('Server: Searching recipients via BuddyBoss API...');
        
        const response = await axios.get(
          `${this.wpApiUrl}/buddyboss/v1/messages/search-recipients?term=${encodeURIComponent(query)}&per_page=${limit}`,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
        
        console.log('✅ Server: BuddyBoss recipients search successful');
        return response.data;
      } catch (buddyBossError) {
        console.warn('⚠️ Server: BuddyBoss recipients search failed, trying WordPress fallback:', buddyBossError.message);
        
        // Fallback: Use WordPress custom API or contacts endpoint
        const response = await axios.get(
          `${this.wpApiUrl}/chat/v1/contacts`,
          {
            params: { 
              search: query,
              limit: limit
            },
            headers: this.getAuthHeaders(userToken)
          }
        );

        return response.data;
      }
    } catch (error) {
      console.error('Error searching recipients:', error);
      return [];
    }
  }

  // Get user's friends/contacts
  async getUserFriends(userId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/friends`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders(userToken)
        }
      );
      

      // Normalize the response data structure
      let friendsData = response.data;
      
      // Handle different BuddyBoss API response formats
      if (typeof friendsData === 'object' && !Array.isArray(friendsData)) {
        // If it's an object, try to extract array from common properties
        if (friendsData.friends && Array.isArray(friendsData.friends)) {
          friendsData = friendsData.friends;
        } else if (friendsData.data && Array.isArray(friendsData.data)) {
          friendsData = friendsData.data;
        } else if (friendsData.results && Array.isArray(friendsData.results)) {
          friendsData = friendsData.results;
        } else {
          // Convert object with numeric keys to array
          friendsData = Object.values(friendsData).filter(item => 
            typeof item === 'object' && (item.id || item.user_id || item.ID)
          );
        }
      }

      return {
        success: true,
        data: Array.isArray(friendsData) ? friendsData : []
      };
    } catch (error) {
      console.error('Error fetching user friends:', error.response?.data || error.message);
      return {
        success: false,
        data: [],
        error: 'Failed to fetch user friends'
      };
    }
  }

  // Get user's contacts with presence status
  async getUserContacts(userId, userToken, perPage = 20) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/contacts`,
        {
          params: { 
            user_id: userId,
            per_page: perPage
          },
          headers: this.getAuthHeaders(userToken)
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error fetching user contacts:', error.response?.data || error.message);
      return {
        success: false,
        error: 'Failed to fetch user contacts'
      };
    }
  }

  // Get user's chats (threads)
  async getUserChats(userId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/messages`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data || [];
    } catch (error) {
      console.error('Error fetching user chats:', error.response?.data || error.message);
      return [];
    }
  }

  // Get all contacts (all BuddyBoss users)
  async getAllContacts(options = {}) {
    try {
      const { search = '', excludeFriends = false, limit = 200, offset = 0, userId, userToken } = options;
      
      console.log('👥 Server: Getting all contacts with options:', options);
      
      // Use BuddyBoss members API
      const response = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/members`,
        {
          params: {
            search: search,
            per_page: limit,
            page: Math.floor(offset / limit) + 1,
            exclude: excludeFriends ? userId : undefined
          },
          headers: this.getAuthHeaders(userToken)
        }
      );

      // Normalize member data for chat use
      const members = Array.isArray(response.data) ? response.data : [];
      
      const normalizedContacts = members.map(member => ({
        id: member.id || member.user_id,
        name: member.name || member.display_name || `User ${member.id}`,
        display_name: member.display_name || member.name,
        avatar: member.avatar_urls?.thumb || member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || member.display_name || 'User')}&background=3C75C1&color=fff&size=128`,
        is_online: member.is_online || false,
        last_activity: member.last_activity || null,
        link: member.link || null,
        mention_name: member.mention_name || member.user_login,
        user_login: member.user_login
      }));

      console.log('✅ Server: Retrieved contacts:', {
        total: normalizedContacts.length,
        search: search || 'none',
        first_few: normalizedContacts.slice(0, 3).map(c => ({ id: c.id, name: c.name }))
      });

      return normalizedContacts;
    } catch (error) {
      console.error('❌ Server: Failed to get all contacts:', error.response?.data || error.message);
      return [];
    }
  }

  // Get user's contacts
  async getContacts(userId, userToken) {
    try {
      // For now, just get user's friends
      const friends = await this.getUserFriends(userId, userToken);
      return friends;
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return {
        success: false,
        message: 'Failed to fetch contacts',
        data: []
      };
    }
  }

  // Create/Update status
  async createStatus(data) {
    try {
      const { userId, content, mediaUrl, mediaType } = data;
      
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/status/create`,
        {
          user_id: userId,
          content: content,
          media_url: mediaUrl,
          media_type: mediaType
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error creating status:', error);
      throw new Error('Failed to create status');
    }
  }

  // Get user statuses
  async getUserStatuses(userId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/status/user/${userId}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching user statuses:', error);
      return [];
    }
  }

  // Get friends' statuses
  async getFriendsStatuses(userId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/status/friends`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching friends statuses:', error);
      return [];
    }
  }

  // Record status view
  async recordStatusView(statusId, viewerId) {
    try {
      await axios.post(
        `${this.wpApiUrl}/chat/v1/status/${statusId}/view`,
        {
          viewer_id: viewerId
        },
        {
          headers: this.getAuthHeaders()
        }
      );
    } catch (error) {
      console.error('Error recording status view:', error);
    }
  }

  // Record status like
  async recordStatusLike(statusId, likerId) {
    try {
      await axios.post(
        `${this.wpApiUrl}/chat/v1/status/${statusId}/like`,
        {
          liker_id: likerId
        },
        {
          headers: this.getAuthHeaders()
        }
      );
    } catch (error) {
      console.error('Error recording status like:', error);
    }
  }

  // Delete status
  async deleteStatus(statusId, userId) {
    try {
      await axios.delete(
        `${this.wpApiUrl}/chat/v1/status/${statusId}`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders()
        }
      );
    } catch (error) {
      console.error('Error deleting status:', error);
      throw new Error('Failed to delete status');
    }
  }

  // Group management methods
  async addUserToGroup(chatId, userId, adminId) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/groups/${chatId}/members/add`,
        {
          user_id: userId,
          admin_id: adminId
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error adding user to group:', error);
      throw new Error('Failed to add user to group');
    }
  }

  async removeUserFromGroup(chatId, userId, adminId) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/groups/${chatId}/members/remove`,
        {
          user_id: userId,
          admin_id: adminId
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error removing user from group:', error);
      throw new Error('Failed to remove user from group');
    }
  }

  async updateGroupInfo(chatId, data, adminId) {
    try {
      const response = await axios.put(
        `${this.wpApiUrl}/chat/v1/groups/${chatId}`,
        {
          ...data,
          admin_id: adminId
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error updating group info:', error);
      throw new Error('Failed to update group info');
    }
  }

  // Enhanced Group Management for Educational Platform

  // Get all groups for user (both BuddyBoss and educational)
  async getGroups(userId, userToken) {
    try {
      // Primary: Use BuddyBoss Groups API
      try {
        console.log('Server: Fetching groups via BuddyBoss API...');
        
        const response = await axios.get(
          `${this.wpApiUrl}/buddyboss/v1/groups`,
          {
            params: { 
              user_id: userId,
              per_page: 50,
              populate_extras: true
            },
            headers: this.getAuthHeaders(userToken)
          }
        );
        
        console.log('✅ Server: BuddyBoss groups fetch successful');
        
        // Enhance with educational metadata
        const groups = response.data.map(group => this.enhanceGroupWithEducationalData(group));
        return groups;
      } catch (buddyBossError) {
        console.warn('⚠️ Server: BuddyBoss groups fetch failed, trying WordPress fallback:', buddyBossError.message);
        
        // Fallback: Use WordPress custom API
        const response = await axios.get(
          `${this.wpApiUrl}/chat/v1/groups`,
          {
            params: { user_id: userId },
            headers: this.getAuthHeaders(userToken)
          }
        );

        return response.data;
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      return [];
    }
  }

  // Create group (normal groups, not specifically educational)
  async createGroup(groupData, userToken) {
    try {
      const {
        name,
        description,
        privacy = 'public',
        subject,
        gradeLevel,
        capacity = 30,
        teacherId,
        courseId,
        bundleId,
        features = {},
        adminIds = []
      } = groupData;

      // Create via BuddyBoss API first
      try {
        console.log('Server: Creating group via BuddyBoss API...');
        
        const buddyBossData = {
          name,
          description,
          status: privacy, // public, private, hidden
          enable_forum: false, // Disable forum for class groups
          parent_id: courseId || 0,
          creator_id: teacherId
        };

        const response = await axios.post(
          `${this.wpApiUrl}/buddyboss/v1/groups`,
          buddyBossData,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );

        const groupId = response.data.id;

        // Prepare class metadata
        const classMetadata = {
          subject,
          grade_level: gradeLevel,
          capacity,
          teacher_id: teacherId,
          course_id: courseId,
          bundle_id: bundleId,
          features: {
            live_classes: true,
            group_calling: true,
            file_sharing: true,
            assignment_discussion: true,
            ...features
          },
          admin_ids: [teacherId, ...adminIds],
          created_at: new Date().toISOString()
        };

        // Add class metadata (optional, won't fail if endpoint doesn't exist)
        await this.addClassMetadata(groupId, classMetadata, userToken);

        console.log('✅ Server: Class group created successfully');
        return {
          ...response.data,
          class_metadata: {
            capacity,
            teacherId,
            features: {
              live_classes: true,
              group_calling: true,
              file_sharing: true,
              assignment_discussion: true,
              ...features
            }
          }
        };
      } catch (buddyBossError) {
        console.warn('⚠️ Server: BuddyBoss group creation failed, trying WordPress fallback:', buddyBossError.message);
        
        // Fallback: Use WordPress custom API
        const response = await axios.post(
          `${this.wpApiUrl}/chat/v1/groups`,
          groupData,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );

        return response.data;
      }
    } catch (error) {
      console.error('Error creating group:', error);
      throw new Error('Failed to create group');
    }
  }

  // Get group messages - specifically for group chats
  async getGroupMessages(groupId, page = 1, per_page = 20, userToken) {
    try {
      console.log(`🔍 Server: Fetching group messages for group ${groupId}`);
      
      // Primary: Use WordPress custom group messages API  
      try {
        const response = await axios.get(
          `${this.wpApiUrl}/chat/v1/groups/${groupId}/messages`,
          {
            params: { page, per_page },
            headers: this.getAuthHeaders(userToken)
          }
        );
        
        console.log('✅ Server: WordPress group messages fetch successful');
        return response.data;
      } catch (wordpressError) {
        console.warn('⚠️ Server: WordPress group messages fetch failed, trying BuddyBoss fallback:', wordpressError.message);
        
        // Fallback: Try to get messages via BuddyBoss if available
        // Note: This might return private messages mixed with group messages
        const response = await axios.get(
          `${this.wpApiUrl}/buddyboss/v1/messages`,
          {
            params: { 
              page, 
              per_page,
              type: 'group' // Try to filter group messages if supported
            },
            headers: this.getAuthHeaders(userToken)
          }
        );
        
        // Filter for group-specific messages if possible
        let messages = response.data;
        if (Array.isArray(messages)) {
          messages = messages.filter(msg => 
            msg.group_id == groupId || 
            (msg.meta && msg.meta.group_id == groupId) ||
            (msg.thread && msg.thread.group_id == groupId)
          );
        }
        
        return { messages, group_id: groupId, is_group_messages: true };
      }
    } catch (error) {
      console.error('Error fetching group messages:', error);
      throw new Error('Failed to fetch group messages');
    }
  }

  // Send group message - specifically for group chats
  async sendGroupMessage(messageData, userToken) {
    try {
      const { group_id: groupId, message, users = 'all', type = 'open' } = messageData;
      
      console.log(`📤 Server: Sending group message to group ${groupId}`);
      
      // Primary: Use WordPress custom group message API
      try {
        const response = await axios.post(
          `${this.wpApiUrl}/chat/v1/groups/${groupId}/messages`,
          messageData,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
        
        console.log('✅ Server: WordPress group message send successful');
        return response.data;
      } catch (wordpressError) {
        console.warn('⚠️ Server: WordPress group message send failed, trying BuddyBoss fallback:', wordpressError.message);
        
        // Fallback: Use BuddyBoss group message API
        const buddyBossData = {
          group_id: groupId,
          message: message || '',
          users: users,
          type: type
        };

        // Add optional fields if present
        if (messageData.users_list) buddyBossData.users_list = messageData.users_list;
        if (messageData.bp_media_ids) buddyBossData.bp_media_ids = messageData.bp_media_ids;
        if (messageData.bp_videos) buddyBossData.bp_videos = messageData.bp_videos;
        if (messageData.bp_documents) buddyBossData.bp_documents = messageData.bp_documents;
        if (messageData.media_gif) buddyBossData.media_gif = messageData.media_gif;

        console.log('⚠️ Server: WordPress group message send failed, trying custom table fallback');
        
        // Use our custom group messages endpoint
        const customData = {
          message: messageData.message,
          message_type: messageData.message_type || 'text',
          media_url: messageData.media_url,
          media_thumbnail: messageData.media_thumbnail,
          file_name: messageData.file_name,
          file_size: messageData.file_size,
          duration: messageData.duration,
          reply_to: messageData.reply_to,
          metadata: messageData.metadata
        };

        const customResponse = await axios.post(
          `${this.wpApiUrl}/chat/v1/groups/${messageData.group_id}/messages`,
          customData,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
        
        return customResponse.data;
      }
    } catch (error) {
      console.error('Error sending group message:', error);
      throw new Error('Failed to send group message');
    }
  }

  // Send group message using custom table (new method)
  async sendGroupMessageCustom(messageData, userToken) {
    try {
      console.log('📤 Server: Sending custom group message to group', messageData.group_id);
      
      const customData = {
        message: messageData.message,
        message_type: messageData.message_type || 'text',
        media_url: messageData.media_url,
        media_thumbnail: messageData.media_thumbnail,
        file_name: messageData.file_name,
        file_size: messageData.file_size,
        duration: messageData.duration,
        reply_to: messageData.reply_to,
        metadata: messageData.metadata
      };

      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/groups/${messageData.group_id}/messages`,
        customData,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      
      console.log('✅ Server: Custom group message sent successfully');
      return response.data;
      
    } catch (error) {
      console.error('❌ Server: Error sending custom group message:', error);
      throw new Error('Failed to send custom group message');
    }
  }

  // Get group messages using custom table (new method)
  async getGroupMessagesCustom(groupId, page = 1, perPage = 20, userToken) {
    try {
      console.log('📥 Server: Getting custom group messages for group', groupId);
      
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/groups/${groupId}/messages?page=${page}&per_page=${perPage}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      
      console.log('✅ Server: Retrieved', response.data.messages?.length || 0, 'custom messages');
      return response.data;
      
    } catch (error) {
      console.error('❌ Server: Error getting custom group messages:', error);
      throw new Error('Failed to get custom group messages');
    }
  }

  // Delete group message (new method)
  async deleteGroupMessage(groupId, messageId, userToken) {
    try {
      console.log('🗑️ Server: Deleting group message', messageId, 'from group', groupId);
      
      const response = await axios.delete(
        `${this.wpApiUrl}/chat/v1/groups/${groupId}/messages/${messageId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      
      console.log('✅ Server: Group message deleted successfully');
      return response.data;
      
    } catch (error) {
      console.error('❌ Server: Error deleting group message:', error);
      throw new Error('Failed to delete group message');
    }
  }

  // Delete group (new method)
  async deleteGroup(groupId, userToken) {
    try {
      console.log('🗑️ Server: Deleting group', groupId);
      
      const response = await axios.delete(
        `${this.wpApiUrl}/chat/v1/groups/${groupId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      
      console.log('✅ Server: Group deleted successfully');
      return response.data;
      
    } catch (error) {
      console.error('❌ Server: Error deleting group:', error);
      throw new Error('Failed to delete group');
    }
  }

  // Get chat groups only (new method)
  async getChatGroupsOnly(page = 1, perPage = 50, userToken) {
    try {
      console.log('📋 Server: Getting chat groups only');
      
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/chat-groups?page=${page}&per_page=${perPage}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      
      console.log('✅ Server: Retrieved', response.data.groups?.length || 0, 'chat groups');
      return response.data;
      
    } catch (error) {
      console.error('❌ Server: Error getting chat groups:', error);
      throw new Error('Failed to get chat groups');
    }
  }

  // Get class metadata from group
  async getClassMetadata(groupId, userToken) {
    try {
      console.log('Getting class metadata from group:', groupId);
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/groups/${groupId}/class-metadata`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      console.log('✅ Class metadata retrieved successfully');
      return response.data;
    } catch (error) {
      console.warn('Warning: Could not get class metadata:', error.response?.status, error.message);
      
      // Return default metadata structure if endpoint doesn't exist
      return {
        success: true,
        data: {
          group_id: groupId,
          metadata: {
            class_name: null,
            subject: null,
            grade_level: null,
            capacity: 30,
            teacher_id: null,
            course_id: null,
            bundle_id: null,
            live_classes_enabled: false,
            features: {},
            created_at: null,
            updated_at: null,
            updated_by: null
          }
        },
        metadata_unavailable: true,
        error: error.response?.status === 404 ? 'Endpoint not found' : error.message
      };
    }
  }

  // Mark thread as read
  async markThreadRead(threadId, userId, userToken) {
    try {
      console.log('Marking thread as read:', threadId, 'for user:', userId);
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/threads/${threadId}/read`,
        { user_id: userId },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      console.log('✅ Thread marked as read successfully');
      return response.data;
    } catch (error) {
      console.warn('Warning: Could not mark thread as read:', error.response?.status, error.message);
      
      // Return success response even if endpoint fails (graceful degradation)
      return {
        success: true,
        message: 'Thread mark as read skipped (endpoint not available)',
        data: {
          thread_id: threadId,
          user_id: userId,
          timestamp: new Date().toISOString(),
          skipped: true
        }
      };
    }
  }

  // Add class metadata to group (renamed from educational metadata)
  async addClassMetadata(groupId, metadata, userToken) {
    try {
      console.log('Adding class metadata to group:', groupId);
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/groups/${groupId}/class-metadata`,
        metadata,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      console.log('✅ Class metadata added successfully');
      return response.data;
    } catch (error) {
      // Log the error but don't throw it - metadata is optional
      console.warn('Warning: Could not add class metadata (endpoint may not exist):', error.response?.status, error.message);
      console.log('📝 Group creation will continue without metadata');
      
      // Return a success response indicating metadata was skipped
      return {
        success: true,
        message: 'Group created successfully (class metadata skipped)',
        metadata_skipped: true,
        error: error.response?.status === 404 ? 'Endpoint not found' : error.message
      };
    }
  }

  // Enhance group data with class metadata
  enhanceGroupWithEducationalData(group) {
    // Format group data to match mobile app expectations
    return {
      ...group,
      // Standard fields expected by the mobile app
      memberCount: parseInt(group.members_count || group.total_member_count || 0),
      lastActivity: group.last_activity || group.date_created,
      avatar: group.avatar_urls?.full || group.avatar_urls?.thumb || '',
      unreadCount: 0, // Will be updated by real-time updates
      
      // Educational fields
      hasLiveClasses: group.meta?.live_classes_enabled || false,
      subject: group.meta?.subject || null,
      gradeLevel: group.meta?.grade_level || null,
      capacity: group.meta?.capacity || 30,
      teacherId: group.meta?.teacher_id || null,
      courseId: group.meta?.course_id || null,
      bundleId: group.meta?.bundle_id || null,
      features: group.meta?.features || {},
      adminIds: group.meta?.admin_ids || []
    };
  }

  // Promote user to admin
  async promoteToAdmin(groupId, userId, promoterId, userToken) {
    try {
      // Use BuddyBoss PATCH API for member management
      const response = await axios.patch(
        `${this.wpApiUrl}/buddyboss/v1/groups/${groupId}/members/${userId}`,
        {
          action: 'promote',
          role: 'admin'
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      // Update educational metadata to include new admin
      await this.updateEducationalAdmins(groupId, userId, 'add', userToken);

      return response.data;
    } catch (error) {
      console.error('Error promoting user to admin:', error);
      throw new Error('Failed to promote user to admin');
    }
  }

  // Promote user to moderator
  async promoteToModerator(groupId, userId, promoterId, userToken) {
    try {
      // Use BuddyBoss PATCH API for member management
      const response = await axios.patch(
        `${this.wpApiUrl}/buddyboss/v1/groups/${groupId}/members/${userId}`,
        {
          action: 'promote',
          role: 'mod'
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error promoting user to moderator:', error);
      throw new Error('Failed to promote user to moderator');
    }
  }

  // Demote admin/mod to member
  async demoteFromAdmin(groupId, userId, demoterId, userToken) {
    try {
      // Use BuddyBoss PATCH API for member management
      const response = await axios.patch(
        `${this.wpApiUrl}/buddyboss/v1/groups/${groupId}/members/${userId}`,
        {
          action: 'demote',
          role: 'member'
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      // Update educational metadata to remove admin
      await this.updateEducationalAdmins(groupId, userId, 'remove', userToken);

      return response.data;
    } catch (error) {
      console.error('Error demoting admin:', error);
      throw new Error('Failed to demote admin');
    }
  }

  // Ban user from group
  async banGroupMember(groupId, userId, bannerId, userToken) {
    try {
      // Use BuddyBoss PATCH API for member management
      const response = await axios.patch(
        `${this.wpApiUrl}/buddyboss/v1/groups/${groupId}/members/${userId}`,
        {
          action: 'ban'
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error banning group member:', error);
      throw new Error('Failed to ban group member');
    }
  }

  // Unban user from group
  async unbanGroupMember(groupId, userId, unbannerId, userToken) {
    try {
      // Use BuddyBoss PATCH API for member management
      const response = await axios.patch(
        `${this.wpApiUrl}/buddyboss/v1/groups/${groupId}/members/${userId}`,
        {
          action: 'unban'
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error unbanning group member:', error);
      throw new Error('Failed to unban group member');
    }
  }

  // Update educational admins list
  async updateEducationalAdmins(groupId, userId, action, userToken) {
    try {
      await axios.patch(
        `${this.wpApiUrl}/chat/v1/groups/${groupId}/admins`,
        {
          user_id: userId,
          action: action // 'add' or 'remove'
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
    } catch (error) {
      console.error('Error updating educational admins:', error);
    }
  }

  // Generate invite link for live class (only for admins, only for enrolled users)
  async generateLiveClassInvite(groupId, adminId, classOptions, userToken) {
    try {
      // Verify admin permissions first
      const isAdmin = await this.verifyGroupAdmin(groupId, adminId, userToken);
      if (!isAdmin) {
        throw new Error('Only group admins can generate live class invites');
      }

      const {
        classTitle,
        classDescription,
        startTime,
        duration = 60, // minutes
        maxParticipants,
        courseId = null,
        bundleId = null,
        expiresIn = '24h' // Live class invites expire faster
      } = classOptions;

      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/groups/${groupId}/live-class-invite`,
        {
          admin_id: adminId,
          class_title: classTitle,
          class_description: classDescription,
          start_time: startTime,
          duration,
          max_participants: maxParticipants,
          course_id: courseId,
          bundle_id: bundleId,
          expires_in: expiresIn,
          enrollment_required: true // Always require enrollment for live classes
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error generating live class invite:', error);
      throw new Error('Failed to generate live class invite');
    }
  }

  // Join live class via invite link (checks enrollment)
  async joinLiveClassViaInvite(inviteCode, userId, userToken) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/groups/join-live-class`,
        {
          invite_code: inviteCode,
          user_id: userId
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error joining live class via invite:', error);
      throw new Error('Failed to join live class via invite');
    }
  }

  // Verify if user is admin of group
  async verifyGroupAdmin(groupId, userId, userToken) {
    try {
      // Try multiple approaches to verify admin status
      
      // Approach 1: Try BuddyBoss groups API (get all members and check admin status)
      try {
        const response = await axios.get(
          `${this.wpApiUrl}/buddyboss/v1/groups/${groupId}`,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );

        if (response.data && response.data.admins) {
          // Check if user is in admins array
          const isAdmin = response.data.admins.some(admin => 
            admin.id === parseInt(userId) || admin.user_id === parseInt(userId)
          );
          if (isAdmin) return true;
        }

        // Check if user is the creator
        if (response.data && response.data.creator_id === parseInt(userId)) {
          return true;
        }
      } catch (buddyBossError) {
        console.warn('BuddyBoss group info endpoint failed:', buddyBossError.message);
      }

      // Approach 2: Try BuddyBoss group members endpoint
      try {
        const membersResponse = await axios.get(
          `${this.wpApiUrl}/buddyboss/v1/groups/${groupId}/members`,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );

        if (membersResponse.data && Array.isArray(membersResponse.data)) {
          const userMember = membersResponse.data.find(member => 
            member.id === parseInt(userId) || member.user_id === parseInt(userId)
          );
          
          if (userMember && (userMember.is_admin || userMember.role === 'admin' || userMember.role === 'Organizer')) {
            return true;
          }
        }
      } catch (membersError) {
        console.warn('BuddyBoss group members endpoint failed:', membersError.message);
      }

      // Approach 3: Use our custom WordPress endpoint
      try {
        const response = await axios.get(
          `${this.wpApiUrl}/chat/v1/groups/${groupId}/admin-check`,
          {
            params: { user_id: userId },
            headers: this.getAuthHeaders(userToken)
          }
        );

        return response.data.data?.is_admin || false;
      } catch (customError) {
        console.warn('Custom admin check endpoint failed:', customError.message);
      }

      // Default to false if all methods fail
      return false;
      
    } catch (error) {
      console.error('Error verifying group admin:', error);
      return false;
    }
  }

  // Check if user is enrolled in course/bundle
  async checkUserEnrollment(userId, courseId, bundleId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/users/${userId}/enrollment-status`,
        {
          params: {
            course_id: courseId,
            bundle_id: bundleId
          },
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data.is_enrolled || false;
    } catch (error) {
      console.error('Error checking user enrollment:', error);
      return false;
    }
  }

  // Get group members with roles
  async getGroupMembers(groupId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/groups/${groupId}/members`,
        {
          params: { per_page: 100 },
          headers: this.getAuthHeaders(userToken)
        }
      );

      // Enhance with educational roles
      const members = response.data.map(member => ({
        ...member,
        role: this.determineEducationalRole(member, groupId),
        isAdmin: member.is_admin || false,
        isModerator: member.is_mod || false
      }));

      return members;
    } catch (error) {
      console.error('Error fetching group members:', error);
      return [];
    }
  }

  // Determine educational role for member
  determineEducationalRole(member, groupId) {
    if (member.is_admin) return 'admin';
    if (member.is_mod) return 'moderator';
    // Check if teacher based on class metadata
    if (member.meta?.teacher_id === member.id) return 'teacher';
    return 'student';
  }

  // Update group settings (class enhanced)
  async updateGroupSettings(groupId, settings, adminId, userToken) {
    try {
      const {
        name,
        description,
        privacy,
        subject,
        gradeLevel,
        capacity,
        features
      } = settings;

      // Verify admin permissions
      const isAdmin = await this.verifyGroupAdmin(groupId, adminId, userToken);
      if (!isAdmin) {
        throw new Error('Only group admins can update group settings');
      }

      // Update basic group info via BuddyBoss
      const buddyBossData = {};
      if (name) buddyBossData.name = name;
      if (description) buddyBossData.description = description;
      if (privacy) buddyBossData.status = privacy;

      if (Object.keys(buddyBossData).length > 0) {
        await axios.patch(
          `${this.wpApiUrl}/buddyboss/v1/groups/${groupId}`,
          buddyBossData,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
      }

      // Update class metadata
      const classData = {};
      if (subject) classData.subject = subject;
      if (gradeLevel) classData.grade_level = gradeLevel;
      if (capacity) classData.capacity = capacity;
      if (features) classData.features = features;

      if (Object.keys(classData).length > 0) {
        await axios.patch(
          `${this.wpApiUrl}/chat/v1/groups/${groupId}/class-metadata`,
          {
            ...classData,
            updated_by: adminId,
            updated_at: new Date().toISOString()
          },
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating group settings:', error);
      throw new Error('Failed to update group settings');
    }
  }

  // Schedule live class (not just meeting)
  async scheduleLiveClass(groupId, classData, userToken) {
    try {
      const {
        title,
        description,
        startTime,
        duration = 60, // minutes
        recurring = false,
        recurrencePattern = null,
        teacherId,
        maxParticipants
      } = classData;

      // Verify teacher/admin permissions
      const isAdmin = await this.verifyGroupAdmin(groupId, teacherId, userToken);
      if (!isAdmin) {
        throw new Error('Only group admins can schedule live classes');
      }

      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/groups/${groupId}/live-classes`,
        {
          title,
          description,
          start_time: startTime,
          duration,
          recurring,
          recurrence_pattern: recurrencePattern,
          teacher_id: teacherId,
          group_id: groupId,
          max_participants: maxParticipants,
          enrollment_required: true
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error scheduling live class:', error);
      throw new Error('Failed to schedule live class');
    }
  }

  // Get scheduled live classes
  async getScheduledLiveClasses(groupId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/groups/${groupId}/live-classes`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching scheduled live classes:', error);
      return [];
    }
  }

  // Start live class call
  async startLiveClassCall(groupId, classId, callData, userToken) {
    try {
      const {
        maxParticipants = 30,
        enrollmentRequired = true
      } = callData;

      // Verify admin permissions
      const adminId = callData.teacherId || callData.adminId;
      const isAdmin = await this.verifyGroupAdmin(groupId, adminId, userToken);
      if (!isAdmin) {
        throw new Error('Only group admins can start live class calls');
      }

      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/groups/${groupId}/live-classes/${classId}/start-call`,
        {
          max_participants: maxParticipants,
          enrollment_required: enrollmentRequired,
          group_id: groupId,
          class_id: classId
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error starting live class call:', error);
      throw new Error('Failed to start live class call');
    }
  }

  // Get group call status
  async getGroupCallStatus(groupId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/groups/${groupId}/calls/status`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching group call status:', error);
      return { active: false };
    }
  }

  // Search messages within chats - BuddyBoss first, WordPress fallback
  async searchMessages(userId, query, threadId = null, limit = 20, userToken) {
    try {
      // Primary: Use BuddyBoss search API
      try {
        console.log('Server: Searching messages via BuddyBoss API...');
        
        const response = await axios.get(
          `${this.wpApiUrl}/buddyboss/v1/messages/search-thread?search=${encodeURIComponent(query)}&per_page=${limit}`,
          {
            headers: this.getAuthHeaders(userToken)
          }
        );
        
        console.log('✅ Server: BuddyBoss search successful');
        return response.data;
      } catch (buddyBossError) {
        console.warn('⚠️ Server: BuddyBoss search failed, trying WordPress fallback:', buddyBossError.message);
        
        // Fallback: Use WordPress custom API
        const params = {
          user_id: userId,
          query: query,
          limit: limit
        };

        if (threadId) {
          params.thread_id = threadId;
        }

        const response = await axios.get(
          `${this.wpApiUrl}/chat/v1/search/messages`,
          {
            params,
            headers: this.getAuthHeaders(userToken)
          }
        );

        return response.data;
      }
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
  }

  // Global search across all chat content (aligned with WordPress plugin)
  async globalSearch(userId, query, limit = 50) {
    try {
      const params = {
        user_id: userId,
        query: query,
        limit: limit
      };

      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/search/global`,
        {
          params,
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error performing global search:', error);
      return [];
    }
  }

  // Archive/Unarchive chat
  async archiveChat(chatId, userId, archive = true) {
    try {
      await axios.post(
        `${this.wpApiUrl}/chat/v1/chats/${chatId}/archive`,
        {
          user_id: userId,
          archive: archive
        },
        {
          headers: this.getAuthHeaders()
        }
      );
    } catch (error) {
      console.error('Error archiving chat:', error);
      throw new Error('Failed to archive chat');
    }
  }

  // Get archived chats
  async getArchivedChats(userId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/chats/archived`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching archived chats:', error);
      return [];
    }
  }

  // Get archived chats count
  async getArchivedChatsCount(userId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/threads/archived/count`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders()
        }
      );

      return response.data.count || 0;
    } catch (error) {
      console.error('Error fetching archived chats count:', error);
      return 0;
    }
  }

  // Delete chat permanently
  async deleteChat(chatId, userId) {
    try {
      // Try to delete via WordPress API
      await axios.delete(
        `${this.wpApiUrl}/chat/v1/threads/${chatId}`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders()
        }
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw new Error('Failed to delete chat');
    }
  }

  // Get status analytics
  async getStatusStats(statusId, userId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/status/${statusId}/analytics`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders()
        }
      );

      return response.data.analytics;
    } catch (error) {
      console.error('Error fetching status analytics:', error);
      throw new Error('Failed to fetch status analytics');
    }
  }

  // Get status viewers with details
  async getStatusViewers(statusId, userId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/status/${statusId}/viewers`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders()
        }
      );

      return response.data.viewers;
    } catch (error) {
      console.error('Error fetching status viewers:', error);
      throw new Error('Failed to fetch status viewers');
    }
  }

  // Delete archived chat permanently
  async deleteArchivedChat(chatId, userId) {
    try {
      await axios.delete(
        `${this.wpApiUrl}/chat/v1/chats/${chatId}`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders()
        }
      );
    } catch (error) {
      console.error('Error deleting archived chat:', error);
      throw new Error('Failed to delete chat');
    }
  }

  // Record status view
  async recordStatusView(statusId, viewerId, userToken) {
    try {
      await axios.post(
        `${this.wpApiUrl}/chat/v1/statuses/${statusId}/view`,
        {
          viewer_id: viewerId
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
    } catch (error) {
      console.error('Error recording status view:', error);
    }
  }

  // Record status like
  async recordStatusLike(statusId, likerId, userToken) {
    try {
      await axios.post(
        `${this.wpApiUrl}/chat/v1/statuses/${statusId}/like`,
        {
          liker_id: likerId
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
    } catch (error) {
      console.error('Error recording status like:', error);
    }
  }

  // Status Features - WordPress plugin endpoints (BuddyBoss doesn't have status feature)
  
  // Get status list
  async getStatusList(userId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/status`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders(userToken)
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching status list:', error);
      return [];
    }
  }

  // Create status
  async createStatus(data, userToken) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/status`,
        data,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating status:', error);
      throw new Error('Failed to create status');
    }
  }

  // Upload status media
  async uploadStatusMedia(formData, userToken) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/status/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${userToken}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error uploading status media:', error);
      throw new Error('Failed to upload status media');
    }
  }

  // Get specific status
  async getStatus(statusId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/status/${statusId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching status:', error);
      throw new Error('Failed to fetch status');
    }
  }

  // Mark status as viewed
  async markStatusViewed(statusId, userToken) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/status/${statusId}/view`,
        {},
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error marking status as viewed:', error);
      throw new Error('Failed to mark status as viewed');
    }
  }

  // Get status viewers
  async getStatusViewersNew(statusId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/status/${statusId}/viewers`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching status viewers:', error);
      return [];
    }
  }

  // Get status analytics
  async getStatusAnalytics(statusId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/status/${statusId}/analytics`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching status analytics:', error);
      return {};
    }
  }

  // Like status
  async likeStatus(statusId, userToken) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/status/${statusId}/like`,
        {},
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error liking status:', error);
      throw new Error('Failed to like status');
    }
  }

  // Get status likes
  async getStatusLikes(statusId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/status/${statusId}/likes`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching status likes:', error);
      return [];
    }
  }

  // Comment on status
  async commentOnStatus(statusId, comment, userToken) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/status/${statusId}/comment`,
        { comment },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error commenting on status:', error);
      throw new Error('Failed to comment on status');
    }
  }

  // Get status comments
  async getStatusComments(statusId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/status/${statusId}/comments`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching status comments:', error);
      return [];
    }
  }
}

module.exports = new ChatService();
