const axios = require('axios');

class PresenceService {
  constructor() {
    this.wpBaseUrl = process.env.WP_BASE_URL || 'https://your-wordpress-site.com';
    this.wpApiUrl = `${this.wpBaseUrl}/wp-json`;
    this.presenceCache = new Map(); // In-memory cache for presence data
  }

  // Get authorization headers
  getAuthHeaders(userToken) {
    return {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Set user online status
  async setUserOnline(userId, userToken) {
    try {
      const now = new Date();
      
      // Update in cache
      this.presenceCache.set(userId, {
        status: 'online',
        lastSeen: now,
        updatedAt: now
      });

      // Update in WordPress using verified endpoint
      if (userToken) {
        try {
          const response = await axios.post(
            `${this.wpApiUrl}/chat/v1/presence/update`,
            {
              user_id: userId,
              status: 'online'
            },
            {
              headers: this.getAuthHeaders(userToken)
            }
          );
          
          console.log(`User ${userId} set online via WordPress API`);
          return response.data;
        } catch (wpError) {
          console.log('WordPress presence update failed (continuing with local cache):', wpError.response?.data || wpError.message);
        }
      }

      return true;
    } catch (error) {
      console.error('Error setting user online:', error);
      return false;
    }
  }

  // Set user offline status
  async setUserOffline(userId, userToken) {
    try {
      const now = new Date();
      
      // Update in cache
      this.presenceCache.set(userId, {
        status: 'offline',
        lastSeen: now,
        updatedAt: now
      });

      // Update in WordPress using verified endpoint
      if (userToken) {
        try {
          const response = await axios.post(
            `${this.wpApiUrl}/chat/v1/presence/update`,
            {
              user_id: userId,
              status: 'offline'
            },
            {
              headers: this.getAuthHeaders(userToken)
            }
          );
          
          console.log(`User ${userId} set offline via WordPress API`);
          return response.data;
        } catch (wpError) {
          console.log('WordPress presence update failed (continuing with local cache):', wpError.response?.data || wpError.message);
        }
      }

      return true;
    } catch (error) {
      console.error('Error setting user offline:', error);
      return false;
    }
  }

  // Set user away status
  async setUserAway(userId) {
    try {
      const now = new Date();
      
      // Update in cache
      this.presenceCache.set(userId, {
        status: 'away',
        lastSeen: now,
        updatedAt: now
      });

      // Update in WordPress
      await axios.post(
        `${this.wpApiUrl}/buddyboss/v1/members/presence`,
        {
          user_id: userId,
          status: 'away',
          last_activity: now.toISOString()
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return true;
    } catch (error) {
      console.error('Error setting user away:', error);
      return false;
    }
  }

  // Get user presence status
  async getUserPresence(userId) {
    try {
      // Check cache first
      if (this.presenceCache.has(userId)) {
        const cached = this.presenceCache.get(userId);
        const cacheAge = Date.now() - cached.updatedAt.getTime();
        
        // Use cache if less than 30 seconds old
        if (cacheAge < 30000) {
          return cached;
        }
      }

      // Fetch from WordPress
      const response = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/members/${userId}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      const presence = {
        status: response.data.last_activity ? this.calculateStatus(response.data.last_activity) : 'offline',
        lastSeen: response.data.last_activity ? new Date(response.data.last_activity) : new Date(),
        updatedAt: new Date()
      };

      // Update cache
      this.presenceCache.set(userId, presence);

      return presence;
    } catch (error) {
      console.error('Error getting user presence:', error);
      return {
        status: 'offline',
        lastSeen: new Date(),
        updatedAt: new Date()
      };
    }
  }

  // Get multiple users' presence
  async getMultipleUsersPresence(userIds) {
    try {
      const presenceData = {};
      const uncachedUsers = [];

      // Check cache for each user
      userIds.forEach(userId => {
        if (this.presenceCache.has(userId)) {
          const cached = this.presenceCache.get(userId);
          const cacheAge = Date.now() - cached.updatedAt.getTime();
          
          if (cacheAge < 30000) {
            presenceData[userId] = cached;
          } else {
            uncachedUsers.push(userId);
          }
        } else {
          uncachedUsers.push(userId);
        }
      });

      // Fetch uncached users from WordPress
      if (uncachedUsers.length > 0) {
        const response = await axios.post(
          `${this.wpApiUrl}/buddyboss/v1/members/presence/bulk`,
          {
            user_ids: uncachedUsers
          },
          {
            headers: this.getAuthHeaders()
          }
        );

        // Process bulk response
        response.data.forEach(userData => {
          const presence = {
            status: userData.last_activity ? this.calculateStatus(userData.last_activity) : 'offline',
            lastSeen: userData.last_activity ? new Date(userData.last_activity) : new Date(),
            updatedAt: new Date()
          };

          presenceData[userData.id] = presence;
          this.presenceCache.set(userData.id, presence);
        });
      }

      return presenceData;
    } catch (error) {
      console.error('Error getting multiple users presence:', error);
      
      // Return default offline status for all users
      const defaultPresence = {};
      userIds.forEach(userId => {
        defaultPresence[userId] = {
          status: 'offline',
          lastSeen: new Date(),
          updatedAt: new Date()
        };
      });
      return defaultPresence;
    }
  }

  // Calculate status based on last activity
  calculateStatus(lastActivity) {
    const now = new Date();
    const lastActivityDate = new Date(lastActivity);
    const diffMinutes = (now - lastActivityDate) / (1000 * 60);

    if (diffMinutes < 5) {
      return 'online';
    } else if (diffMinutes < 30) {
      return 'away';
    } else {
      return 'offline';
    }
  }

  // Update user's last activity
  async updateLastActivity(userId) {
    try {
      const now = new Date();
      
      // Update cache if user exists
      if (this.presenceCache.has(userId)) {
        const current = this.presenceCache.get(userId);
        this.presenceCache.set(userId, {
          ...current,
          lastSeen: now,
          updatedAt: now,
          status: 'online' // User is active, so they're online
        });
      }

      // Throttle WordPress updates to avoid too many requests
      const lastUpdate = this.getLastUpdateTime(userId);
      if (!lastUpdate || (now - lastUpdate) > 60000) { // Update max once per minute
        await axios.post(
          `${this.wpApiUrl}/buddyboss/v1/members/presence`,
          {
            user_id: userId,
            last_activity: now.toISOString()
          },
          {
            headers: this.getAuthHeaders()
          }
        );

        this.setLastUpdateTime(userId, now);
      }

      return true;
    } catch (error) {
      console.error('Error updating last activity:', error);
      return false;
    }
  }

  // Get friends' presence status
  async getFriendsPresence(userId) {
    try {
      // Get user's friends list
      const friendsResponse = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/friends`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders()
        }
      );

      const friendIds = friendsResponse.data.map(friend => friend.id);
      
      if (friendIds.length === 0) {
        return {};
      }

      // Get presence for all friends
      return await this.getMultipleUsersPresence(friendIds);
    } catch (error) {
      console.error('Error getting friends presence:', error);
      return {};
    }
  }

  // Set user typing status
  async setTypingStatus(userId, chatId, isTyping) {
    try {
      const key = `typing_${userId}_${chatId}`;
      
      if (isTyping) {
        this.presenceCache.set(key, {
          isTyping: true,
          timestamp: new Date()
        });
      } else {
        this.presenceCache.delete(key);
      }

      return true;
    } catch (error) {
      console.error('Error setting typing status:', error);
      return false;
    }
  }

  // Get typing users in chat
  getTypingUsers(chatId) {
    try {
      const typingUsers = [];
      const now = new Date();

      for (const [key, value] of this.presenceCache.entries()) {
        if (key.startsWith('typing_') && key.endsWith(`_${chatId}`)) {
          const userId = key.split('_')[1];
          const timeDiff = now - value.timestamp;
          
          // Remove typing status if older than 10 seconds
          if (timeDiff > 10000) {
            this.presenceCache.delete(key);
          } else if (value.isTyping) {
            typingUsers.push(parseInt(userId));
          }
        }
      }

      return typingUsers;
    } catch (error) {
      console.error('Error getting typing users:', error);
      return [];
    }
  }

  // Clean up old presence data
  cleanupPresenceCache() {
    try {
      const now = new Date();
      const maxAge = 5 * 60 * 1000; // 5 minutes

      for (const [key, value] of this.presenceCache.entries()) {
        if (value.updatedAt && (now - value.updatedAt) > maxAge) {
          this.presenceCache.delete(key);
        }
      }
    } catch (error) {
      console.error('Error cleaning up presence cache:', error);
    }
  }

  // Helper methods for throttling WordPress updates
  getLastUpdateTime(userId) {
    return this.presenceCache.get(`lastUpdate_${userId}`);
  }

  setLastUpdateTime(userId, time) {
    this.presenceCache.set(`lastUpdate_${userId}`, time);
  }

  // Get online friends count
  async getOnlineFriendsCount(userId) {
    try {
      const friendsPresence = await this.getFriendsPresence(userId);
      let onlineCount = 0;

      Object.values(friendsPresence).forEach(presence => {
        if (presence.status === 'online') {
          onlineCount++;
        }
      });

      return onlineCount;
    } catch (error) {
      console.error('Error getting online friends count:', error);
      return 0;
    }
  }

  // Set user invisible mode
  async setInvisibleMode(userId, invisible = true) {
    try {
      await axios.post(
        `${this.wpApiUrl}/chat/v1/presence/invisible`,
        {
          user_id: userId,
          invisible: invisible
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return true;
    } catch (error) {
      console.error('Error setting invisible mode:', error);
      return false;
    }
  }
}

module.exports = new PresenceService();
