/**
 * Video Room Socket Handler - Group video calling for live classes
 * Extends existing socket system without breaking 1-1 calls
 */

const videoRoomHandlers = (io) => {
  // Track active video rooms
  const activeRooms = new Map();
  const userSockets = new Map(); // Track which socket belongs to which user
  
  // Helper functions
  const logRoom = (event, data) => {
    console.log(`📹 [${new Date().toISOString()}] VIDEO_ROOM ${event}:`, data);
  };
  
  const getUserRoom = (inviteCode) => `video_room_${inviteCode}`;
  
  class VideoRoom {
    constructor(inviteCode) {
      this.inviteCode = inviteCode;
      this.participants = new Map();
      this.createdAt = new Date();
      this.isActive = true;
    }

    addParticipant(socketId, userData) {
      this.participants.set(socketId, {
        ...userData,
        socketId,
        joinedAt: new Date()
      });
      logRoom('USER_JOINED', { room: this.inviteCode, user: userData.userName, total: this.participants.size });
    }

    removeParticipant(socketId) {
      const participant = this.participants.get(socketId);
      if (participant) {
        this.participants.delete(socketId);
        logRoom('USER_LEFT', { room: this.inviteCode, user: participant.userName, total: this.participants.size });
        return participant;
      }
      return null;
    }

    getParticipants() {
      return Array.from(this.participants.values());
    }

    getParticipantCount() {
      return this.participants.size;
    }

    isEmpty() {
      return this.participants.size === 0;
    }
  }

  // Find user's socket in a specific room
  const findUserSocket = (userId, inviteCode) => {
    const room = activeRooms.get(inviteCode);
    if (!room) return null;

    for (const [socketId, participant] of room.participants) {
      if (participant.userId === userId) {
        return io.sockets.sockets.get(socketId);
      }
    }
    return null;
  };

  // Handle user disconnect from video room
  const handleUserDisconnect = (socket) => {
    const userInfo = userSockets.get(socket.id);
    if (!userInfo || !userInfo.isVideoRoom) return; // Not in a video room

    const room = activeRooms.get(userInfo.inviteCode);
    if (!room) return;

    // Remove participant from room
    const participant = room.removeParticipant(socket.id);
    userSockets.delete(socket.id);

    // Notify other participants
    if (participant) {
      socket.to(getUserRoom(userInfo.inviteCode)).emit('video_room_user_left', {
        userId: participant.userId,
        socketId: socket.id
      });
    }

    // Clean up empty room
    if (room.isEmpty()) {
      activeRooms.delete(userInfo.inviteCode);
      logRoom('ROOM_CLEANED', { inviteCode: userInfo.inviteCode });
    }
  };

  return {
    // Handle video room join
    handleVideoRoomJoin: (socket, data) => {
      try {
        const { inviteCode, userId, userName, avatar, isAdmin } = data;
        
        if (!inviteCode || !userId || !userName) {
          socket.emit('video_room_error', { message: 'Invalid room data' });
          return;
        }

        logRoom('JOIN_REQUEST', { inviteCode, userId, userName, socketId: socket.id });

        // Get or create room
        let room = activeRooms.get(inviteCode);
        if (!room) {
          room = new VideoRoom(inviteCode);
          activeRooms.set(inviteCode, room);
          logRoom('ROOM_CREATED', { inviteCode });
        }

        // Join socket to room
        const roomName = getUserRoom(inviteCode);
        socket.join(roomName);
        
        // Add participant to room
        const userData = { userId, userName, avatar, isAdmin };
        room.addParticipant(socket.id, userData);
        userSockets.set(socket.id, { inviteCode, userId, isVideoRoom: true });

        // Set userId for compatibility with existing handlers
        socket.userId = userId;

        // Notify existing participants about new user
        socket.to(roomName).emit('video_room_user_joined', {
          userId,
          userName,
          avatar,
          isAdmin,
          socketId: socket.id
        });

        // Send current participants to new user
        const currentParticipants = room.getParticipants()
          .filter(p => p.socketId !== socket.id);
        
        socket.emit('video_room_joined', {
          success: true,
          participants: currentParticipants,
          roomInfo: {
            inviteCode,
            participantCount: room.getParticipantCount()
          }
        });

        logRoom('JOIN_SUCCESS', { 
          inviteCode, 
          userId, 
          totalParticipants: room.getParticipantCount() 
        });

      } catch (error) {
        console.error('📹 Video Room Join Error:', error);
        socket.emit('video_room_error', { message: 'Failed to join room' });
      }
    },

    // Handle WebRTC offer for video rooms
    handleVideoRoomOffer: (socket, data) => {
      try {
        const { offer, targetUserId } = data;
        const userInfo = userSockets.get(socket.id);
        
        if (!userInfo || !userInfo.isVideoRoom) {
          console.error('📹 User not in video room');
          return;
        }

        // Find target user's socket
        const targetSocket = findUserSocket(targetUserId, userInfo.inviteCode);
        if (targetSocket) {
          targetSocket.emit('video_room_offer', {
            offer,
            fromUserId: userInfo.userId,
            fromSocketId: socket.id
          });
          logRoom('OFFER_SENT', { from: userInfo.userId, to: targetUserId });
        }

      } catch (error) {
        console.error('📹 Video Room Offer Error:', error);
      }
    },

    // Handle WebRTC answer for video rooms
    handleVideoRoomAnswer: (socket, data) => {
      try {
        const { answer, targetUserId } = data;
        const userInfo = userSockets.get(socket.id);
        
        if (!userInfo || !userInfo.isVideoRoom) {
          console.error('📹 User not in video room');
          return;
        }

        // Find target user's socket
        const targetSocket = findUserSocket(targetUserId, userInfo.inviteCode);
        if (targetSocket) {
          targetSocket.emit('video_room_answer', {
            answer,
            fromUserId: userInfo.userId,
            fromSocketId: socket.id
          });
          logRoom('ANSWER_SENT', { from: userInfo.userId, to: targetUserId });
        }

      } catch (error) {
        console.error('📹 Video Room Answer Error:', error);
      }
    },

    // Handle ICE candidates for video rooms
    handleVideoRoomIceCandidate: (socket, data) => {
      try {
        const { candidate, targetUserId } = data;
        const userInfo = userSockets.get(socket.id);
        
        if (!userInfo || !userInfo.isVideoRoom) {
          return;
        }

        // Find target user's socket
        const targetSocket = findUserSocket(targetUserId, userInfo.inviteCode);
        if (targetSocket) {
          targetSocket.emit('video_room_ice_candidate', {
            candidate,
            fromUserId: userInfo.userId,
            fromSocketId: socket.id
          });
        }

      } catch (error) {
        console.error('📹 Video Room ICE Error:', error);
      }
    },

    // Handle media state changes
    handleVideoRoomMediaState: (socket, data) => {
      try {
        const { isAudioEnabled, isVideoEnabled } = data;
        const userInfo = userSockets.get(socket.id);
        
        if (!userInfo || !userInfo.isVideoRoom) {
          return;
        }

        // Broadcast media state to other participants
        socket.to(getUserRoom(userInfo.inviteCode)).emit('video_room_media_change', {
          userId: userInfo.userId,
          socketId: socket.id,
          isAudioEnabled,
          isVideoEnabled
        });

        logRoom('MEDIA_STATE_CHANGE', { 
          userId: userInfo.userId, 
          audio: isAudioEnabled, 
          video: isVideoEnabled 
        });

      } catch (error) {
        console.error('📹 Video Room Media State Error:', error);
      }
    },

    // Handle admin actions
    handleVideoRoomAdminAction: (socket, data) => {
      try {
        const { action, targetUserId, reason } = data;
        const userInfo = userSockets.get(socket.id);
        
        if (!userInfo || !userInfo.isVideoRoom) {
          return;
        }

        const room = activeRooms.get(userInfo.inviteCode);
        const participant = room?.participants.get(socket.id);
        
        // Verify admin permissions
        if (!participant?.isAdmin) {
          socket.emit('video_room_error', { message: 'Admin permissions required' });
          return;
        }

        switch (action) {
          case 'mute-user':
            this.handleMuteUser(userInfo.inviteCode, targetUserId, true);
            break;
          case 'unmute-user':
            this.handleMuteUser(userInfo.inviteCode, targetUserId, false);
            break;
          case 'kick-user':
            this.handleKickUser(userInfo.inviteCode, targetUserId, reason);
            break;
          default:
            console.error('📹 Unknown admin action:', action);
        }

      } catch (error) {
        console.error('📹 Video Room Admin Action Error:', error);
      }
    },

    // Handle room leave
    handleVideoRoomLeave: (socket) => {
      handleUserDisconnect(socket);
    },

    // Admin: Mute user
    handleMuteUser: (inviteCode, targetUserId, shouldMute) => {
      const targetSocket = findUserSocket(targetUserId, inviteCode);
      if (targetSocket) {
        targetSocket.emit('video_room_admin_mute', { shouldMute });
        
        // Notify other participants
        targetSocket.to(getUserRoom(inviteCode)).emit('video_room_participant_muted', {
          userId: targetUserId,
          isMuted: shouldMute
        });
        
        logRoom('ADMIN_MUTE', { targetUserId, shouldMute });
      }
    },

    // Admin: Kick user
    handleKickUser: (inviteCode, targetUserId, reason) => {
      const targetSocket = findUserSocket(targetUserId, inviteCode);
      if (targetSocket) {
        targetSocket.emit('video_room_admin_kick', { reason: reason || 'Kicked by admin' });
        targetSocket.disconnect();
        
        logRoom('ADMIN_KICK', { targetUserId, reason });
      }
    },

    // Cleanup user from video rooms on disconnect
    cleanupVideoRoomUser: (socket) => {
      handleUserDisconnect(socket);
    },

    // Get video room statistics
    getVideoRoomStats: () => {
      const stats = {
        totalRooms: activeRooms.size,
        rooms: []
      };

      activeRooms.forEach((room, inviteCode) => {
        stats.rooms.push({
          inviteCode: inviteCode.substring(0, 8) + '***', // Partially hidden for privacy
          participantCount: room.getParticipantCount(),
          createdAt: room.createdAt,
          isActive: room.isActive
        });
      });

      return stats;
    }
  };
};

module.exports = videoRoomHandlers;