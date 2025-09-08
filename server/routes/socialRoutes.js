const express = require('express');
const { body, validationResult } = require('express-validator');

const socialService = require('../services/socialService');

const router = express.Router();

// Get friends list
router.get('/friends', async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const friends = await socialService.getFriends(userId);
    
    res.json({
      success: true,
      data: friends,
      total: friends.length
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch friends'
    });
  }
});

// Get followers list
router.get('/followers', async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const followers = await socialService.getFollowers(userId);
    
    res.json({
      success: true,
      data: followers,
      total: followers.length
    });
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch followers'
    });
  }
});

// Get following list
router.get('/following', async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const following = await socialService.getFollowing(userId);
    
    res.json({
      success: true,
      data: following,
      total: following.length
    });
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch following'
    });
  }
});

// Search users globally
router.get('/users/search', async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.user_id;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const users = await socialService.searchUsers(query.trim(), userId);
    
    res.json({
      success: true,
      data: users,
      total: users.length
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users'
    });
  }
});

// Block user
router.post('/users/block', [
  body('target_user_id').isNumeric().withMessage('Target user ID must be a number')
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

    const { target_user_id } = req.body;
    const userId = req.user.user_id;

    const result = await socialService.blockUser(userId, target_user_id);
    
    res.json({
      success: true,
      data: result,
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block user'
    });
  }
});

// Unblock user
router.post('/users/unblock', [
  body('target_user_id').isNumeric().withMessage('Target user ID must be a number')
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

    const { target_user_id } = req.body;
    const userId = req.user.user_id;

    const result = await socialService.unblockUser(userId, target_user_id);
    
    res.json({
      success: true,
      data: result,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unblock user'
    });
  }
});

// Get blocked users
router.get('/users/blocked', async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const blockedUsers = await socialService.getBlockedUsers(userId);
    
    res.json({
      success: true,
      data: blockedUsers,
      total: blockedUsers.length
    });
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocked users'
    });
  }
});

// Send friend request
router.post('/friends/request', [
  body('target_user_id').isNumeric().withMessage('Target user ID must be a number')
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

    const { target_user_id } = req.body;
    const userId = req.user.user_id;

    const result = await socialService.sendFriendRequest(userId, target_user_id);
    
    res.json({
      success: true,
      data: result,
      message: 'Friend request sent successfully'
    });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send friend request'
    });
  }
});

// Accept friend request
router.post('/friends/accept', [
  body('friendship_id').isNumeric().withMessage('Friendship ID must be a number')
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

    const { friendship_id } = req.body;
    const userId = req.user.user_id;

    const result = await socialService.acceptFriendRequest(friendship_id, userId);
    
    res.json({
      success: true,
      data: result,
      message: 'Friend request accepted successfully'
    });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept friend request'
    });
  }
});

// Reject friend request
router.post('/friends/reject', [
  body('friendship_id').isNumeric().withMessage('Friendship ID must be a number')
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

    const { friendship_id } = req.body;
    const userId = req.user.user_id;

    const result = await socialService.rejectFriendRequest(friendship_id, userId);
    
    res.json({
      success: true,
      data: result,
      message: 'Friend request rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject friend request'
    });
  }
});

// Remove friend
router.delete('/friends/remove', [
  body('friend_id').isNumeric().withMessage('Friend ID must be a number')
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

    const { friend_id } = req.body;
    const userId = req.user.user_id;

    const result = await socialService.removeFriend(userId, friend_id);
    
    res.json({
      success: true,
      data: result,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove friend'
    });
  }
});

// Get friend requests
router.get('/friends/requests', async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const requests = await socialService.getFriendRequests(userId);
    
    res.json({
      success: true,
      data: requests,
      total: requests.length
    });
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch friend requests'
    });
  }
});

// Get user online status
router.get('/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const status = await socialService.getUserOnlineStatus(userId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user status'
    });
  }
});

// Update user online status
router.post('/users/status', [
  body('is_online').isBoolean().withMessage('Online status must be boolean')
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

    const { is_online } = req.body;
    const userId = req.user.user_id;

    await socialService.updateUserOnlineStatus(userId, is_online);
    
    res.json({
      success: true,
      message: 'Online status updated successfully'
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update online status'
    });
  }
});

module.exports = router;
