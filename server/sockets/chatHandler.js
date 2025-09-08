const jwt = require('jsonwebtoken');
const wordPressService = require('../services/wordpressService');
const chatService = require('../services/chatService');
const callService = require('../services/callService');
const presenceService = require('../services/presenceService');

class ChatHandler {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map();
    this.activeRooms = new Map();
    this.activeCalls = new Map();
  }

  handleConnection(socket) {
    console.log('New socket connection:', socket.id);

    // Authenticate socket connection
    socket.on('authenticate', async (token) => {
      try {
        // Validate token format first
        if (!token || typeof token !== 'string') {
          throw new Error('Invalid token format');
        }

        const cleanToken = token.trim();
        const tokenParts = cleanToken.split('.');
        if (tokenParts.length !== 3) {
          throw new Error('Malformed JWT token');
        }

        // Validate token with WordPress
        const validation = await wordPressService.validateToken(cleanToken);
        console.log('Token validation result:', validation);
        
        // Handle different response formats from WordPress JWT plugin
        let userData = null;
        
        if (validation.data && validation.data.user) {
          // Full user data response
          userData = validation.data.user;
        } else if (validation.data && validation.data.status === 200) {
          // Simple validation response - need to extract user from token
          try {
            const tokenParts = cleanToken.split('.');
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            if (payload.data && payload.data.user && payload.data.user.id) {
              // Get user data from WordPress using the user ID
              const userResponse = await wordPressService.getUserById(payload.data.user.id, cleanToken);
              if (userResponse && userResponse.id) {
                userData = {
                  id: userResponse.id,
                  user_email: userResponse.email,
                  user_login: userResponse.username || userResponse.slug,
                  display_name: userResponse.name,
                  roles: userResponse.roles || ['subscriber']
                };
              }
            }
          } catch (decodeError) {
            console.error('Error decoding token payload:', decodeError);
          }
        }
        
        if (!userData || !userData.id) {
          throw new Error('Invalid token');
        }

        socket.userId = userData.id;
        socket.userEmail = userData.user_email;
        socket.token = cleanToken;
        
        // Store user connection
        this.connectedUsers.set(socket.userId, {
          socketId: socket.id,
          userId: socket.userId,
          email: socket.userEmail,
          token: cleanToken,
          lastSeen: new Date()
        });

        // Update user presence with token
        await presenceService.setUserOnline(socket.userId, cleanToken);
        
        // Join user to their personal room
        socket.join(`user_${socket.userId}`);
        console.log(`📞 User ${socket.userId} joined room: user_${socket.userId}`);
        
        // Verify room membership
        const userRoom = `user_${socket.userId}`;
        const roomSockets = this.io.sockets.adapter.rooms.get(userRoom);
        console.log(`📞 Room ${userRoom} now has ${roomSockets?.size || 0} sockets`);
        
        // Notify friends about online status
        this.broadcastPresenceUpdate(socket.userId, 'online', cleanToken);
        
        // Emit user status change for cache tracking
        socket.broadcast.emit('user_status_change', {
          userId: socket.userId,
          status: 'online',
          timestamp: Date.now()
        });
        
        // Send authentication success
        socket.emit('authenticated', {
          success: true,
          userId: socket.userId,
          userEmail: socket.userEmail,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
          message: 'Socket authenticated successfully'
        });
        
        console.log(`✅ Socket authenticated for user ${socket.userId} (${socket.userEmail}) - Socket ID: ${socket.id}`);
        
      } catch (error) {
        console.error('Authentication failed:', error);
        socket.emit('authentication_error', {
          success: false,
          message: error.message || 'Authentication failed'
        });
      }
    });

    // Chat message handlers
    socket.on('send_message', async (data) => {
      await this.handleSendMessage(socket, data);
    });

    socket.on('join_chat', async (data) => {
      await this.handleJoinChat(socket, data);
    });

    socket.on('leave_chat', async (data) => {
      await this.handleLeaveChat(socket, data);
    });

    socket.on('typing_start', (data) => {
      this.handleTypingStart(socket, data);
    });

    socket.on('typing_stop', (data) => {
      this.handleTypingStop(socket, data);
    });

    socket.on('message_read', async (data) => {
      await this.handleMessageRead(socket, data);
    });

    // Voice call handlers
    socket.on('call_offer', async (data) => {
      await this.handleCallOffer(socket, data);
    });

    socket.on('call_answer', async (data) => {
      await this.handleCallAnswer(socket, data);
    });

    socket.on('call_ice_candidate', (data) => {
      this.handleIceCandidate(socket, data);
    });

    socket.on('call_reject', async (data) => {
      await this.handleCallReject(socket, data);
    });

    socket.on('call_end', async (data) => {
      await this.handleCallEnd(socket, data);
    });

    // Group call handlers
    socket.on('join_group_call', async (data) => {
      await this.handleJoinGroupCall(socket, data);
    });

    socket.on('leave_group_call', async (data) => {
      await this.handleLeaveGroupCall(socket, data);
    });

    // Room verification handlers
    socket.on('join_user_room', (data) => {
      const { userId } = data;
      if (userId === socket.userId) {
        socket.join(`user_${userId}`);
        console.log(`📞 User ${userId} explicitly joined their room`);
        socket.emit('room_joined', { room: `user_${userId}` });
      }
    });

    socket.on('verify_room_membership', (data) => {
      const { userId } = data;
      const userRoom = `user_${userId}`;
      const isInRoom = socket.rooms.has(userRoom);
      const roomSize = this.io.sockets.adapter.rooms.get(userRoom)?.size || 0;
      
      console.log(`📞 Room verification for ${userRoom}: inRoom=${isInRoom}, size=${roomSize}`);
      
      socket.emit('room_verification_result', {
        room: userRoom,
        isInRoom,
        roomSize,
        socketRooms: Array.from(socket.rooms)
      });
      
      // Rejoin if not in room
      if (!isInRoom && userId === socket.userId) {
        socket.join(userRoom);
        console.log(`📞 Rejoined user to room: ${userRoom}`);
      }
    });

    // Group messaging handlers
    socket.on('join_group_room', async (data) => {
      await this.handleJoinGroupRoom(socket, data);
    });

    socket.on('leave_group_room', async (data) => {
      await this.handleLeaveGroupRoom(socket, data);
    });

    socket.on('group_message', async (data) => {
      await this.handleGroupMessage(socket, data);
    });

    socket.on('group_typing_start', (data) => {
      this.handleGroupTypingStart(socket, data);
    });

    socket.on('group_typing_stop', (data) => {
      this.handleGroupTypingStop(socket, data);
    });

    // Status/Story handlers
    socket.on('view_status', async (data) => {
      await this.handleViewStatus(socket, data);
    });

    socket.on('like_status', async (data) => {
      await this.handleLikeStatus(socket, data);
    });

    // Heartbeat/Ping handlers for connection health
    socket.on('ping', () => {
      socket.emit('pong', {
        timestamp: Date.now(),
        userId: socket.userId
      });
    });

    socket.on('connection_check', () => {
      socket.emit('connection_status', {
        connected: true,
        userId: socket.userId,
        socketId: socket.id,
        timestamp: Date.now()
      });
    });

    // Disconnect handler
    socket.on('disconnect', async () => {
      await this.handleDisconnect(socket);
    });
  }

  async handleSendMessage(socket, data) {
    try {
      const { chatId, threadId, message, messageType, mediaUrl, replyTo, recipients } = data;
      
      // Use threadId if available, fallback to chatId
      const targetChatId = threadId || chatId;
      
      // Prepare message data with raw content and direct URLs
      const messageData = {
        chatId: targetChatId,
        threadId: targetChatId,
        senderId: socket.userId,
        message: message, // Always use raw message content
        messageType: messageType || 'text',
        mediaUrl: mediaUrl, // Use direct URL for media
        replyTo,
        recipients,
        token: socket.token,
        userToken: socket.token
      };

      // Save message using enhanced service (BuddyBoss first, WordPress fallback)
      const savedMessage = await chatService.sendMessage(messageData);

      // Ensure we return raw content and direct URLs
      const responseMessage = {
        ...savedMessage,
        message: savedMessage.message?.raw || savedMessage.message, // Use raw content
        media_url: savedMessage.media_url || savedMessage.direct_url, // Use direct URL
        chatId: targetChatId,
        timestamp: new Date()
      };

      // Get chat participants
      const participants = await chatService.getChatParticipants(targetChatId, socket.token);
      
      // Emit to all participants with raw content (for cache service integration)
      participants.forEach(participantId => {
        this.io.to(`user_${participantId}`).emit('message_received', {
          chatId: targetChatId,
          message: responseMessage,
          userId: participantId
        });
        
        // Emit chat list update to refresh chat list order and last message
        this.io.to(`user_${participantId}`).emit('chat_list_update', {
          userId: participantId,
          action: 'new_message',
          chatData: {
            chatId: targetChatId,
            lastMessage: responseMessage,
            timestamp: responseMessage.timestamp
          }
        });
      });

      // Send delivery confirmation to sender (for cache service integration)
      socket.emit('message_sent', {
        tempId: data.tempId,
        messageId: savedMessage.id,
        timestamp: savedMessage.timestamp,
        chatId: targetChatId,
        message: responseMessage,
        userId: socket.userId
      });

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message_error', { 
        tempId: data.tempId,
        error: 'Failed to send message' 
      });
    }
  }

  async handleJoinChat(socket, data) {
    try {
      const { chatId, threadId } = data;
      const targetChatId = threadId || chatId;
      
      // Verify user has access to chat
      const hasAccess = await chatService.verifyUserAccess(socket.userId, targetChatId, socket.token);
      if (!hasAccess) {
        socket.emit('chat_error', { message: 'Access denied' });
        return;
      }

      // Join socket room
      socket.join(`chat_${targetChatId}`);
      
      // Mark messages as delivered
      await chatService.markMessagesDelivered(targetChatId, socket.userId, socket.token);
      
      socket.emit('chat_joined', { chatId: targetChatId });
    } catch (error) {
      console.error('Error joining chat:', error);
      socket.emit('chat_error', { message: 'Failed to join chat' });
    }
  }

  async handleLeaveChat(socket, data) {
    const { chatId, threadId } = data;
    const targetChatId = threadId || chatId;
    socket.leave(`chat_${targetChatId}`);
    socket.emit('chat_left', { chatId: targetChatId });
  }

  handleTypingStart(socket, data) {
    const { chatId, threadId } = data;
    const targetChatId = threadId || chatId;
    socket.to(`chat_${targetChatId}`).emit('user_typing', {
      userId: socket.userId,
      chatId: targetChatId,
      isTyping: true
    });
    
    // Emit typing update for cache tracking
    socket.emit('typing_update', {
      userId: socket.userId,
      chatId: targetChatId,
      isTyping: true,
      timestamp: Date.now()
    });
  }

  handleTypingStop(socket, data) {
    const { chatId, threadId } = data;
    const targetChatId = threadId || chatId;
    socket.to(`chat_${targetChatId}`).emit('user_stopped_typing', {
      userId: socket.userId,
      chatId: targetChatId,
      isTyping: false
    });
    
    // Emit typing update for cache tracking
    socket.emit('typing_update', {
      userId: socket.userId,
      chatId: targetChatId,
      isTyping: false,
      timestamp: Date.now()
    });
  }

  async handleMessageRead(socket, data) {
    try {
      const { messageId, chatId, threadId } = data;
      const targetChatId = threadId || chatId;
      
      console.log(`Server: Handling message read - messageId: ${messageId}, chatId: ${chatId}, threadId: ${threadId}`);
      
      // Validate that we have a valid ID to work with
      if (!messageId && !targetChatId) {
        console.warn('Warning: No valid message ID or chat ID provided for mark read operation');
        return;
      }
      
      let result;
      
      // If we have a specific messageId, mark that message as read
      if (messageId && typeof messageId === 'string' && messageId !== 'undefined') {
        console.log(`Server: Marking specific message ${messageId} as read for user ${socket.userId}`);
        result = await chatService.markMessageRead(messageId, socket.userId, socket.token);
      }
      // If we have a threadId/chatId but no specific messageId, mark the entire thread as read
      else if (targetChatId && typeof targetChatId === 'string' && targetChatId !== 'undefined') {
        console.log(`Server: Marking thread ${targetChatId} as read for user ${socket.userId}`);
        result = await chatService.markThreadRead(targetChatId, socket.userId, socket.token);
      } else {
        console.warn('Warning: Invalid message ID and chat ID provided for mark read operation');
        return;
      }
      
      // Notify other participants in the chat
      socket.to(`chat_${targetChatId}`).emit('message_read', {
        messageId: messageId || null,
        chatId: targetChatId,
        readBy: socket.userId,
        readAt: new Date(),
        success: result?.success || true
      });
      
      // Confirm to sender
      socket.emit('message_read_confirmed', {
        messageId: messageId || null,
        chatId: targetChatId,
        success: result?.success || true,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Error handling message read:', error);
      socket.emit('message_read_error', {
        messageId: data.messageId,
        chatId: data.chatId || data.threadId,
        error: error.message
      });
    }
  }

  async handleCallOffer(socket, data) {
    try {
      const { targetUserId, offer, callType, chatId, roomName } = data;
      
      // Ensure consistent data types - convert to numbers
      const callerId = parseInt(socket.userId);
      const calleeId = parseInt(targetUserId);
      
      console.log('📞 Handling call offer:', {
        caller: callerId,
        target: calleeId,
        callType,
        roomName
      });
      
      // Create call record via CallService
      const call = await callService.initiateCall({
        callerId: callerId,
        calleeId: calleeId,
        roomName: roomName || `call_${Date.now()}`,
        isVideo: callType === 'video'
      }, socket.token);

      if (call.success) {
        const callData = call.data.data;
        
        // Get caller's profile information
        let callerProfile = null;
        try {
          const cleanToken = socket.token?.replace('Bearer ', '');
          console.log('📞 Fetching user profile for caller ID:', callerId);
          const userResponse = await wordPressService.getUserById(callerId, cleanToken);
          console.log('📞 WordPress user response:', userResponse);
          
          // Handle the WordPress API response correctly
          if (userResponse && userResponse.id) {
            callerProfile = {
              id: callerId,
              name: userResponse.name || userResponse.display_name || userResponse.username || 'Unknown User',
              avatar: userResponse.avatar_urls?.['96'] || userResponse.avatar_urls?.['48'] || userResponse.avatar || userResponse.gravatar || null,
              username: userResponse.username || userResponse.slug || null,
              email: userResponse.email || null
            };
            console.log('📞 Caller profile created:', callerProfile);
          } else {
            console.warn('⚠️ Invalid user response structure:', userResponse);
          }
        } catch (error) {
          console.warn('⚠️ Failed to get caller profile:', error.message);
          console.warn('⚠️ Error details:', error);
        }
        
        // Store in active calls with consistent data types
        this.activeCalls.set(callData.call_id, {
          callId: callData.call_id,
          caller: callerId,
          target: calleeId,
          callType,
          status: 'ringing',
          roomName: callData.room_name,
          createdAt: new Date()
        });

        console.log('📞 Call initiated successfully:', callData.call_id);

        // Send incoming call notification to target user with complete caller info
        const callPayload = {
          callId: callData.call_id,
          caller: callerProfile || {
            id: callerId,
            name: socket.userName || socket.user?.name || `User ${callerId}`,
            avatar: socket.user?.avatar || null,
            username: socket.user?.username || null
          },
          callType,
          offer,
          chatId,
          roomName: callData.room_name
        };
        
        console.log('📞 Sending incoming_call payload:', JSON.stringify(callPayload, null, 2));
        this.io.to(`user_${calleeId}`).emit('incoming_call', callPayload);

        // Notify caller that the callee's device is now ringing
        socket.emit('call_ringing', { 
          callId: callData.call_id,
          status: 'ringing'
        });

        // Confirm to caller
        socket.emit('call_initiated', { 
          callId: callData.call_id,
          roomName: callData.room_name,
          status: 'ringing'
        });

        // Set timeout for call expiry (30 seconds)
        setTimeout(() => {
          this.handleCallTimeout(callData.call_id);
        }, 30000);
        
      } else {
        throw new Error('Failed to initiate call via API');
      }
    } catch (error) {
      console.error('❌ Error handling call offer:', error);
      socket.emit('call_error', { 
        message: 'Failed to initiate call',
        error: error.message 
      });
    }
  }

  async handleCallTimeout(callId) {
    try {
      const call = this.activeCalls.get(callId);
      if (call && call.status === 'ringing') {
        console.log('📞 Call timeout:', callId);
        
        // Get token from the caller's connection for authentication
        const callerConnection = this.connectedUsers.get(call.caller);
        const authToken = callerConnection?.token;
        
        if (authToken) {
          // Update call status to missed (skip if API endpoint doesn't exist)
          try {
            await callService.updateCallStatus(callId, 'missed', authToken);
            console.log('📞 Database status updated successfully');
          } catch (dbError) {
            console.warn('⚠️ Database update skipped (API endpoint may not exist):', dbError.message);
          }
        } else {
          console.warn('⚠️ No auth token available for call timeout update');
        }
        
        // Notify both users
        this.io.to(`user_${call.caller}`).emit('call_timeout', { callId });
        this.io.to(`user_${call.target}`).emit('call_missed', { callId });
        
        // Remove from active calls
        this.activeCalls.delete(callId);
      }
    } catch (error) {
      console.error('❌ Error handling call timeout:', error);
    }
  }

  async handleCallAnswer(socket, data) {
    try {
      const { callId, answer } = data;
      
      const call = this.activeCalls.get(callId);
      if (!call) {
        console.error('❌ Call not found for callId:', callId);
        socket.emit('call_error', { message: 'Call not found' });
        return;
      }

      console.log('📞 Call answered:', callId);
      console.log('📞 Call details:', { caller: call.caller, target: call.target, callId });
      console.log('📞 Socket user ID:', socket.userId);
      
      // Verify the answering user is the target (handle both string and number types)
      const socketUserId = parseInt(socket.userId);
      const targetUserId = parseInt(call.target);
      
      console.log('📞 Comparing user IDs:', { 
        socketUserId, 
        targetUserId, 
        socketUserIdType: typeof socket.userId,
        callTargetType: typeof call.target,
        match: socketUserId === targetUserId
      });
      
      if (socketUserId !== targetUserId) {
        console.error('❌ User not authorized to answer this call');
        socket.emit('call_error', { message: 'Not authorized' });
        return;
      }

      // Update call status
      call.status = 'connected';
      call.answeredAt = new Date();
      
      // Get caller's socket info
      const callerRoom = `user_${call.caller}`;
      console.log('📞 Emitting call_answered to caller room:', callerRoom);
      console.log('📞 Active rooms in server:', Array.from(this.io.sockets.adapter.rooms.keys()));
      console.log('📞 Sockets in caller room:', this.io.sockets.adapter.rooms.get(callerRoom)?.size || 0);
      
      // Send answer to caller with detailed logging
      this.io.to(callerRoom).emit('call_answered', {
        callId,
        answer,
        timestamp: new Date().toISOString()
      });
      
      // Also emit to all connected sockets for debugging
      console.log('📞 Broadcasting call_answered to all sockets as fallback');
      this.io.emit('debug_call_answered', {
        callId,
        answer,
        targetCaller: call.caller,
        from: 'server'
      });

      // Update call status in database (skip if API endpoint doesn't exist)
      try {
        await callService.updateCallStatus(callId, 'answered', socket.token);
        console.log('📞 Database status updated successfully');
      } catch (dbError) {
        console.warn('⚠️ Database update skipped (API endpoint may not exist):', dbError.message);
        // Continue anyway - socket communication is more important than database logging
      }

      // Notify both parties that call is connected with delay to ensure proper order
      setTimeout(() => {
        console.log('📞 Emitting call_connected to both parties');
        this.io.to(`user_${call.caller}`).emit('call_connected', { 
          callId,
          connectedAt: new Date().toISOString() 
        });
        this.io.to(`user_${call.target}`).emit('call_connected', { 
          callId,
          connectedAt: new Date().toISOString() 
        });
      }, 100);

      console.log('📞 Call answered successfully:', callId);
    } catch (error) {
      console.error('❌ Error handling call answer:', error);
      socket.emit('call_error', { 
        message: 'Failed to answer call',
        error: error.message,
        callId: data.callId
      });
    }
  }

  handleIceCandidate(socket, data) {
    const { callId, candidate, targetUserId } = data;
    
    // Forward ICE candidate to target user
    this.io.to(`user_${targetUserId}`).emit('ice_candidate', {
      callId,
      candidate
    });
  }

  async handleCallReject(socket, data) {
    try {
      const { callId } = data;
      
      const call = this.activeCalls.get(callId);
      if (!call) {
        console.error('❌ Call not found for rejection:', callId);
        socket.emit('call_error', { message: 'Call not found' });
        return;
      }
      
      console.log('📞 Call rejected:', callId);
      console.log('📞 Notifying caller:', call.caller);
      
      // Notify caller about rejection
      this.io.to(`user_${call.caller}`).emit('call_rejected', { 
        callId,
        rejectedAt: new Date().toISOString()
      });
      
      // Also broadcast as fallback
      this.io.emit('debug_call_rejected', {
        callId,
        targetCaller: call.caller,
        from: 'server'
      });
      
      // Update call status (skip if API endpoint doesn't exist)
      try {
        await callService.updateCallStatus(callId, 'rejected', socket.token);
        console.log('📞 Database status updated successfully');
      } catch (dbError) {
        console.warn('⚠️ Database update skipped (API endpoint may not exist):', dbError.message);
      }
      
      // Remove from active calls
      this.activeCalls.delete(callId);
      console.log('📞 Call rejection handled successfully');
    } catch (error) {
      console.error('❌ Error handling call rejection:', error);
      socket.emit('call_error', { 
        message: 'Failed to reject call',
        error: error.message 
      });
    }
  }

  async handleCallEnd(socket, data) {
    try {
      const { callId } = data;
      
      const call = this.activeCalls.get(callId);
      if (!call) {
        console.error('❌ Call not found for ending:', callId);
        socket.emit('call_error', { message: 'Call not found' });
        return;
      }
      
      console.log('📞 Call ended:', callId);
      console.log('📞 Call participants:', { caller: call.caller, target: call.target });
      console.log('📞 Ending user:', socket.userId);
      
      // Determine the other participant (handle data type consistency)
      const socketUserId = parseInt(socket.userId);
      const callerId = parseInt(call.caller);
      const targetId = parseInt(call.target);
      
      const otherUserId = callerId === socketUserId ? targetId : callerId;
      console.log('📞 Notifying other participant:', otherUserId);
      
      // Notify other participant
      this.io.to(`user_${otherUserId}`).emit('call_ended', { 
        callId,
        endedBy: socket.userId,
        endedAt: new Date().toISOString()
      });
      
      // Also broadcast as fallback
      this.io.emit('debug_call_ended', {
        callId,
        targetUser: otherUserId,
        endedBy: socket.userId,
        from: 'server'
      });
      
      // Update call status (skip if API endpoint doesn't exist)
      try {
        await callService.updateCallStatus(callId, 'ended', socket.token);
        console.log('📞 Database status updated successfully');
      } catch (dbError) {
        console.warn('⚠️ Database update skipped (API endpoint may not exist):', dbError.message);
      }
      
      // Remove from active calls
      this.activeCalls.delete(callId);
      console.log('📞 Call end handled successfully');
    } catch (error) {
      console.error('❌ Error handling call end:', error);
      socket.emit('call_error', { 
        message: 'Failed to end call',
        error: error.message 
      });
    }
  }

  async handleJoinGroupCall(socket, data) {
    try {
      const { callId, offer } = data;
      
      // Join group call room
      socket.join(`group_call_${callId}`);
      
      // Notify other participants
      socket.to(`group_call_${callId}`).emit('participant_joined', {
        userId: socket.userId,
        offer
      });
      
      socket.emit('group_call_joined', { callId });
    } catch (error) {
      console.error('Error joining group call:', error);
    }
  }

  async handleLeaveGroupCall(socket, data) {
    try {
      const { callId } = data;
      
      // Leave group call room
      socket.leave(`group_call_${callId}`);
      
      // Notify other participants
      socket.to(`group_call_${callId}`).emit('participant_left', {
        userId: socket.userId
      });
    } catch (error) {
      console.error('Error leaving group call:', error);
    }
  }

  async handleJoinGroupRoom(socket, data) {
    try {
      const { groupId, userId } = data;
      
      // Verify group membership via BuddyBoss API
      // For now, just join the room - membership check can be added later
      socket.join(`group_${groupId}`);
      
      console.log(`📱 Socket: User ${userId} joined group room ${groupId}`);
      
      // Notify other group members that user joined
      socket.to(`group_${groupId}`).emit('user_joined_group', {
        groupId,
        userId,
        joinedAt: new Date().toISOString()
      });
      
      // Confirm to the user they joined
      socket.emit('group_room_joined', {
        groupId,
        success: true
      });
    } catch (error) {
      console.error('❌ Socket: Error joining group room:', error);
      socket.emit('group_room_error', {
        groupId: data.groupId,
        error: 'Failed to join group room'
      });
    }
  }

  async handleLeaveGroupRoom(socket, data) {
    try {
      const { groupId, userId } = data;
      
      // Leave group room
      socket.leave(`group_${groupId}`);
      
      console.log(`📱 Socket: User ${userId} left group room ${groupId}`);
      
      // Notify other group members
      socket.to(`group_${groupId}`).emit('user_left_group', {
        groupId,
        userId,
        leftAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Socket: Error leaving group room:', error);
    }
  }

  async handleGroupMessage(socket, data) {
    try {
      const { groupId, message, senderId, messageData } = data;
      
      console.log(`📤 Socket: Broadcasting group message to group ${groupId} from user ${senderId}`);
      
      // Broadcast to all group members except sender
      socket.to(`group_${groupId}`).emit('group_message_received', {
        groupId,
        message: messageData || message,
        senderId,
        timestamp: new Date().toISOString(),
        messageId: messageData?.id || null
      });
      
      // Confirm to sender that message was broadcasted
      socket.emit('group_message_sent', {
        groupId,
        messageId: messageData?.id || null,
        success: true
      });
    } catch (error) {
      console.error('❌ Socket: Error handling group message:', error);
      socket.emit('group_message_error', {
        groupId: data.groupId,
        error: 'Failed to send group message'
      });
    }
  }

  handleGroupTypingStart(socket, data) {
    try {
      const { groupId, userId, userName } = data;
      
      console.log(`⌨️ Socket: User ${userName} started typing in group ${groupId}`);
      
      // Broadcast typing indicator to other group members
      socket.to(`group_${groupId}`).emit('group_typing', {
        groupId,
        userId,
        userName,
        isTyping: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Socket: Error handling group typing start:', error);
    }
  }

  handleGroupTypingStop(socket, data) {
    try {
      const { groupId, userId, userName } = data;
      
      console.log(`⌨️ Socket: User ${userName} stopped typing in group ${groupId}`);
      
      // Broadcast typing stop to other group members
      socket.to(`group_${groupId}`).emit('group_typing', {
        groupId,
        userId,
        userName,
        isTyping: false,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Socket: Error handling group typing stop:', error);
    }
  }

  async handleViewStatus(socket, data) {
    try {
      const { statusId, authorId } = data;
      
      // Record status view
      await chatService.recordStatusView(statusId, socket.userId, socket.token);
      
      // Notify status author
      this.io.to(`user_${authorId}`).emit('status_viewed', {
        statusId,
        viewerId: socket.userId,
        viewedAt: new Date()
      });
    } catch (error) {
      console.error('Error handling status view:', error);
    }
  }

  async handleLikeStatus(socket, data) {
    try {
      const { statusId, authorId } = data;
      
      // Record status like
      await chatService.recordStatusLike(statusId, socket.userId, socket.token);
      
      // Notify status author
      this.io.to(`user_${authorId}`).emit('status_liked', {
        statusId,
        likerId: socket.userId,
        likedAt: new Date()
      });
    } catch (error) {
      console.error('Error handling status like:', error);
    }
  }

  async handleDisconnect(socket) {
    if (socket.userId) {
      // Get user token for presence update
      const userConnection = this.connectedUsers.get(socket.userId);
      const token = userConnection?.token || socket.token;
      
      // Remove from connected users
      this.connectedUsers.delete(socket.userId);
      
      // Update presence to offline with token
      await presenceService.setUserOffline(socket.userId, token);
      
      // Notify friends about offline status
      this.broadcastPresenceUpdate(socket.userId, 'offline', token);
      
      // Emit user status change for cache tracking
      socket.broadcast.emit('user_status_change', {
        userId: socket.userId,
        status: 'offline',
        timestamp: Date.now()
      });
      
      // End any active calls (handle data type consistency)
      const socketUserId = parseInt(socket.userId);
      for (const [callId, call] of this.activeCalls.entries()) {
        const callerId = parseInt(call.caller);
        const targetId = parseInt(call.target);
        
        if (callerId === socketUserId || targetId === socketUserId) {
          const otherUserId = callerId === socketUserId ? targetId : callerId;
          this.io.to(`user_${otherUserId}`).emit('call_ended', { callId });
          
          // Update call status (skip if API endpoint doesn't exist)
          try {
            await callService.updateCallStatus(callId, 'ended', token);
            console.log('📞 Database status updated successfully');
          } catch (dbError) {
            console.warn('⚠️ Database update skipped (API endpoint may not exist):', dbError.message);
          }
          
          this.activeCalls.delete(callId);
        }
      }
      
      console.log(`User ${socket.userId} disconnected`);
    }
  }

  async broadcastPresenceUpdate(userId, status, userToken) {
    try {
      // Get user's friends/contacts
      const friendsResult = await chatService.getUserFriends(userId, userToken);
      
      if (friendsResult.success && friendsResult.data) {
        // Handle different response formats from BuddyBoss API
        let friends = [];
        
        if (Array.isArray(friendsResult.data)) {
          friends = friendsResult.data;
        } else if (friendsResult.data.friends && Array.isArray(friendsResult.data.friends)) {
          friends = friendsResult.data.friends;
        } else if (typeof friendsResult.data === 'object' && friendsResult.data.length !== undefined) {
          // Handle object with numeric keys
          friends = Object.values(friendsResult.data);
        }
        
        // Notify each friend about presence change
        friends.forEach(friend => {
          const friendId = friend.id || friend.user_id || friend.ID;
          if (friendId) {
            this.io.to(`user_${friendId}`).emit('presence_update', {
              userId,
              status,
              lastSeen: new Date()
            });
          }
        });
      }
    } catch (error) {
      console.error('Error broadcasting presence update:', error);
    }
  }
}

module.exports = ChatHandler;
