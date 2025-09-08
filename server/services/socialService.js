const axios = require('axios');

class SocialService {
  constructor() {
    this.wpBaseUrl = process.env.WP_BASE_URL || 'https://your-wordpress-site.com';
    this.wpApiUrl = `${this.wpBaseUrl}/wp-json`;
  }

  // Get authorization headers for WordPress API
  getAuthHeaders(userToken) {
    return {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Get user's friends list
  async getFriends(userId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/friends`,
        {
          params: { 
            user_id: userId,
            per_page: 100 
          },
          headers: this.getAuthHeaders()
        }
      );

      return this.formatContactsList(response.data);
    } catch (error) {
      console.error('Error fetching friends:', error);
      return [];
    }
  }

  // Get user's followers
  async getFollowers(userId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/followers`,
        {
          params: { 
            user_id: userId,
            per_page: 100 
          },
          headers: this.getAuthHeaders()
        }
      );

      return this.formatContactsList(response.data);
    } catch (error) {
      console.error('Error fetching followers:', error);
      return [];
    }
  }

  // Get users that the current user is following
  async getFollowing(userId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/following`,
        {
          params: { 
            user_id: userId,
            per_page: 100 
          },
          headers: this.getAuthHeaders()
        }
      );

      return this.formatContactsList(response.data);
    } catch (error) {
      console.error('Error fetching following:', error);
      return [];
    }
  }

  // Search users globally
  async searchUsers(query, currentUserId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/members`,
        {
          params: { 
            search: query,
            exclude: currentUserId, // Don't include current user in results
            per_page: 50 
          },
          headers: this.getAuthHeaders()
        }
      );

      return this.formatContactsList(response.data);
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  // Block a user
  async blockUser(currentUserId, targetUserId) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/buddyboss/v1/members/block`,
        {
          user_id: currentUserId,
          target_user_id: targetUserId
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error blocking user:', error);
      throw new Error('Failed to block user');
    }
  }

  // Unblock a user
  async unblockUser(currentUserId, targetUserId) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/buddyboss/v1/members/unblock`,
        {
          user_id: currentUserId,
          target_user_id: targetUserId
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw new Error('Failed to unblock user');
    }
  }

  // Get blocked users list
  async getBlockedUsers(userId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/members/blocked`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders()
        }
      );

      return this.formatContactsList(response.data);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      return [];
    }
  }

  // Send friend request
  async sendFriendRequest(currentUserId, targetUserId) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/buddyboss/v1/friends/request`,
        {
          initiator_id: currentUserId,
          friend_id: targetUserId
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error sending friend request:', error);
      throw new Error('Failed to send friend request');
    }
  }

  // Accept friend request
  async acceptFriendRequest(friendshipId, userId) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/buddyboss/v1/friends/accept`,
        {
          friendship_id: friendshipId,
          user_id: userId
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      throw new Error('Failed to accept friend request');
    }
  }

  // Reject friend request
  async rejectFriendRequest(friendshipId, userId) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/buddyboss/v1/friends/reject`,
        {
          friendship_id: friendshipId,
          user_id: userId
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      throw new Error('Failed to reject friend request');
    }
  }

  // Remove friend
  async removeFriend(currentUserId, friendId) {
    try {
      const response = await axios.delete(
        `${this.wpApiUrl}/buddyboss/v1/friends/remove`,
        {
          data: {
            user_id: currentUserId,
            friend_id: friendId
          },
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error removing friend:', error);
      throw new Error('Failed to remove friend');
    }
  }

  // Get friend requests (pending incoming requests)
  async getFriendRequests(userId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/friends/requests`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders()
        }
      );

      return this.formatFriendRequests(response.data);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      return [];
    }
  }

  // Format contacts list to consistent structure
  formatContactsList(contacts) {
    if (!Array.isArray(contacts)) {
      return [];
    }

    return contacts.map(contact => ({
      id: contact.id,
      name: contact.name || contact.display_name || '',
      username: contact.username || contact.user_login || '',
      email: contact.email || '',
      avatar: contact.avatar_urls?.full || contact.avatar_urls?.['96'] || '',
      status: contact.status || contact.last_activity || '',
      isOnline: contact.is_online || false,
      isFriend: contact.is_friend || false,
      isBlocked: contact.is_blocked || false,
      friendshipStatus: contact.friendship_status || 'none' // 'none', 'pending', 'accepted', 'blocked'
    }));
  }

  // Format friend requests to consistent structure
  formatFriendRequests(requests) {
    if (!Array.isArray(requests)) {
      return [];
    }

    return requests.map(request => ({
      id: request.id,
      friendshipId: request.friendship_id,
      userId: request.user_id,
      name: request.name || request.display_name || '',
      username: request.username || request.user_login || '',
      avatar: request.avatar_urls?.full || request.avatar_urls?.['96'] || '',
      requestDate: request.date_created || request.created_at || '',
      message: request.message || ''
    }));
  }

  // Get user's online status
  async getUserOnlineStatus(userId) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/buddyboss/v1/members/${userId}/status`,
        {
          headers: this.getAuthHeaders()
        }
      );

      return {
        isOnline: response.data.is_online || false,
        lastSeen: response.data.last_activity || null
      };
    } catch (error) {
      console.error('Error fetching user online status:', error);
      return { isOnline: false, lastSeen: null };
    }
  }

  // Update user's online status
  async updateUserOnlineStatus(userId, isOnline = true) {
    try {
      await axios.post(
        `${this.wpApiUrl}/buddyboss/v1/members/${userId}/status`,
        {
          is_online: isOnline,
          last_activity: new Date().toISOString()
        },
        {
          headers: this.getAuthHeaders()
        }
      );
    } catch (error) {
      console.error('Error updating user online status:', error);
    }
  }
}

module.exports = new SocialService();
