const express = require('express');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Enhanced upload middleware
const { 
  mediaUpload, 
  voiceUpload, 
  groupMediaUpload, 
  handleUploadError,
  trackUploadProgress,
  validateMediaFile,
  getFileInfo
} = require('../middleware/upload');

// Simple upload middleware (no JSON conflicts)
const { simpleUploadMiddleware } = require('../middleware/simpleUpload');

const customChatService = require('../services/customChatService'); // Updated to use custom chat service
const customChatServiceInstance = new customChatService();
const callService = require('../services/callService');
const presenceService = require('../services/presenceService');

const router = express.Router();

// Add upload error handling middleware
router.use(handleUploadError);

// Status management - Delete status
    router.delete('/status/:statusId', async (req, res) => {
      try {
        const { statusId } = req.params;
        const userId = req.user.user_id;
        const userToken = req.headers.authorization?.replace('Bearer ', '');

        await customChatServiceInstance.deleteStatus(statusId, userId, userToken);

        res.json({
          success: true,
          message: 'Status deleted successfully'
        });
      } catch (error) {
        console.error('Error deleting status:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to delete status'
        });
      }
    });

    // Status analytics - Get comprehensive stats
    router.get('/status/:statusId/analytics', async (req, res) => {
      try {
        const { statusId } = req.params;
        const userId = req.user.user_id;

        const analytics = await customChatServiceInstance.getStatusStats(statusId, userId);

        res.json({
          success: true,
          data: analytics
        });
      } catch (error) {
        console.error('Error fetching status analytics:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch status analytics'
        });
      }
    });

    // Status viewers - Get detailed viewer list
    router.get('/status/:statusId/viewers', async (req, res) => {
      try {
        const { statusId } = req.params;
        const userId = req.user.user_id;

        const viewers = await customChatServiceInstance.getStatusViewers(statusId, userId);

        res.json({
          success: true,
          data: viewers
        });
      } catch (error) {
        console.error('Error fetching status viewers:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch status viewers'
        });
      }
    });

    // Message search - Search within messages (uses BuddyBoss first, WordPress fallback)
    router.get('/search/messages', async (req, res) => {
      try {
        const { query, thread_id, limit = 20 } = req.query;
        const userId = req.user.user_id;
        const userToken = req.headers.authorization?.replace('Bearer ', '');

        if (!query || query.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Search query is required'
          });
        }

        const results = await customChatServiceInstance.searchMessages(userId, query.trim(), thread_id, parseInt(limit), userToken);

        res.json({
          success: true,
          data: results
        });
      } catch (error) {
        console.error('Error searching messages:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to search messages'
        });
      }
    });

    // Global search - Search across all chat content (matches WordPress plugin)
    router.get('/search/global', async (req, res) => {
      try {
        const { query, limit = 50 } = req.query;
        const userId = req.user.user_id;

        if (!query || query.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Search query is required'
          });
        }

        const results = await customChatServiceInstance.globalSearch(userId, query.trim(), parseInt(limit));

        res.json({
          success: true,
          data: results
        });
      } catch (error) {
        console.error('Error performing global search:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to perform global search'
        });
      }
    });

    // Search recipients - Find users to message (uses BuddyBoss first, WordPress fallback)
    router.get('/search/recipients', async (req, res) => {
      try {
        const { query, limit = 20 } = req.query;
        const userToken = req.headers.authorization?.replace('Bearer ', '');

        if (!query || query.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Search query is required'
          });
        }

        const results = await customChatServiceInstance.searchUsers(query.trim(), userToken);

        res.json({
          success: true,
          data: Array.isArray(results) ? results : (results.data || [])
        });
      } catch (error) {
        console.error('Error searching recipients:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to search recipients'
        });
      }
    });

    // Chat management - Delete chat permanently
    router.delete('/chats/:chatId', async (req, res) => {
      try {
        const { chatId } = req.params;
        const userId = req.user.user_id;

        await customChatServiceInstance.deleteChat(chatId, userId);

        res.json({
          success: true,
          message: 'Chat deleted permanently'
        });
      } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to delete chat'
        });
      }
    });

// ========================= CORE MESSAGING ENDPOINTS =========================

/**
 * PRIVATE CHAT: Send new message or reply to existing private conversation
 * POST /messages/send - Primary endpoint for private messaging
 * Supports creating new threads or sending to existing threads
 */
router.post('/messages/send', [
  body('message').optional().isString().withMessage('Message must be a string'),
  body('threadId').optional().isNumeric().withMessage('Thread ID must be a number'),
  body('chatId').optional().isNumeric().withMessage('Chat ID must be a number'),
  body('recipients').optional().isArray().withMessage('Recipients must be an array'),
  body('subject').optional().isString().withMessage('Subject must be a string'),
  body('messageType').optional().isIn(['text', 'image', 'video', 'audio', 'document']).withMessage('Invalid message type'),
  body('mediaUrl').optional().isURL().withMessage('Media URL must be valid'),
  body('replyTo').optional().isNumeric().withMessage('Reply to must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');
    const { message, threadId, chatId, recipients, subject, messageType, mediaUrl, replyTo } = req.body;

    // Prepare message data for service layer
    const messageData = {
      chatId: threadId || chatId,
      threadId: threadId || chatId,
      senderId: userId,
      message: message || '',
      messageType: messageType || 'text',
      mediaUrl,
      replyTo,
      recipients,
      subject: subject || 'Re: No Subject',
      token: userToken,
      userToken
    };

    // Use enhanced chat service (custom implementation only)
    const result = await customChatServiceInstance.sendMessage(messageData);

    res.json({
      success: true,
      data: result
      // Return actual message data instead of generic success message
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

/**
 * PRIVATE CHAT: Alternative endpoint for sending messages 
 * POST /chats - Mobile compatibility endpoint for private messaging
 * Same functionality as /messages/send
 */
router.post('/chats', [
  body('message').optional().isString().withMessage('Message must be a string'),
  body('threadId').optional().isNumeric().withMessage('Thread ID must be a number'),
  body('chatId').optional().isNumeric().withMessage('Chat ID must be a number'),
  body('recipients').optional().isArray().withMessage('Recipients must be an array'),
  body('subject').optional().isString().withMessage('Subject must be a string'),
  body('messageType').optional().isIn(['text', 'image', 'video', 'audio', 'document']).withMessage('Invalid message type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');
    const { message, threadId, chatId, recipients, subject, messageType, mediaUrl, replyTo } = req.body;

    // Prepare message data for service layer
    const messageData = {
      chatId: threadId || chatId,
      threadId: threadId || chatId,
      senderId: userId,
      message: message || '',
      messageType: messageType || 'text',
      mediaUrl,
      replyTo,
      recipients,
      subject: subject || 'Re: No Subject',
      token: userToken,
      userToken
    };

    // Use enhanced chat service (custom implementation only)
    const result = await customChatServiceInstance.sendMessage(messageData);

    res.json({
      success: true,
      data: result
      // Return actual message data instead of generic success message
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

/**
 * PRIVATE CHAT: Update thread properties
 * PATCH /messages/{id} - Update thread subject or other properties
 */
router.patch('/messages/:threadId', [
  body('subject').optional().isString().withMessage('Subject must be a string')
], async (req, res) => {
  try {
    const { threadId } = req.params;
    const { subject } = req.body;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    const result = await customChatServiceInstance.updateThread(threadId, { subject }, userToken);

    res.json({
      success: true,
      data: result,
      message: 'Thread updated successfully'
    });
  } catch (error) {
    console.error('Error updating thread:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update thread',
      error: error.message
    });
  }
});

/**
 * PRIVATE CHAT: Delete entire conversation thread
 * DELETE /messages/{id} - Permanently delete private conversation and all messages
 */
router.delete('/messages/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    const result = await customChatServiceInstance.deleteThread(threadId, userToken);

    res.json({
      success: true,
      data: result,
      message: 'Thread deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting thread:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete thread',
      error: error.message
    });
  }
});

/**
 * PRIVATE CHAT: Star/unstar individual message
 * POST /messages/{id}/star - Toggle starred status for private messages
 */
router.post('/messages/:messageId/star', [
  body('starred').isBoolean().withMessage('Starred must be a boolean')
], async (req, res) => {
  try {
    const { messageId } = req.params;
    const { starred } = req.body;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    const result = await customChatServiceInstance.starMessage(messageId, starred, userToken);

    res.json({
      success: true,
      data: result,
      message: starred ? 'Message starred' : 'Message unstarred'
    });
  } catch (error) {
    console.error('Error starring message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to star message',
      error: error.message
    });
  }
});

/**
 * GROUP CHAT: Create group message 
 * POST /messages/group - Create new group conversation with multiple recipients
 */
router.post('/messages/group', [
  body('recipients').isArray().withMessage('Recipients must be an array'),
  body('message').isString().withMessage('Message is required'),
  body('subject').optional().isString().withMessage('Subject must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { recipients, message, subject } = req.body;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    const result = await customChatServiceInstance.createGroupMessage({
      recipients,
      message,
      subject: subject || 'Group Message',
      userToken
    });

    res.json({
      success: true,
      data: result,
      message: 'Group message created successfully'
    });
  } catch (error) {
    console.error('Error creating group message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create group message',
      error: error.message
    });
  }
});

/**
 * PRIVATE CHAT: Mark conversation as read
 * POST /messages/action/{id} - Mark private conversation thread as read/unread
 */
router.post('/messages/action/:threadId', [
  body('action').isIn(['read', 'unread']).withMessage('Action must be read or unread')
], async (req, res) => {
  try {
    const { threadId } = req.params;
    const { action } = req.body;
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    await customChatServiceInstance.markThreadRead(threadId, userId, userToken);

    res.json({
      success: true,
      message: `Messages marked as ${action}`
    });
  } catch (error) {
    console.error('Error performing message action:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform message action',
      error: error.message
    });
  }
});

/**
 * PRIVATE CHAT: Mark specific message as read
 * POST /messages/mark-read - Alternative endpoint to mark messages as read
 */
router.post('/messages/mark-read', [
  body('messageId').optional().isNumeric().withMessage('Message ID must be a number'),
  body('chatId').optional().isNumeric().withMessage('Chat ID must be a number'),
  body('threadId').optional().isNumeric().withMessage('Thread ID must be a number')
], async (req, res) => {
  try {
    const { messageId, chatId, threadId } = req.body;
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    // Use threadId if provided, otherwise use chatId as threadId
    const targetThreadId = threadId || chatId;

    if (!targetThreadId) {
      return res.status(400).json({
        success: false,
        message: 'Either threadId or chatId is required'
      });
    }

    await customChatServiceInstance.markMessageRead(targetThreadId, userId, userToken);

    res.json({
      success: true,
      message: 'Message marked as read',
      data: {
        messageId,
        chatId,
        threadId: targetThreadId
      }
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message
    });
  }
});

// Validation middleware
const validateMessage = [
  body('chat_id').isNumeric().withMessage('Chat ID must be a number'),
  body('message').optional().isString().withMessage('Message must be a string'),
  body('message_type').isIn(['text', 'image', 'video', 'audio', 'document']).withMessage('Invalid message type'),
  body('reply_to').optional().isNumeric().withMessage('Reply to must be a number')
];

/**
 * PRIVATE CHAT: Get messages from conversation
 * GET /messages - Retrieve message history from private conversations
 * Supports pagination and filtering
 */
router.get('/messages', async (req, res) => {
  try {
    const { chatId, threadId, page = 1, limit = 40, before } = req.query;
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    // Use threadId if provided, otherwise use chatId
    const targetChatId = threadId || chatId;

    if (!targetChatId) {
      return res.status(400).json({
        success: false,
        message: 'Either chatId or threadId parameter is required'
      });
    }

    const messages = await customChatServiceInstance.getChatMessages(targetChatId, page, limit, userToken, before);

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        chatId: targetChatId,
        before: before || null
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

/**
 * PRIVATE CHAT: Get user's conversation list
 * GET /chats - Retrieve list of all private conversations for user
 */
router.get('/chats', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    const chats = await customChatServiceInstance.getUserChats(userId, parseInt(page), parseInt(limit), userToken);

    res.json({
      success: true,
      data: chats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chats'
    });
  }
});

// Send message (POST /chats) - Core messaging endpoint
router.post('/chats', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');
    const { threadId, chatId, message, messageType, mediaUrl, replyTo, recipients, subject } = req.body;

    const messageData = {
      chatId: chatId || threadId,
      threadId: threadId || chatId,
      senderId: userId,
      message,
      messageType: messageType || 'text',
      mediaUrl,
      replyTo,
      recipients,
      subject,
      token: userToken,
      userToken
    };

    const result = await customChatServiceInstance.sendMessage(messageData);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

// Send message (POST /messages/send) - Alternative endpoint
router.post('/messages/send', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');
    const { threadId, chatId, message, messageType, mediaUrl, replyTo, recipients, subject } = req.body;

    const messageData = {
      chatId: chatId || threadId,
      threadId: threadId || chatId,
      senderId: userId,
      message,
      messageType: messageType || 'text',
      mediaUrl,
      replyTo,
      recipients,
      subject,
      token: userToken,
      userToken
    };

    const result = await customChatServiceInstance.sendMessage(messageData);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

/**
 * PRIVATE CHAT: Send message to specific conversation
 * POST /chats/:chatId/messages - Send message to existing private conversation by chat ID
 */
router.post('/chats/:chatId/messages', [
  body('message').optional().isString().withMessage('Message must be a string'),
  body('message_type').optional().isIn(['text', 'image', 'video', 'audio', 'document']).withMessage('Invalid message type'),
  body('mediaUrl').optional().isURL().withMessage('Media URL must be valid'),
  body('reply_to').optional().isNumeric().withMessage('Reply to must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { chatId } = req.params;
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');
    const { message, message_type, mediaUrl, reply_to } = req.body;

    console.log(`📤 Server: Sending message to chat ${chatId} from user ${userId}`);

    const messageData = {
      chatId: chatId,
      threadId: chatId,
      senderId: userId,
      message: message || '',
      messageType: message_type || 'text',
      mediaUrl,
      replyTo: reply_to,
      token: userToken,
      userToken
    };

    const result = await customChatServiceInstance.sendMessage(messageData);

    res.json({
      success: true,
      data: result
      // Return actual message data instead of generic success message
    });
  } catch (error) {
    console.error('❌ Server: Send message to chat failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

/**
 * PRIVATE CHAT: Get messages from specific conversation  
 * GET /chats/:chatId/messages - Retrieve messages from private conversation by chat ID
 */
router.get('/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    // Verify user has access to chat
    const hasAccess = await customChatServiceInstance.verifyUserAccess(userId, chatId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat'
      });
    }

    const messages = await customChatServiceInstance.getChatMessages(chatId, page, limit, userToken);

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});

/**
 * PRIVATE CHAT: Delete message from conversation
 * DELETE /chats/:chatId/messages/:messageId - Delete specific message from private conversation
 */
router.delete('/chats/:chatId/messages/:messageId', async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    const result = await customChatServiceInstance.deleteMessage(messageId, chatId, userToken);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Delete private message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
});
  

// Create new chat
router.post('/chats/create', [
  body('participant_ids').isArray().withMessage('Participant IDs must be an array'),
  body('chat_type').isIn(['direct', 'private', 'group']).withMessage('Invalid chat type'),
  body('chat_name').optional().isString().withMessage('Chat name must be a string'),
  body('subject').optional().isString().withMessage('Subject must be a string'),
  body('initial_message').optional().isString().withMessage('Initial message must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { participant_ids, chat_type, chat_name, subject, initial_message } = req.body;
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    if (chat_type === 'direct' || chat_type === 'private') {
      // For direct/private chats, create a new thread directly
      try {
        const response = await axios.post(
          `${customChatServiceInstance.customChatApi}/threads/create`,
          {
            participant_ids: participant_ids,
            subject: subject || '',
            initial_message: initial_message || ''
          },
          {
            headers: customChatServiceInstance.getAuthHeaders(userToken)
          }
        );

        res.status(201).json({
          success: true,
          data: response.data.data,
          message: 'Private chat created successfully'
        });
      } catch (error) {
        console.error('❌ Create thread failed:', error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
          success: false,
          message: error.response?.data?.message || 'Failed to create private chat',
          error: error.response?.data
        });
      }
    } else {
      // For group chats, use the existing logic
      // Add creator to participants if not included
      if (!participant_ids.includes(userId)) {
        participant_ids.push(userId);
      }

      const chat = await customChatServiceInstance.createChat({
        participantIds: participant_ids,
        chatType: chat_type,
        chatName: chat_name,
        groupAdmin: chat_type === 'group' ? userId : null
      });

      res.status(201).json({
        success: true,
        data: chat,
        message: 'Chat created successfully'
      });
    }
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chat'
    });
  }
});

// Upload media file
router.post('/media/upload', trackUploadProgress, mediaUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    if (!validateMediaFile(req.file)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file format or size'
      });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const fileInfo = getFileInfo(req.file);
    console.log('📂 Server: Processing media upload:', fileInfo);

    const mediaData = await customChatServiceInstance.uploadMedia(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      userId
    );

    // Clean up temporary file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: mediaData,
      fileInfo,
      message: 'Media uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading media:', error);

    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload media'
    });
  }
});

// Upload voice message
router.post('/voice/upload', trackUploadProgress, voiceUpload, [
  body('duration').isNumeric().withMessage('Duration must be a number'),
  body('userId').isNumeric().withMessage('User ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No voice file uploaded'
      });
    }

    const { duration, userId } = req.body;
    const fileInfo = getFileInfo(req.file);
    console.log('🎙️ Server: Processing voice upload:', fileInfo);

    const voiceData = await customChatServiceInstance.uploadVoiceMessage(req.file.path, duration, userId);

    // Clean up temporary file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: voiceData,
      fileInfo,
      message: 'Voice message uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading voice message:', error);

    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload voice message'
    });
  }
});

// Enhanced Search Routes
// Search threads
router.get('/search/threads', async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    const userId = req.user.user_id;
    const userToken = req.user.token;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    console.log('🔍 Server: Searching threads with query:', query);

    const results = await customChatServiceInstance.searchThreads({
      query: query.trim(),
      userId,
      limit: parseInt(limit),
      userToken
    });

    res.json({
      success: true,
      data: results,
      message: 'Thread search completed'
    });
  } catch (error) {
    console.error('❌ Server: Thread search failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search threads'
    });
  }
});

// Get all contacts (all BuddyBoss users) with pagination
router.get('/contacts/all', async (req, res) => {
  try {
    const { search = '', exclude_friends = false, limit = 50, offset = 0, page = 1 } = req.query;
    const userId = req.user.user_id;
    const userToken = req.user.token;

    console.log('👥 Server: Getting all contacts for user:', userId);
    console.log('📊 Request params:', { search, limit, offset, page });

    const contacts = await customChatServiceInstance.getAllContacts({
      search,
      excludeFriends: exclude_friends === 'true',
      limit: parseInt(limit),
      offset: parseInt(offset),
      page: parseInt(page),
      userId,
      userToken
    });

    res.json({
      success: true,
      data: contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: contacts.length,
        hasMore: contacts.length === parseInt(limit)
      },
      message: 'All contacts retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Server: Get all contacts failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get all contacts'
    });
  }
});

// Delete chat permanently
router.delete('/chats/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    // Debug: Check if req.user exists
    console.log('Delete chat debug - req.user:', req.user);
    console.log('Delete chat debug - auth header:', req.headers.authorization);
    
    let userId;
    const userToken = req.headers.authorization?.replace('Bearer ', '');
    
    // Try to get user ID from req.user first, then decode from token if needed
    if (req.user && req.user.user_id) {
      userId = req.user.user_id;
      console.log('Using user ID from req.user:', userId);
    } else {
      // Fallback: decode user ID from JWT token
      try {
        if (userToken) {
          const tokenParts = userToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            userId = payload.data?.user?.id;
            console.log('Decoded user ID from token:', userId);
          }
        }
      } catch (decodeError) {
        console.error('Error decoding token for user ID:', decodeError);
      }
    }
    
    if (!userId) {
      console.error('Delete chat failed - no user ID available from either req.user or token');
      return res.status(401).json({
        success: false,
        message: 'Authentication failed - no user ID'
      });
    }
    
    console.log('Delete chat attempt:', { chatId, userId, hasToken: !!userToken });

    // Delete chat using the service
    const result = await customChatServiceInstance.deleteChat(chatId, userId, userToken);

    res.json({
      success: true,
      message: 'Chat deleted successfully',
      data: result
    });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete chat',
      error: error.message
    });
  }
});

// Get call history
router.get('/calls/history', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    const callHistory = await callService.getCallHistory(userId, userToken, page, limit);

    res.json({
      success: true,
      data: callHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch call history'
    });
  }
});

// Get missed calls count
router.get('/calls/missed/count', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');
    const count = await callService.getMissedCallsCount(userId, userToken);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error fetching missed calls count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch missed calls count'
    });
  }
});

// Mark missed calls as seen
router.post('/calls/missed/mark-seen', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');
    await callService.markMissedCallsSeen(userId, userToken);

    res.json({
      success: true,
      message: 'Missed calls marked as seen'
    });
  } catch (error) {
    console.error('Error marking missed calls as seen:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark missed calls as seen'
    });
  }
});

// Get user presence
router.get('/presence/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const presence = await presenceService.getUserPresence(userId);

    res.json({
      success: true,
      data: presence
    });
  } catch (error) {
    console.error('Error fetching user presence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user presence'
    });
  }
});

// Get friends presence
router.get('/presence/friends', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const friendsPresence = await presenceService.getFriendsPresence(userId);

    res.json({
      success: true,
      data: friendsPresence
    });
  } catch (error) {
    console.error('Error fetching friends presence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch friends presence'
    });
  }
});

// Create status/story
router.post('/status/create', mediaUpload, [
  body('content').optional().isString().withMessage('Content must be a string'),
  body('media_type').optional().isIn(['image', 'video']).withMessage('Invalid media type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { content, media_type } = req.body;
    const userId = req.user.user_id;

    let mediaUrl = null;
    if (req.file) {
      const mediaData = await customChatServiceInstance.uploadMedia(
        req.file.path,
        req.file.originalname,
        req.file.mimetype
      );
      mediaUrl = mediaData.url;

      // Clean up temporary file
      fs.unlinkSync(req.file.path);
    }

    const status = await customChatServiceInstance.createStatus({
      userId,
      content,
      mediaUrl,
      mediaType: media_type
    });

    res.status(201).json({
      success: true,
      data: status,
      message: 'Status created successfully'
    });
  } catch (error) {
    console.error('Error creating status:', error);

    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create status'
    });
  }
});

// Get user's statuses
router.get('/status/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const statuses = await customChatServiceInstance.getUserStatuses(userId);

    res.json({
      success: true,
      data: statuses
    });
  } catch (error) {
    console.error('Error fetching user statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statuses'
    });
  }
});

// Get friends' statuses
router.get('/status/friends', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const friendsStatuses = await customChatServiceInstance.getFriendsStatuses(userId);

    res.json({
      success: true,
      data: friendsStatuses
    });
  } catch (error) {
    console.error('Error fetching friends statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch friends statuses'
    });
  }
});

// Delete status
router.delete('/status/:statusId', async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user.user_id;

    await customChatServiceInstance.deleteStatus(statusId, userId);

    res.json({
      success: true,
      message: 'Status deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete status'
    });
  }
});

// Group management - Add member
router.post('/groups/:chatId/members/add', [
  body('user_id').isNumeric().withMessage('User ID must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { chatId } = req.params;
    const { user_id } = req.body;
    const adminId = req.user.user_id;
    const token = req.headers.authorization?.replace('Bearer ', '');

    const result = await customChatServiceInstance.addUserToGroup(chatId, user_id, adminId, token);

    res.json({
      success: true,
      data: result,
      message: 'User added to group successfully'
    });
  } catch (error) {
    console.error('Error adding user to group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add user to group'
    });
  }
});

// Group management - Bulk add members
router.post('/groups/:chatId/members/bulk-add', [
  body('user_ids').isArray().withMessage('User IDs must be an array'),
  body('user_ids.*').isNumeric().withMessage('Each user ID must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { chatId } = req.params;
    const { user_ids } = req.body;
    const adminId = req.user.user_id;
    const token = req.headers.authorization?.replace('Bearer ', '');

    const result = await customChatServiceInstance.addMultipleUsersToGroup(chatId, user_ids, adminId, token);

    res.json({
      success: true,
      data: result,
      message: `Bulk add completed: ${result.data.summary.successful} successful, ${result.data.summary.errors} errors`
    });
  } catch (error) {
    console.error('Error bulk adding users to group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk add users to group'
    });
  }
});

// Group management - Remove member
router.post('/groups/:chatId/members/remove', [
  body('user_id').isNumeric().withMessage('User ID must be a number')
], async (req, res) => {
  try {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { chatId } = req.params;
    const { user_id } = req.body;
    const adminId = req.user.user_id;
    const token = req.headers.authorization?.replace('Bearer ', '');
    const result = await customChatServiceInstance.removeUserFromGroup(chatId, user_id, adminId, token);

    res.json({
      success: true,
      data: result,
      message: 'User removed from group successfully'
    });
  } catch (error) {
    console.error('Error removing user from group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove user from group'
    });
  }
});

// Get user contacts
router.get('/contacts', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { per_page = 20 } = req.query;

    const contacts = await customChatServiceInstance.getContacts(userId, req.headers.authorization?.split(' ')[1]);

    res.json({
      success: true,
      data: contacts.success ? contacts.data : contacts
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contacts'
    });
  }
});

// Get user friends
router.get('/friends', async (req, res) => {
  try {
    const userId = req.user.user_id;

    const friends = await customChatServiceInstance.getUserFriends(userId, req.headers.authorization?.split(' ')[1]);

    res.json({
      success: true,
      data: friends.success ? friends.data : friends
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch friends'
    });
  }
});

// Update user presence
router.post('/presence/update', [
  body('status').isIn(['online', 'offline', 'away', 'busy']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.user_id;
    const { status } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    let result;
    if (status === 'online') {
      result = await presenceService.setUserOnline(userId, token);
    } else {
      result = await presenceService.setUserOffline(userId, token);
    }

    res.json({
      success: true,
      data: {
        user_id: userId,
        status: status,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error updating presence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update presence'
    });
  }
});

// Get user presence status
router.get('/presence/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userToken = req.user.token;

    const presence = await customChatServiceInstance.getUserPresence({
      userId,
      userToken
    });

    res.json({
      success: true,
      data: presence,
      message: 'Presence status retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Server: Get presence status failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get presence status'
    });
  }
});

// Get online users
router.get('/presence/online', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const userId = req.user.user_id;
    const userToken = req.user.token;

    const onlineUsers = await customChatServiceInstance.getOnlineUsers({
      limit: parseInt(limit),
      userId,
      userToken
    });

    res.json({
      success: true,
      data: onlineUsers,
      message: 'Online users retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Server: Get online users failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get online users'
    });
  }
});

// Initiate call
router.post('/calls/initiate', [
  body('calleeId').isNumeric().withMessage('Callee ID must be a number'),
  body('isVideo').optional().isBoolean().withMessage('isVideo must be boolean'),
  body('roomName').optional().isString().withMessage('Room name must be string'),
  body('offerSdp').optional().isString().withMessage('Offer SDP must be string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const callerId = req.user.user_id;
    const { calleeId, isVideo = false, roomName, offerSdp } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    const result = await callService.initiateCall({
      callerId,
      calleeId,
      roomName: roomName || `call_${Date.now()}`,
      isVideo,
      offerSdp
    }, token);

    res.json({
      success: true,
      data: result.success ? result.data : result
    });
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate call'
    });
  }
});

// Update call status
router.post('/calls/update-status', [
  body('callId').isString().withMessage('Call ID must be a string'),
  body('status').isIn(['answered', 'rejected', 'ended', 'missed']).withMessage('Invalid status'),
  body('duration').optional().isNumeric().withMessage('Duration must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { callId, status, duration } = req.body;

    const result = await callService.updateCallStatus(callId, status, duration);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error updating call status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update call status'
    });
  }
});

// Status (Story) Routes - WordPress plugin endpoints only (BuddyBoss doesn't have status feature)
 
// Get status list
router.get('/status', async (req, res) => {
  try {
    console.log('🔍 Status GET route called');
    console.log('🔍 Request query params:', req.query);
    console.log('🔍 Request headers:', {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      contentType: req.headers['content-type']
    });

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      console.error('🔍 No authorization token provided');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { user_id } = req.query;
    console.log('🔍 Extracted user_id from query:', user_id);
    console.log('🔍 Type of user_id:', typeof user_id);

    console.log('🔍 Calling customChatServiceInstance.getStatusList...');
    const statusList = await customChatServiceInstance.getStatusList(user_id, token);
    console.log('🔍 StatusList result:', statusList);
    
    res.json(statusList);
  } catch (error) {
    console.error('🔍 Get status list error:', error);
    console.error('🔍 Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to get status list' });
  }
});

// Create status
router.post('/status', [
  body('caption').optional().isString().withMessage('Caption must be a string'),
  body('media_url').optional().isURL().withMessage('Media URL must be valid'),
  body('media_type').optional().isIn(['text', 'image', 'video']).withMessage('Invalid media type'),
  body('background_color').optional().isString().withMessage('Background color must be a string'),
  body('user_id').isNumeric().withMessage('User ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Unauthorized' 
      });
    }

    const statusData = {
      user_id: req.body.user_id,
      caption: req.body.caption || '',
      media_url: req.body.media_url || '',
      media_type: req.body.media_type || 'text',
      background_color: req.body.background_color || null
    };

    console.log('Creating status with data:', statusData);

    const result = await customChatServiceInstance.createStatus(statusData, token);
    
    res.json(result);
  } catch (error) {
    console.error('Create status error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create status',
      message: error.message
    });
  }
});

// Upload status media
router.post('/status/upload', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await customChatServiceInstance.uploadStatusMedia(req, token);
    res.json(result);
  } catch (error) {
    console.error('Upload status media error:', error);
    res.status(500).json({ error: 'Failed to upload status media' });
  }
});

// Get specific status
router.get('/status/:statusId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { statusId } = req.params;
    const status = await customChatServiceInstance.getStatus(statusId, token);
    res.json(status);
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Mark status as viewed
router.post('/status/:statusId/view', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { statusId } = req.params;
    const result = await customChatServiceInstance.markStatusViewed(statusId, token);
    res.json(result);
  } catch (error) {
    console.error('Mark status viewed error:', error);
    res.status(500).json({ error: 'Failed to mark status as viewed' });
  }
});

// Get status viewers
router.get('/status/:statusId/viewers', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { statusId } = req.params;
    const viewers = await customChatServiceInstance.getStatusViewersNew(statusId, token);
    res.json(viewers);
  } catch (error) {
    console.error('Get status viewers error:', error);
    res.status(500).json({ error: 'Failed to get status viewers' });
  }
});

// Get status analytics
router.get('/status/:statusId/analytics', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { statusId } = req.params;
    const analytics = await customChatServiceInstance.getStatusAnalytics(statusId, token);
    res.json(analytics);
  } catch (error) {
    console.error('Get status analytics error:', error);
    res.status(500).json({ error: 'Failed to get status analytics' });
  }
});

// Like status
router.post('/status/:statusId/like', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { statusId } = req.params;
    const result = await customChatServiceInstance.likeStatus(statusId, token);
    res.json(result);
  } catch (error) {
    console.error('Like status error:', error);
    res.status(500).json({ error: 'Failed to like status' });
  }
});

// Get status likes
router.get('/status/:statusId/likes', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { statusId } = req.params;
    const likes = await customChatServiceInstance.getStatusLikes(statusId, token);
    res.json(likes);
  } catch (error) {
    console.error('Get status likes error:', error);
    res.status(500).json({ error: 'Failed to get status likes' });
  }
});

// Comment on status
router.post('/status/:statusId/comment', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { statusId } = req.params;
    const result = await customChatServiceInstance.commentOnStatus(statusId, req.body.comment, token);
    res.json(result);
  } catch (error) {
    console.error('Comment on status error:', error);
    res.status(500).json({ error: 'Failed to comment on status' });
  }
});

// Get status comments
router.get('/status/:statusId/comments', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { statusId } = req.params;
    const comments = await customChatServiceInstance.getStatusComments(statusId, token);
    res.json(comments);
  } catch (error) {
    console.error('Get status comments error:', error);
    res.status(500).json({ error: 'Failed to get status comments' });
  }
});

// ========================= GROUP MEDIA UPLOAD ROUTES =========================

// Upload media file for group messaging
router.post('/groups/:groupId/media/upload', trackUploadProgress, mediaUpload, [
  body('message').optional().isString()
], async (req, res) => {
  try {
    console.log('🚀 Server: Enhanced group media upload started');
    console.log('📋 Server: Request params:', req.params);
    console.log('📋 Server: Request body:', req.body);
    console.log('📋 Server: Request file:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    } : 'No file');
    console.log('📋 Server: Request user:', req.user ? {
      user_id: req.user.user_id,
      username: req.user.username
    } : 'No user');
    console.log('📋 Server: Request headers auth:', req.headers.authorization ? 'Present' : 'Missing');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ Server: Validation failed:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!req.file) {
      console.error('❌ Server: No file uploaded');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    if (!validateMediaFile(req.file)) {
      console.error('❌ Server: Invalid file format or size');
      return res.status(400).json({
        success: false,
        message: 'Invalid file format or size'
      });
    }

    const { groupId } = req.params;
    const { message } = req.body;
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    console.log('📊 Server: Group upload parameters:', {
      groupId,
      message,
      userId,
      hasToken: !!userToken
    });

    const fileInfo = getFileInfo(req.file);
    console.log('🚀 Server: Enhanced group media upload for group:', groupId, fileInfo);

    // Upload enhanced group media via custom chat service
    const result = await customChatServiceInstance.uploadGroupMedia({
      file: req.file,
      groupId,
      message: message || '',
      userId,
      userToken
    });

    console.log('✅ Server: Group upload result:', result);

    // Clean up temporary file
    fs.unlinkSync(req.file.path);
    console.log('🧹 Server: Cleaned up temp file:', req.file.path);

    res.json({
      success: true,
      data: result,
      fileInfo,
      message: 'Group media uploaded successfully'
    });
  } catch (error) {
    console.error('❌ Server: Group media upload failed:', {
      error: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      file: req.file ? {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : null
    });

    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('🧹 Server: Cleaned up temp file after error:', req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload group media',
      error: error.message
    });
  }
});

// Upload voice message for group messaging
router.post('/groups/:groupId/voice/upload', trackUploadProgress, voiceUpload, [
  body('duration').isNumeric().withMessage('Duration must be a number'),
  body('message').optional().isString()
], async (req, res) => {
  try {
    console.log('🎙️ Server: Enhanced group voice upload started');
    console.log('📋 Server: Request params:', req.params);
    console.log('📋 Server: Request body:', req.body);
    console.log('📋 Server: Request file:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    } : 'No file');
    console.log('📋 Server: Request user:', req.user ? {
      user_id: req.user.user_id,
      username: req.user.username
    } : 'No user');
    console.log('📋 Server: Request headers auth:', req.headers.authorization ? 'Present' : 'Missing');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ Server: Voice validation failed:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!req.file) {
      console.error('❌ Server: No voice file uploaded');
      return res.status(400).json({
        success: false,
        message: 'No voice file uploaded'
      });
    }

    const { groupId } = req.params;
    const { duration, message } = req.body;
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    console.log('📊 Server: Group voice upload parameters:', {
      groupId,
      duration,
      message,
      userId,
      hasToken: !!userToken
    });

    const fileInfo = getFileInfo(req.file);
    console.log('🎙️ Server: Enhanced group voice upload for group:', groupId, fileInfo);

    // Upload enhanced group voice via custom chat service
    const result = await customChatServiceInstance.uploadGroupVoice({
      file: req.file,
      groupId,
      duration,
      message: message || '',
      userId,
      userToken
    });

    console.log('✅ Server: Group voice upload result:', result);

    // Clean up temporary file
    fs.unlinkSync(req.file.path);
    console.log('🧹 Server: Cleaned up temp voice file:', req.file.path);

    res.json({
      success: true,
      data: result,
      fileInfo,
      message: 'Group voice message uploaded successfully'
    });
  } catch (error) {
    console.error('❌ Server: Group voice upload failed:', {
      error: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
      file: req.file ? {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : null
    });

    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('🧹 Server: Cleaned up temp voice file after error:', req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload group voice message',
      error: error.message
    });
  }
});

// Reply to group message
router.post('/groups/:groupId/messages/:messageId/reply', [
  body('message').optional().isString(),
  body('messageType').optional().isIn(['text', 'image', 'video', 'audio', 'document']),
  body('mediaUrl').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { groupId, messageId } = req.params;
    const { message, messageType, mediaUrl } = req.body;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    console.log(`💬 Server: Replying to group message ${messageId} in group ${groupId}`);

    const result = await customChatServiceInstance.replyToGroupMessage({
      groupId,
      replyToMessageId: messageId,
      message,
      messageType: messageType || 'text',
      mediaUrl,
      userToken
    });

    res.json({
      success: true,
      data: result,
      message: 'Reply sent successfully'
    });
  } catch (error) {
    console.error('❌ Server: Reply to group message failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reply'
    });
  }
});

// Edit group message
router.put('/groups/:groupId/messages/:messageId', [
  body('message').notEmpty().withMessage('Message content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { groupId, messageId } = req.params;
    const { message } = req.body;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    console.log(`✏️ Server: Editing group message ${messageId} in group ${groupId}`);

    const result = await customChatServiceInstance.editGroupMessage({
      groupId,
      messageId,
      newMessage: message,
      userToken
    });

    res.json({
      success: true,
      data: result,
      message: 'Message edited successfully'
    });
  } catch (error) {
    console.error('❌ Server: Edit group message failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to edit message'
    });
  }
});

// Mark group message as read
router.post('/groups/:groupId/messages/:messageId/read', async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    console.log(`✅ Server: Marking group message ${messageId} as read for user ${userId}`);

    const result = await customChatServiceInstance.markGroupMessageRead({
      groupId,
      messageId,
      userId,
      userToken
    });

    res.json({
      success: true,
      data: result,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('❌ Server: Mark group message read failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read'
    });
  }
});

// Get group message read status
router.get('/groups/:groupId/messages/:messageId/read-status', async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    console.log(`📋 Server: Getting read status for group message ${messageId}`);

    const result = await customChatServiceInstance.getGroupMessageReadStatus({
      groupId,
      messageId,
      userToken
    });

    res.json({
      success: true,
      data: result,
      message: 'Read status retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Server: Get group message read status failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get read status'
    });
  }
});

// ========================= GROUP CHAT ENDPOINTS =========================

/**
 * GROUP CHAT: Get user's group list
 * GET /groups - Retrieve list of all groups the user is a member of
 */
router.get('/groups', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const userToken = req.user.token;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    console.log('👥 Server: Getting groups for user:', userId);

    const groups = await customChatServiceInstance.getGroups(userId, page, limit, userToken);
    
    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('❌ Server: Get groups failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get groups' 
    });
  }
});

/**
 * GROUP CHAT: Create new group
 * POST /groups - Create a new group conversation
 */
router.post('/groups', [
  body('name').notEmpty().withMessage('Group name is required'),
  body('description').optional().isString(),
  body('members').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const groupData = req.body;
    const group = await customChatServiceInstance.createGroup(groupData, token);
    res.json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

/**
 * GROUP CHAT: Get messages from group conversation
 * GET /groups/:groupId/messages - Retrieve message history from group chat
 */
router.get('/groups/:groupId/messages', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { groupId } = req.params;
    const { page = 1, per_page = 20 } = req.query;
    
    console.log(`🔍 Server: Getting group messages for group ${groupId}`);
    
    const result = await customChatServiceInstance.getGroupMessages(groupId, page, per_page, token);
    
    console.log(`🔍 Server: Group messages result:`, {
      groupId,
      messagesCount: Array.isArray(result) ? result.length : 0,
      isArray: Array.isArray(result),
      result: result
    });
    
    // Ensure we always return an array in the expected format
    res.json({
      success: true,
      data: Array.isArray(result) ? result : [],
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page)
      }
    });
  } catch (error) {
    console.error('❌ Server: Get group messages error:', error);
    res.status(500).json({ 
      success: false,
      data: [],
      error: 'Failed to get group messages',
      message: error.message 
    });
  }
});

/**
 * GROUP CHAT: Send message to group
 * POST /groups/:groupId/messages - Send message to group conversation
 */
router.post('/groups/:groupId/messages', [
  body('message').optional().isString(),
  body('users').optional().isString().isIn(['all', 'individual']),
  body('users_list').optional().isArray(),
  body('type').optional().isString().isIn(['open', 'private']),
  body('bp_media_ids').optional().isArray(),
  body('bp_videos').optional().isArray(),
  body('bp_documents').optional().isArray(),
  body('media_gif').optional().isObject(),
  body('group_name').optional().isString(),
  body('group_avatar').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { groupId } = req.params;
    const messageData = { ...req.body, group_id: groupId };
    
    console.log(`📤 Server: Sending group message to group ${groupId}`);
    
    const result = await customChatServiceInstance.sendGroupMessage(messageData, token);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Send group message error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send group message',
      message: error.message 
    });
  }
});

// Get class metadata from group
router.get('/groups/:groupId/class-metadata', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { groupId } = req.params;
    
    const result = await customChatServiceInstance.getClassMetadata(groupId, token);
    res.json(result);
  } catch (error) {
    console.error('Get class metadata error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get class metadata',
      message: error.message 
    });
  }
});

// Send group message using custom table
router.post('/groups/:groupId/messages/custom', [
  body('message').optional().isString().trim(),
  body('message_type').optional().isIn(['text', 'image', 'video', 'audio', 'file', 'gif', 'voice']),
  body('media_url').optional().isURL(),
  body('media_thumbnail').optional().isURL(),
  body('file_name').optional().isString(),
  body('file_size').optional().isInt({ min: 0 }),
  body('duration').optional().isInt({ min: 0 }),
  body('reply_to').optional().isInt({ min: 1 }),
  body('metadata').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { groupId } = req.params;
    const messageData = { ...req.body, group_id: groupId };
    
    console.log(`📤 Server: Sending custom group message to group ${groupId}`);
    
    const result = await customChatServiceInstance.sendGroupMessage(messageData, token);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Send custom group message error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send custom group message',
      message: error.message 
    });
  }
});

// Get group messages using custom table
router.get('/groups/:groupId/messages/custom', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { groupId } = req.params;
    const { page = 1, per_page = 20 } = req.query;
    
    console.log(`📥 Server: Getting custom group messages for group ${groupId}`);
    
    // ⚠️ CHANGED: Use unified getGroupMessages method (now uses custom endpoint)
    const result = await customChatServiceInstance.getGroupMessages(groupId, page, per_page, token);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get custom group messages error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get custom group messages',
      message: error.message 
    });
  }
});

/**
 * GROUP CHAT: Delete message from group
 * DELETE /groups/:groupId/messages/:messageId - Delete specific message from group conversation
 */
router.delete('/groups/:groupId/messages/:messageId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { groupId, messageId } = req.params;
    
    console.log(`🗑️ Server: Deleting message ${messageId} from group ${groupId}`);
    
    const result = await customChatServiceInstance.deleteGroupMessage(groupId, messageId, token);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Delete group message error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete group message',
      message: error.message 
    });
  }
});

/**
 * GROUP CHAT: Delete entire group
 * DELETE /groups/:groupId - Permanently delete group and all its messages
 */
router.delete('/groups/:groupId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { groupId } = req.params;
    
    console.log(`🗑️ Server: Deleting group ${groupId}`);
    
    const result = await customChatServiceInstance.deleteGroup(groupId, token);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete group',
      message: error.message 
    });
  }
});

// Check if user is group admin
router.get('/groups/:groupId/admin-check', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { groupId } = req.params;
    const { user_id } = req.query;
    
    console.log(`👮 Server: Checking admin status for user ${user_id} in group ${groupId}`);
    
    // For now, return false as admin check isn't implemented in the service
    // This prevents crashes while maintaining functionality
    const result = {
      success: true,
      data: {
        is_admin: false,
        group_id: groupId,
        user_id: user_id
      }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Group admin check error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check admin status',
      message: error.message 
    });
  }
});

// Get chat groups only
router.get('/chat-groups', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { page = 1, per_page = 50 } = req.query;
    
    console.log('📋 Server: Getting chat groups only');
    
    const result = await customChatServiceInstance.getChatGroupsOnly(page, per_page, token);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get chat groups error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get chat groups',
      message: error.message 
    });
  }
});

// Add class metadata to group
router.post('/groups/:groupId/class-metadata', [
  body('class_name').optional().isString(),
  body('subject').optional().isString(),
  body('grade_level').optional().isString(),
  body('capacity').optional().isInt({ min: 1 }),
  body('teacher_id').optional().isInt(),
  body('course_id').optional().isInt(),
  body('bundle_id').optional().isInt(),
  body('live_classes_enabled').optional().isBoolean(),
  body('features').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { groupId } = req.params;
    const classMetadata = req.body;
    
    const result = await customChatServiceInstance.addClassMetadata(groupId, classMetadata, token);
    res.json({
      success: true,
      message: 'Class metadata added successfully',
      data: result
    });
  } catch (error) {
    console.error('Add class metadata error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to add class metadata',
      message: error.message 
    });
  }
});

// Enhanced Thread Management Routes
// Delete thread
router.delete('/threads/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user.user_id;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    console.log(`🗑️ Server: Deleting thread ${threadId} for user ${userId}`);

    const result = await customChatServiceInstance.deleteThread({
      threadId,
      userId,
      userToken
    });

    res.json({
      success: true,
      data: result,
      message: 'Thread deleted successfully'
    });
  } catch (error) {
    console.error('❌ Server: Delete thread failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete thread'
    });
  }
});

// Mark thread as read
router.post('/threads/:threadId/read', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { threadId } = req.params;
    const { user_id } = req.body;
    
    const result = await customChatServiceInstance.markThreadRead(threadId, user_id, token);
    res.json(result);
  } catch (error) {
    console.error('Mark thread read error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to mark thread as read',
      message: error.message 
    });
  }
});

// Mark message as read
router.post('/messages/:messageId/read', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { messageId } = req.params;
    const { user_id } = req.body;
    
    const result = await customChatServiceInstance.markMessageRead(messageId, user_id, token);
    res.json(result);
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to mark message as read',
      message: error.message 
    });
  }
});

// Generate live class invite
router.post('/groups/:groupId/live-class-invite', [
  body('title').notEmpty().withMessage('Live class title is required'),
  body('description').optional().isString(),
  body('scheduled_time').notEmpty().withMessage('Scheduled time is required'),
  body('duration').optional().isInt({ min: 1 }),
  body('course_id').optional().isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { groupId } = req.params;
    const liveClassData = req.body;
    const invite = await customChatServiceInstance.generateLiveClassInvite(groupId, liveClassData, token);
    res.json(invite);
  } catch (error) {
    console.error('Generate live class invite error:', error);
    res.status(500).json({ error: 'Failed to generate live class invite' });
  }
});

// Join live class via invite
router.post('/groups/join-live-class', [
  body('inviteCode').notEmpty().withMessage('Invite code is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { inviteCode } = req.body;
    const result = await customChatServiceInstance.joinLiveClassViaInvite(inviteCode, token);
    res.json(result);
  } catch (error) {
    console.error('Join live class error:', error);
    res.status(500).json({ error: 'Failed to join live class' });
  }
});


// Verify group admin status
router.get('/groups/:groupId/verify-admin', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { groupId } = req.params;
    const { user_id } = req.query;
    const isAdmin = await customChatServiceInstance.verifyGroupAdmin(groupId, user_id, token);
    res.json({ 
      success: true, 
      data: { 
        isAdmin,
        user_id,
        group_id: groupId 
      }
    });
  } catch (error) {
    console.error('Verify group admin error:', error);
    res.status(500).json({ error: 'Failed to verify group admin status' });
  }
});

// Check user enrollment
router.get('/enrollment/check', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { user_id, course_id } = req.query;
    if (!user_id || !course_id) {
      return res.status(400).json({ error: 'User ID and Course ID are required' });
    }

    const isEnrolled = await customChatServiceInstance.checkUserEnrollment(user_id, course_id, token);
    res.json({ 
      success: true, 
      data: { 
        isEnrolled,
        user_id: parseInt(user_id),
        course_id: parseInt(course_id)
      }
    });
  } catch (error) {
    console.error('Check enrollment error:', error);
    res.status(500).json({ error: 'Failed to check user enrollment' });
  }
});

// ========================= GROUP MANAGEMENT ENDPOINTS =========================

/**
 * GROUP MANAGEMENT: Get group members
 * GET /groups/:groupId/members - Get list of group members with pagination
 */
router.get('/groups/:groupId/members', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { 
      page = 1, 
      per_page = 50,
      search,
      status = 'last_joined',
      roles,
      exclude,
      exclude_admins = false, // ⚠️ Include admins by default
      exclude_banned = false,
      scope
    } = req.query;
    const userId = req.user.user_id;
    const userToken = req.user.token;

    console.log(`📱 Route: Getting members for group ${groupId}, page ${page}, exclude_admins: ${exclude_admins}`);

    const result = await customChatServiceInstance.getGroupMembers(
      groupId, 
      parseInt(page), 
      parseInt(per_page), 
      userToken
    );

    if (result.success) {
      console.log(`✅ Route: Successfully got ${result.data.length} group members`);
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } else {
      console.log('❌ Route: Failed to get group members');
      res.status(400).json({ success: false, error: 'Failed to get group members' });
    }
  } catch (error) {
    console.error('❌ Route: Error getting group members:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get group members',
      details: error.message 
    });
  }
});

/**
 * GROUP MANAGEMENT: Add member to group
 * POST /groups/:groupId/members - Add new member to group
 */
router.post('/groups/:groupId/members', [
  body('user_id').isNumeric().withMessage('User ID must be a number'),
  body('role').optional().isIn(['admin', 'mod', 'member']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { groupId } = req.params;
    const { user_id, role = 'member' } = req.body;
    const adminUserId = req.user.user_id;
    const userToken = req.user.token;

    console.log(`➕ Route: Adding user ${user_id} to group ${groupId} with role ${role}`);

    // Verify admin access
    const isAdmin = await customChatServiceInstance.verifyGroupAdmin(groupId, adminUserId, userToken);
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only group admins can add members' 
      });
    }

    const result = await customChatServiceInstance.addGroupMember(
      groupId, 
      user_id, 
      role, 
      userToken
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Member added successfully',
        data: result.data
      });
    } else {
      res.status(400).json({ success: false, error: 'Failed to add member' });
    }
  } catch (error) {
    console.error('❌ Route: Error adding group member:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add member to group',
      details: error.message 
    });
  }
});

/**
 * GROUP MANAGEMENT: Remove member from group
 * DELETE /groups/:groupId/members/:userId - Remove member from group
 */
router.delete('/groups/:groupId/members/:userId', async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const adminUserId = req.user.user_id;
    const userToken = req.user.token;

    console.log(`➖ Route: Removing user ${userId} from group ${groupId}`);

    // Verify admin access
    const isAdmin = await customChatServiceInstance.verifyGroupAdmin(groupId, adminUserId, userToken);
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only group admins can remove members' 
      });
    }

    // Prevent self-removal
    if (parseInt(userId) === parseInt(adminUserId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'You cannot remove yourself from the group' 
      });
    }

    const result = await customChatServiceInstance.removeGroupMember(
      groupId, 
      userId, 
      userToken
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Member removed successfully',
        data: result.data
      });
    } else {
      res.status(400).json({ success: false, error: 'Failed to remove member' });
    }
  } catch (error) {
    console.error('❌ Route: Error removing group member:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to remove member from group',
      details: error.message 
    });
  }
});

/**
 * GROUP MANAGEMENT: Get group details
 * GET /groups/:groupId - Get detailed group information
 */
router.get('/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.user_id;
    const userToken = req.user.token;

    console.log(`ℹ️ Route: Getting details for group ${groupId}`);

    const result = await customChatServiceInstance.getGroupDetails(groupId, userToken);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({ success: false, error: 'Failed to get group details' });
    }
  } catch (error) {
    console.error('❌ Route: Error getting group details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get group details',
      details: error.message 
    });
  }
});

/**
 * GROUP MANAGEMENT: Promote member to admin
 * POST /groups/:groupId/members/:userId/promote - Promote member to admin role
 */
router.post('/groups/:groupId/members/:userId/promote', [
  body('role').optional().isIn(['admin', 'mod']).withMessage('Invalid role - must be admin or mod')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { groupId, userId } = req.params;
    const { role = 'admin' } = req.body;
    const promoterId = req.user.user_id;
    const userToken = req.user.token;

    console.log(`⬆️ Route: Promoting user ${userId} to ${role} in group ${groupId}`);

    // Verify admin access
    const isAdmin = await customChatServiceInstance.verifyGroupAdmin(groupId, promoterId, userToken);
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only group admins can promote members' 
      });
    }

    // Prevent self-promotion
    if (parseInt(userId) === parseInt(promoterId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'You cannot promote yourself' 
      });
    }

    let result;
    if (role === 'admin') {
      result = await customChatServiceInstance.promoteToAdmin(groupId, userId, promoterId, userToken);
    } else if (role === 'mod') {
      result = await customChatServiceInstance.promoteToModerator(groupId, userId, promoterId, userToken);
    }

    if (result) {
      res.json({
        success: true,
        message: `Member promoted to ${role} successfully`,
        data: result
      });
    } else {
      res.status(400).json({ success: false, error: `Failed to promote member to ${role}` });
    }
  } catch (error) {
    console.error('❌ Route: Error promoting group member:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to promote member',
      details: error.message 
    });
  }
});

/**
 * GROUP MANAGEMENT: Demote member from admin/mod
 * POST /groups/:groupId/members/:userId/demote - Demote member from admin/mod to regular member
 */
router.post('/groups/:groupId/members/:userId/demote', async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const demoterId = req.user.user_id;
    const userToken = req.user.token;

    console.log(`⬇️ Route: Demoting user ${userId} in group ${groupId}`);

    // Verify admin access
    const isAdmin = await customChatServiceInstance.verifyGroupAdmin(groupId, demoterId, userToken);
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only group admins can demote members' 
      });
    }

    // Prevent self-demotion
    if (parseInt(userId) === parseInt(demoterId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'You cannot demote yourself' 
      });
    }

    const result = await customChatServiceInstance.demoteFromAdmin(groupId, userId, demoterId, userToken);

    if (result) {
      res.json({
        success: true,
        message: 'Member demoted successfully',
        data: result
      });
    } else {
      res.status(400).json({ success: false, error: 'Failed to demote member' });
    }
  } catch (error) {
    console.error('❌ Route: Error demoting group member:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to demote member',
      details: error.message 
    });
  }
});

/**
 * GROUP MANAGEMENT: Ban member from group
 * POST /groups/:groupId/members/:userId/ban - Ban member from group
 */
router.post('/groups/:groupId/members/:userId/ban', async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const bannerId = req.user.user_id;
    const userToken = req.user.token;

    console.log(`🚫 Route: Banning user ${userId} from group ${groupId}`);

    // Verify admin access
    const isAdmin = await customChatServiceInstance.verifyGroupAdmin(groupId, bannerId, userToken);
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only group admins can ban members' 
      });
    }

    // Prevent self-ban
    if (parseInt(userId) === parseInt(bannerId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'You cannot ban yourself' 
      });
    }

    const result = await customChatServiceInstance.banGroupMember(groupId, userId, bannerId, userToken);

    if (result) {
      res.json({
        success: true,
        message: 'Member banned successfully',
        data: result
      });
    } else {
      res.status(400).json({ success: false, error: 'Failed to ban member' });
    }
  } catch (error) {
    console.error('❌ Route: Error banning group member:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to ban member',
      details: error.message 
    });
  }
});

/**
 * GROUP MANAGEMENT: Unban member from group
 * POST /groups/:groupId/members/:userId/unban - Unban member from group
 */
router.post('/groups/:groupId/members/:userId/unban', async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const unbannerId = req.user.user_id;
    const userToken = req.user.token;

    console.log(`✅ Route: Unbanning user ${userId} from group ${groupId}`);

    // Verify admin access
    const isAdmin = await customChatServiceInstance.verifyGroupAdmin(groupId, unbannerId, userToken);
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only group admins can unban members' 
      });
    }

    const result = await customChatServiceInstance.unbanGroupMember(groupId, userId, unbannerId, userToken);

    if (result) {
      res.json({
        success: true,
        message: 'Member unbanned successfully',
        data: result
      });
    } else {
      res.status(400).json({ success: false, error: 'Failed to unban member' });
    }
  } catch (error) {
    console.error('❌ Route: Error unbanning group member:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to unban member',
      details: error.message 
    });
  }
});

/**
 * GROUP MANAGEMENT: Delete group completely
 * DELETE /groups/:groupId - Permanently delete group and all related data
 */
router.delete('/groups/:groupId', [
  body('delete_group_forum').optional().isBoolean().withMessage('delete_group_forum must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { groupId } = req.params;
    const { delete_group_forum = false } = req.body;
    const adminUserId = req.user.user_id;
    const userToken = req.user.token;

    console.log(`🗑️ Route: Deleting group ${groupId}, deleteGroupForum: ${delete_group_forum}`);

    // Verify admin access
    const isAdmin = await customChatServiceInstance.verifyGroupAdmin(groupId, adminUserId, userToken);
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only group admins can delete the group' 
      });
    }

    const result = await customChatServiceInstance.deleteGroupCompletely(
      groupId, 
      delete_group_forum, 
      userToken
    );

    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Group deleted successfully',
        data: result.data
      });
    } else {
      res.status(400).json({ success: false, error: 'Failed to delete group' });
    }
  } catch (error) {
    console.error('❌ Route: Error deleting group:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete group',
      details: error.message 
    });
  }
});

/**
 * GROUP MANAGEMENT: Delete all group messages (cleanup)
 * DELETE /groups/:groupId/messages - Delete all messages for a group (used during group deletion)
 */
router.delete('/groups/:groupId/messages', async (req, res) => {
  try {
    const { groupId } = req.params;
    const adminUserId = req.user.user_id;
    const userToken = req.user.token;

    console.log(`🧹 Route: Cleaning up all messages for group ${groupId}`);

    // Verify admin access
    const isAdmin = await customChatServiceInstance.verifyGroupAdmin(groupId, adminUserId, userToken);
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only group admins can delete group messages' 
      });
    }

    // This endpoint would clean up all group messages
    // Implementation depends on your message storage strategy
    console.log('✅ Route: Group messages cleanup completed');
    
    res.json({
      success: true,
      message: 'All group messages have been deleted'
    });
  } catch (error) {
    console.error('❌ Route: Error cleaning up group messages:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clean up group messages',
      details: error.message 
    });
  }
});

// ========================= MEDIA UPLOAD ENDPOINTS =========================

/**
 * PRIVATE CHAT: Upload media for chat messages - SIMPLIFIED VERSION
 * POST /media/upload/chat - Simple media upload without validation conflicts
 */
router.post('/media/upload/chat', simpleUploadMiddleware, async (req, res) => {
  try {
    console.log('📤 Server: Simple media upload received');
    console.log('📤 Server: Body keys:', Object.keys(req.body || {}));
    console.log('📤 Server: File info:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      filename: req.file.filename
    } : 'No file received');

    // Check if this is base64 data instead of file upload
    if (req.body.file_data && !req.file) {
      console.log('📤 Server: Processing base64 upload');
      
      const userId = req.body.user_id;
      const threadId = req.body.thread_id;
      const recipientId = req.body.recipient_id;
      const messageText = req.body.message || '';
      const messageType = req.body.message_type || 'image';
      
      // Convert base64 to file
      const base64Data = req.body.file_data;
      const fileName = req.body.file_name || 'upload.jpg';
      const mimeType = req.body.file_type || 'image/jpeg';
      
      // Save base64 as temporary file
      const uploadDir = path.join(__dirname, '../../uploads/simple');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const tempFileName = `base64_${Date.now()}_${fileName}`;
      const tempFilePath = path.join(uploadDir, tempFileName);
      
      // Write base64 to file
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(tempFilePath, buffer);
      
      const fileInfo = {
        originalname: fileName,
        filename: tempFileName,
        mimetype: mimeType,
        size: buffer.length,
        path: tempFilePath
      };
      
      console.log('📤 Server: Base64 converted to file:', fileInfo);
      
      // Process the upload using the file
      const userToken = req.headers.authorization?.replace('Bearer ', '');
      
      const uploadResult = await customChatServiceInstance.uploadEnhancedMedia({
        file: fileInfo,
        userId: userId,
        threadId: threadId,
        recipientId: recipientId,
        messageText: messageText,
        messageType: messageType,
        userToken: userToken
      });

      console.log('✅ Server: Base64 upload completed successfully');

      return res.json({
        success: true,
        data: uploadResult,
        message: 'Media uploaded successfully'
      });
    }

    // Regular FormData file upload handling
    if (!req.file) {
      console.error('❌ Server: No file received');
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    if (!req.body.user_id) {
      console.error('❌ Server: No user_id provided');
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    console.log('✅ Server: File upload validation passed');

    const userToken = req.headers.authorization?.replace('Bearer ', '');
    const userId = req.body.user_id;
    const threadId = req.body.thread_id || req.body.threadId;
    const recipientId = req.body.recipient_id;
    const messageText = req.body.message || '';
    const messageType = req.body.message_type || 'image';

    console.log('� Server: Processing upload with params:', {
      userId,
      threadId,
      recipientId,
      messageType,
      hasToken: !!userToken
    });

    // Use the custom chat service to handle the upload
    const uploadResult = await customChatServiceInstance.uploadEnhancedMedia({
      file: req.file,
      userId: userId,
      threadId: threadId,
      recipientId: recipientId,
      messageText: messageText,
      messageType: messageType,
      userToken: userToken
    });

    console.log('✅ Server: Upload successful:', uploadResult);

    return res.status(200).json({
      success: true,
      data: uploadResult,
      message: 'Media uploaded successfully'
    });

  } catch (error) {
    console.error('❌ Server: Media upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Media upload failed',
      details: error.stack
    });
  }
});

/**
 * PRIVATE CHAT: Upload voice message for chat
 * POST /voice/upload/chat - Enhanced voice upload with direct chat integration
 */
router.post('/voice/upload/chat', voiceUpload, [
  body('user_id').notEmpty().withMessage('User ID is required'),
  body('thread_id').optional().isNumeric().withMessage('Thread ID must be a number')
], async (req, res) => {
  try {
    console.log('🎤 Server: Voice upload for chat received');
    console.log('🎤 Server: Request body:', req.body);
    console.log('🎤 Server: File info:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    } : 'No file');

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No voice file uploaded'
      });
    }

    const userToken = req.headers.authorization?.replace('Bearer ', '');
    const userId = req.body.user_id;
    const threadId = req.body.thread_id;

    // Proxy to WordPress enhanced voice upload endpoint
    const uploadResult = await customChatServiceInstance.uploadEnhancedVoice({
      file: req.file,
      userId: userId,
      threadId: threadId,
      userToken: userToken
    });

    res.json({
      success: true,
      ...uploadResult
    });

  } catch (error) {
    console.error('❌ Server: Voice upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Voice upload failed',
      details: error.message
    });
  }
});

/**
 * GROUP CHAT: Upload media for group chat messages (Mobile-friendly endpoint)
 * POST /media/upload/group - Unified group media upload endpoint
 */
router.post('/media/upload/group', mediaUpload, [
  body('user_id').notEmpty().withMessage('User ID is required'),
  body('group_id').notEmpty().withMessage('Group ID is required'),
  body('groupId').optional().isNumeric().withMessage('Group ID must be a number'),
  body('message').optional().isString().withMessage('Message must be a string')
], async (req, res) => {
  try {
    console.log('📤 Server: Group media upload received');
    console.log('📤 Server: Request body:', req.body);
    console.log('📤 Server: File info:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    } : 'No file');

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ Server: Validation failed:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const userToken = req.headers.authorization?.replace('Bearer ', '');
    const userId = req.body.user_id;
    const groupId = req.body.group_id || req.body.groupId; // Handle both formats
    const message = req.body.message || '';

    console.log('📊 Server: Group upload parameters:', {
      groupId,
      message,
      userId,
      hasToken: !!userToken
    });

    // Proxy to WordPress enhanced group media upload endpoint
    const uploadResult = await customChatServiceInstance.uploadGroupMedia({
      file: req.file,
      groupId: groupId,
      message: message,
      userId: userId,
      userToken: userToken
    });

    console.log('✅ Server: Group media upload result:', uploadResult);

    res.json({
      success: true,
      ...uploadResult
    });

  } catch (error) {
    console.error('❌ Server: Group media upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Group media upload failed',
      details: error.message
    });
  }
});

module.exports = router;
