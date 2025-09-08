/**
 * Simple Call Socket Handler - Clean WebSocket events for calling
 * No WordPress, no database - just pure signaling
 */

const simpleCallHandlers = (io) => {
  // Track active calls
  const activeCalls = new Map();
  
  // Helper to get user's socket room
  const getUserRoom = (userId) => `user_${userId}`;
  
  // Helper to log call events
  const logCall = (event, data) => {
    console.log(`📞 [${new Date().toISOString()}] ${event}:`, data);
  };

  return {
    // Handle call offer (initiate call)
    handleCallOffer: (socket, data) => {
      try {
        console.log('📞 [DEBUG] CALL_OFFER received from socket:', socket.id, 'data:', data);
        console.log('📞 [DEBUG] Socket userId:', socket.userId);
        
        const { callId, targetUserId, isVideo, offer, caller } = data;
        const callerId = socket.userId || data.callerId || socket.id; // Fallback for testing
        
        logCall('CALL_OFFER', { callId, callerId, targetUserId, isVideo });
        
        // For testing: if no userId, try to infer from data
        if (!socket.userId && data.callerId) {
          socket.userId = data.callerId;
        }
        
        // Store call info
        activeCalls.set(callId, {
          id: callId,
          caller: callerId,
          target: targetUserId,
          isVideo,
          status: 'ringing',
          startTime: Date.now()
        });
        
        // Send incoming call to target
        const targetRoom = getUserRoom(targetUserId);
        console.log('📞 [DEBUG] Sending call to room:', targetRoom);
        
        // Get room info for debugging
        const roomSockets = io.sockets.adapter.rooms.get(targetRoom);
        console.log('📞 [DEBUG] Room', targetRoom, 'has sockets:', roomSockets ? Array.from(roomSockets) : 'none');
        
        io.to(targetRoom).emit('simple_call_incoming', {
          callId,
          caller: caller || {
            id: callerId,
            name: socket.userName || `User ${callerId}`
          },
          isVideo,
          offer
        });
        
        console.log('📞 [DEBUG] simple_call_incoming event emitted to room:', targetRoom);
        
        // Confirm call initiated to caller
        socket.emit('simple_call_initiated', { callId });
        
      } catch (error) {
        console.error('Error handling call offer:', error);
        socket.emit('simple_call_error', { error: 'Failed to initiate call' });
      }
    },

    // Handle call answer
    handleCallAnswer: (socket, data) => {
      try {
        const { callId, answer } = data;
        const userId = socket.userId || socket.id; // Fallback for testing
        
        logCall('CALL_ANSWER', { callId, userId });
        
        const call = activeCalls.get(callId);
        if (!call) {
          socket.emit('simple_call_error', { error: 'Call not found' });
          return;
        }
        
        // Update call status
        call.status = 'connected';
        call.connectTime = Date.now();
        activeCalls.set(callId, call);
        
        // Send answer to caller
        io.to(getUserRoom(call.caller)).emit('simple_call_answered', {
          callId,
          answer
        });
        
        // Confirm to answerer
        socket.emit('simple_call_connected', { callId });
        
      } catch (error) {
        console.error('Error handling call answer:', error);
        socket.emit('simple_call_error', { error: 'Failed to answer call' });
      }
    },

    // Handle call reject
    handleCallReject: (socket, data) => {
      try {
        const { callId } = data;
        const userId = socket.userId || socket.id; // Fallback for testing
        
        logCall('CALL_REJECT', { callId, userId });
        
        const call = activeCalls.get(callId);
        if (!call) {
          socket.emit('simple_call_error', { error: 'Call not found' });
          return;
        }
        
        // Send rejection to caller
        io.to(getUserRoom(call.caller)).emit('simple_call_rejected', {
          callId,
          reason: 'rejected'
        });
        
        // Remove call
        activeCalls.delete(callId);
        
        // Confirm to rejecter
        socket.emit('simple_call_ended', { callId });
        
      } catch (error) {
        console.error('Error handling call reject:', error);
        socket.emit('simple_call_error', { error: 'Failed to reject call' });
      }
    },

    // Handle call end
    handleCallEnd: (socket, data) => {
      try {
        const { callId } = data;
        const userId = socket.userId || socket.id; // Fallback for testing
        
        logCall('CALL_END', { callId, userId });
        
        const call = activeCalls.get(callId);
        if (!call) {
          socket.emit('simple_call_error', { error: 'Call not found' });
          return;
        }
        
        // Calculate call duration
        const duration = call.connectTime ? 
          Math.round((Date.now() - call.connectTime) / 1000) : 0;
        
        logCall('CALL_DURATION', { callId, duration: `${duration}s` });
        
        // Notify both parties
        const participants = [call.caller, call.target];
        participants.forEach(participantId => {
          io.to(getUserRoom(participantId)).emit('simple_call_ended', {
            callId,
            duration,
            endedBy: userId
          });
        });
        
        // Remove call
        activeCalls.delete(callId);
        
      } catch (error) {
        console.error('Error handling call end:', error);
        socket.emit('simple_call_error', { error: 'Failed to end call' });
      }
    },

    // Handle ICE candidate exchange
    handleIceCandidate: (socket, data) => {
      try {
        const { callId, candidate } = data;
        const userId = socket.userId || socket.id; // Fallback for testing
        
        const call = activeCalls.get(callId);
        if (!call) {
          return; // Silently ignore unknown calls
        }
        
        // Forward ICE candidate to the other party
        const otherParty = userId === call.caller ? call.target : call.caller;
        io.to(getUserRoom(otherParty)).emit('simple_ice_candidate', {
          callId,
          candidate
        });
        
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
      }
    },

    // Get active calls (for debugging)
    getActiveCalls: () => {
      return Array.from(activeCalls.values());
    },

    // Clean up calls for disconnected user
    cleanupUserCalls: (userId) => {
      const userCalls = Array.from(activeCalls.entries())
        .filter(([_, call]) => call.caller === userId || call.target === userId);
      
      userCalls.forEach(([callId, call]) => {
        logCall('CLEANUP_CALL', { callId, disconnectedUser: userId });
        
        // Notify the other party
        const otherParty = userId === call.caller ? call.target : call.caller;
        io.to(getUserRoom(otherParty)).emit('simple_call_ended', {
          callId,
          reason: 'disconnect',
          endedBy: userId
        });
        
        // Remove call
        activeCalls.delete(callId);
      });
    }
  };
};

module.exports = simpleCallHandlers;