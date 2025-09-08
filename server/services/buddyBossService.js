const axios = require('axios');

class BuddyBossService {
  constructor() {
    this.baseUrl = process.env.WORDPRESS_URL || 'https://olomak.com';
    this.apiVersion = 'buddyboss/v1';
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Make authenticated request to BuddyBoss API
   */
  async makeAuthenticatedRequest(endpoint, options = {}, token = null) {
    try {
      const config = {
        ...options,
        headers: {
          ...options.headers,
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      };

      const response = await this.axiosInstance.request({
        url: `/wp-json/${this.apiVersion}/${endpoint}`,
        ...config
      });

      return response.data;
    } catch (error) {
      console.error('BuddyBoss API request failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Register new user with BuddyBoss
   */
  async registerUser(userData) {
    return await this.makeAuthenticatedRequest('signup', {
      method: 'POST',
      data: userData
    });
  }



  /**
   * Get XProfile fields for a user
   */
  async getXProfileFields(userId, token) {
    return await this.makeAuthenticatedRequest(`xprofile/${userId}`, {
      method: 'GET'
    }, token);
  }

  /**
   * Get XProfile groups and field structure
   */
  async getXProfileGroups(token) {
    return await this.makeAuthenticatedRequest('xprofile/groups', {
      method: 'GET'
    }, token);
  }

  /**
   * Get XProfile field options (for select/radio fields)
   */
  async getXProfileFieldOptions(fieldId, token) {
    return await this.makeAuthenticatedRequest(`xprofile/fields/${fieldId}`, {
      method: 'GET'
    }, token);
  }

  /**
   * Update XProfile fields for a user
   */
  async updateXProfileFields(userId, fields, token) {
    return await this.makeAuthenticatedRequest(`xprofile/${userId}`, {
      method: 'POST',
      data: { fields }
    }, token);
  }

  /**
   * Upload avatar for user
   */
  async uploadAvatar(userId, imageData, token) {
    const formData = new FormData();
    formData.append('action', 'bp_avatar_upload');
    formData.append('object', 'user');
    formData.append('object_id', userId);
    formData.append('file', imageData);

    return await this.makeAuthenticatedRequest(`members/${userId}/avatar`, {
      method: 'POST',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }, token);
  }

  /**
   * Delete avatar for user
   */
  async deleteAvatar(userId, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/avatar`, {
      method: 'DELETE'
    }, token);
  }

  /**
   * Get user settings
   */
  async getUserSettings(userId, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/settings`, {
      method: 'GET'
    }, token);
  }

  /**
   * Update user settings
   */
  async updateUserSettings(userId, settings, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/settings`, {
      method: 'POST',
      data: settings
    }, token);
  }

  /**
   * Get privacy settings
   */
  async getPrivacySettings(userId, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/privacy`, {
      method: 'GET'
    }, token);
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(userId, settings, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/privacy`, {
      method: 'POST',
      data: settings
    }, token);
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(userId, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/notifications`, {
      method: 'GET'
    }, token);
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(userId, settings, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/notifications`, {
      method: 'POST',
      data: settings
    }, token);
  }

  /**
   * Block a user
   */
  async blockUser(userId, targetUserId, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/block`, {
      method: 'POST',
      data: { user_id: targetUserId }
    }, token);
  }

  /**
   * Unblock a user
   */
  async unblockUser(userId, targetUserId, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/unblock`, {
      method: 'POST',
      data: { user_id: targetUserId }
    }, token);
  }

  /**
   * Get blocked users list
   */
  async getBlockedUsers(userId, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/blocked`, {
      method: 'GET'
    }, token);
  }

  /**
   * Report a user
   */
  async reportUser(userId, targetUserId, reason, token) {
    return await this.makeAuthenticatedRequest(`moderation/report`, {
      method: 'POST',
      data: {
        user_id: targetUserId,
        reported_by: userId,
        reason: reason
      }
    }, token);
  }

  /**
   * Get activity feed
   */
  async getActivityFeed(params = {}, token) {
    const queryParams = new URLSearchParams(params).toString();
    return await this.makeAuthenticatedRequest(`activity${queryParams ? '?' + queryParams : ''}`, {
      method: 'GET'
    }, token);
  }

  /**
   * Post activity
   */
  async postActivity(activityData, token) {
    return await this.makeAuthenticatedRequest('activity', {
      method: 'POST',
      data: activityData
    }, token);
  }

  /**
   * Delete activity
   */
  async deleteActivity(activityId, token) {
    return await this.makeAuthenticatedRequest(`activity/${activityId}`, {
      method: 'DELETE'
    }, token);
  }

  /**
   * Like/unlike activity
   */
  async toggleActivityLike(activityId, token) {
    return await this.makeAuthenticatedRequest(`activity/${activityId}/favorite`, {
      method: 'POST'
    }, token);
  }

  /**
   * Get activity comments
   */
  async getActivityComments(activityId, token) {
    return await this.makeAuthenticatedRequest(`activity/${activityId}/comment`, {
      method: 'GET'
    }, token);
  }

  /**
   * Post activity comment
   */
  async postActivityComment(activityId, content, token) {
    return await this.makeAuthenticatedRequest(`activity/${activityId}/comment`, {
      method: 'POST',
      data: { content }
    }, token);
  }

  /**
   * Delete activity comment
   */
  async deleteActivityComment(commentId, token) {
    return await this.makeAuthenticatedRequest(`activity/comment/${commentId}`, {
      method: 'DELETE'
    }, token);
  }

  /**
   * Get user's friends
   */
  async getUserFriends(userId, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/friends`, {
      method: 'GET'
    }, token);
  }

  /**
   * Send friend request
   */
  async sendFriendRequest(userId, targetUserId, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/friends`, {
      method: 'POST',
      data: { friend_id: targetUserId }
    }, token);
  }

  /**
   * Accept friend request
   */
  async acceptFriendRequest(userId, requestId, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/friends/${requestId}`, {
      method: 'PUT',
      data: { status: 'accepted' }
    }, token);
  }

  /**
   * Reject friend request
   */
  async rejectFriendRequest(userId, requestId, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/friends/${requestId}`, {
      method: 'PUT',
      data: { status: 'rejected' }
    }, token);
  }

  /**
   * Remove friend
   */
  async removeFriend(userId, friendId, token) {
    return await this.makeAuthenticatedRequest(`members/${userId}/friends/${friendId}`, {
      method: 'DELETE'
    }, token);
  }

  /**
   * Get groups
   */
  async getGroups(params = {}, token) {
    const queryParams = new URLSearchParams(params).toString();
    return await this.makeAuthenticatedRequest(`groups${queryParams ? '?' + queryParams : ''}`, {
      method: 'GET'
    }, token);
  }

  /**
   * Join group
   */
  async joinGroup(groupId, userId, token) {
    return await this.makeAuthenticatedRequest(`groups/${groupId}/members`, {
      method: 'POST',
      data: { user_id: userId }
    }, token);
  }

  /**
   * Leave group
   */
  async leaveGroup(groupId, userId, token) {
    return await this.makeAuthenticatedRequest(`groups/${groupId}/members/${userId}`, {
      method: 'DELETE'
    }, token);
  }

  /**
   * Get group members
   */
  async getGroupMembers(groupId, token) {
    return await this.makeAuthenticatedRequest(`groups/${groupId}/members`, {
      method: 'GET'
    }, token);
  }
}

module.exports = new BuddyBossService();
