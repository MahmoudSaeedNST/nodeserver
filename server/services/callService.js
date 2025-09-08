const axios = require('axios');

class CallService {
  constructor() {
    this.wpBaseUrl = process.env.WP_BASE_URL || 'https://olomak.com';
    this.wpApiUrl = `${this.wpBaseUrl}/wp-json`;
  }

  // Get authorization headers
  getAuthHeaders(userToken) {
    if (!userToken) {
      throw new Error('Authentication token is required for this operation');
    }
    return {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Initiate a call
  async initiateCall(data, userToken) {
    try {
      const { callerId, calleeId, roomName, isVideo = false, offerSdp = null } = data;
      
      console.log('Initiating call with data:', { callerId, calleeId, roomName, isVideo, offerSdp: offerSdp ? 'present' : 'null' });
      console.log('WordPress API URL:', `${this.wpApiUrl}/chat/v1/calls/initiate`);
      
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/calls/initiate`,
        {
          caller_id: callerId,
          callee_id: calleeId,
          room_name: roomName || `call_${Date.now()}`,
          is_video: isVideo,
          offer_sdp: offerSdp
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error initiating call:', error.response?.data || error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw new Error(`Failed to initiate call: ${error.response?.data?.message || error.message}`);
    }
  }

  // Update call status
  async updateCallStatus(callId, status, userToken, duration = null) {
    try {
      const updateData = {
        call_id: callId, // Send the actual call_id
        status: status, // 'ringing', 'answered', 'rejected', 'ended', 'missed'
      };

      if (duration !== null) {
        updateData.duration = duration;
      }

      console.log('Updating call status:', { callId, status, duration });
      console.log('WordPress API URL:', `${this.wpApiUrl}/chat/v1/calls/update-status`);

      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/calls/update-status`,
        updateData,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error updating call status:', error.response?.data || error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw new Error(`Failed to update call status: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get call history for user
  async getCallHistory(userId, userToken, page = 1, limit = 50) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/calls/history`,
        {
          params: {
            user_id: userId,
            page: page,
            per_page: limit
          },
          headers: this.getAuthHeaders(userToken)
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error fetching call history:', error.response?.data || error.message);
      return {
        success: false,
        error: 'Failed to fetch call history'
      };
    }
  }

  // Get missed calls count
  async getMissedCallsCount(userId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/calls/missed/count`,
        {
          params: {
            user_id: userId
          },
          headers: this.getAuthHeaders(userToken)
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error fetching missed calls count:', error.response?.data || error.message);
      return {
        success: false,
        error: 'Failed to fetch missed calls count'
      };
    }
  }

  // Get call details
  async getCallDetails(callId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/calls/${callId}`,
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching call details:', error);
      throw new Error('Failed to fetch call details');
    }
  }

  // Create group call
  async createGroupCall(data, userToken) {
    try {
      const { creatorId, participantIds, callType, chatId } = data;
      
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/calls/group/create`,
        {
          creator_id: creatorId,
          participant_ids: participantIds,
          call_type: callType,
          chat_id: chatId,
          status: 'active'
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error creating group call:', error);
      throw new Error('Failed to create group call');
    }
  }

  // Join group call
  async joinGroupCall(callId, userId, userToken) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/calls/group/${callId}/join`,
        {
          user_id: userId
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error joining group call:', error);
      throw new Error('Failed to join group call');
    }
  }

  // Leave group call
  async leaveGroupCall(callId, userId, userToken) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/calls/group/${callId}/leave`,
        {
          user_id: userId
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error leaving group call:', error);
      throw new Error('Failed to leave group call');
    }
  }

  // Get active group calls for user
  async getActiveGroupCalls(userId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/calls/group/active`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching active group calls:', error);
      return [];
    }
  }

  // End group call
  async endGroupCall(callId, userId, userToken) {
    try {
      const response = await axios.post(
        `${this.wpApiUrl}/chat/v1/calls/group/${callId}/end`,
        {
          user_id: userId
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error ending group call:', error);
      throw new Error('Failed to end group call');
    }
  }

  // Get missed calls count
  async getMissedCallsCount(userId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/calls/missed/count`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data.count || 0;
    } catch (error) {
      console.error('Error fetching missed calls count:', error);
      return 0;
    }
  }

  // Mark missed calls as seen
  async markMissedCallsSeen(userId, userToken) {
    try {
      await axios.post(
        `${this.wpApiUrl}/chat/v1/calls/missed/mark-seen`,
        {
          user_id: userId
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
    } catch (error) {
      console.error('Error marking missed calls as seen:', error);
    }
  }

  // Get call statistics
  async getCallStatistics(userId, userToken, period = 'week') {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/calls/statistics`,
        {
          params: {
            user_id: userId,
            period: period // 'day', 'week', 'month', 'year'
          },
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching call statistics:', error);
      return {
        total_calls: 0,
        answered_calls: 0,
        missed_calls: 0,
        total_duration: 0
      };
    }
  }

  // Block/Unblock user for calls
  async blockUserCalls(userId, targetUserId, userToken, block = true) {
    try {
      await axios.post(
        `${this.wpApiUrl}/chat/v1/calls/block`,
        {
          user_id: userId,
          target_user_id: targetUserId,
          block: block
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
    } catch (error) {
      console.error('Error blocking/unblocking user calls:', error);
      throw new Error('Failed to update call block status');
    }
  }

  // Get blocked users list
  async getBlockedUsers(userId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/calls/blocked`,
        {
          params: { user_id: userId },
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      return [];
    }
  }

  // Check if user can call another user
  async canUserCall(callerId, targetUserId, userToken) {
    try {
      const response = await axios.get(
        `${this.wpApiUrl}/chat/v1/calls/can-call`,
        {
          params: {
            caller_id: callerId,
            target_user_id: targetUserId
          },
          headers: this.getAuthHeaders(userToken)
        }
      );

      return response.data.can_call || false;
    } catch (error) {
      console.error('Error checking call permission:', error);
      return false;
    }
  }

  // Report call issue
  async reportCallIssue(data, userToken) {
    try {
      const { callId, userId, issueType, description } = data;
      
      await axios.post(
        `${this.wpApiUrl}/chat/v1/calls/${callId}/report`,
        {
          user_id: userId,
          issue_type: issueType, // 'poor_quality', 'connection_failed', 'audio_issue', 'video_issue', 'other'
          description: description
        },
        {
          headers: this.getAuthHeaders(userToken)
        }
      );
    } catch (error) {
      console.error('Error reporting call issue:', error);
      throw new Error('Failed to report call issue');
    }
  }
}

module.exports = new CallService();
