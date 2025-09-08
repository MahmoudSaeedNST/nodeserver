const express = require('express');
const Joi = require('joi');
const buddyBossService = require('../services/buddyBossService');

const router = express.Router();

// Validation schemas
const postActivitySchema = Joi.object({
  content: Joi.string().required().max(1000),
  type: Joi.string().optional().valid('activity_update', 'activity_comment'),
  primary_item_id: Joi.number().optional(),
  secondary_item_id: Joi.number().optional(),
  component: Joi.string().optional(),
  privacy: Joi.string().optional().valid('public', 'loggedin', 'friends', 'onlyme')
});

const postCommentSchema = Joi.object({
  content: Joi.string().required().max(500)
});

const sendFriendRequestSchema = Joi.object({
  userId: Joi.number().required()
});

const manageFriendRequestSchema = Joi.object({
  requestId: Joi.number().required(),
  action: Joi.string().required().valid('accept', 'reject')
});

const joinGroupSchema = Joi.object({
  groupId: Joi.number().required()
});

/**
 * GET /api/social/activity
 * Get activity feed
 */
router.get('/activity', async (req, res) => {
  try {
    const { page = 1, per_page = 20, scope = 'all', search, component, type, user_id } = req.query;
    
    const params = {
      page: parseInt(page),
      per_page: parseInt(per_page),
      scope,
      order: 'desc',
      orderby: 'date_recorded'
    };

    if (search) params.search = search;
    if (component) params.component = component;
    if (type) params.type = type;
    if (user_id) params.user_id = user_id;

    const activities = await buddyBossService.getActivityFeed(params, req.token);

    res.json({
      success: true,
      message: 'Activity feed retrieved successfully',
      data: {
        activities: activities.map(activity => ({
          id: activity.id,
          primaryItemId: activity.primary_item_id,
          secondaryItemId: activity.secondary_item_id,
          userId: activity.user_id,
          component: activity.component,
          type: activity.type,
          action: activity.action,
          content: activity.content,
          date: activity.date,
          hideSnippet: activity.hide_sitewide,
          isFavorited: activity.favorited,
          favoriteCount: activity.favorite_count,
          commentCount: activity.comment_count,
          user: activity.user,
          canComment: activity.can_comment,
          canFavorite: activity.can_favorite,
          canDelete: activity.can_delete
        }))
      }
    });
  } catch (error) {
    console.error('Get activity feed error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve activity feed'
    });
  }
});

/**
 * POST /api/social/activity
 * Post new activity
 */
router.post('/activity', async (req, res) => {
  try {
    const { error, value } = postActivitySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const activityData = {
      ...value,
      user_id: req.user.id,
      component: value.component || 'activity',
      type: value.type || 'activity_update'
    };

    const newActivity = await buddyBossService.postActivity(activityData, req.token);

    res.json({
      success: true,
      message: 'Activity posted successfully',
      data: {
        activity: {
          id: newActivity.id,
          content: newActivity.content,
          date: newActivity.date,
          userId: newActivity.user_id,
          component: newActivity.component,
          type: newActivity.type
        }
      }
    });
  } catch (error) {
    console.error('Post activity error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to post activity'
    });
  }
});

/**
 * DELETE /api/social/activity/:id
 * Delete activity
 */
router.delete('/activity/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await buddyBossService.deleteActivity(id, req.token);

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    console.error('Delete activity error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete activity'
    });
  }
});

/**
 * POST /api/social/activity/:id/favorite
 * Toggle activity favorite (like/unlike)
 */
router.post('/activity/:id/favorite', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await buddyBossService.toggleActivityLike(id, req.token);

    res.json({
      success: true,
      message: result.favorited ? 'Activity liked successfully' : 'Activity unliked successfully',
      data: {
        favorited: result.favorited,
        favoriteCount: result.favorite_count
      }
    });
  } catch (error) {
    console.error('Toggle activity favorite error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to toggle activity favorite'
    });
  }
});

/**
 * GET /api/social/activity/:id/comments
 * Get activity comments
 */
router.get('/activity/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    
    const comments = await buddyBossService.getActivityComments(id, req.token);

    res.json({
      success: true,
      message: 'Activity comments retrieved successfully',
      data: {
        comments: comments.map(comment => ({
          id: comment.id,
          content: comment.content,
          date: comment.date,
          userId: comment.user_id,
          user: comment.user,
          canDelete: comment.can_delete
        }))
      }
    });
  } catch (error) {
    console.error('Get activity comments error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve activity comments'
    });
  }
});

/**
 * POST /api/social/activity/:id/comments
 * Post activity comment
 */
router.post('/activity/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = postCommentSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const newComment = await buddyBossService.postActivityComment(id, value.content, req.token);

    res.json({
      success: true,
      message: 'Comment posted successfully',
      data: {
        comment: {
          id: newComment.id,
          content: newComment.content,
          date: newComment.date,
          userId: newComment.user_id,
          activityId: id
        }
      }
    });
  } catch (error) {
    console.error('Post activity comment error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to post comment'
    });
  }
});

/**
 * DELETE /api/social/comments/:id
 * Delete activity comment
 */
router.delete('/comments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await buddyBossService.deleteActivityComment(id, req.token);

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete activity comment error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment'
    });
  }
});

/**
 * GET /api/social/friends
 * Get user's friends
 */
router.get('/friends', async (req, res) => {
  try {
    const friends = await buddyBossService.getUserFriends(req.user.id, req.token);

    res.json({
      success: true,
      message: 'Friends retrieved successfully',
      data: {
        friends: friends.map(friend => ({
          id: friend.id,
          userId: friend.user_id,
          friendId: friend.friend_id,
          isConfirmed: friend.is_confirmed,
          dateCreated: friend.date_created,
          user: friend.user,
          friend: friend.friend
        }))
      }
    });
  } catch (error) {
    console.error('Get friends error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve friends'
    });
  }
});

/**
 * POST /api/social/friends/request
 * Send friend request
 */
router.post('/friends/request', async (req, res) => {
  try {
    const { error, value } = sendFriendRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const friendRequest = await buddyBossService.sendFriendRequest(req.user.id, value.userId, req.token);

    res.json({
      success: true,
      message: 'Friend request sent successfully',
      data: {
        friendRequest: {
          id: friendRequest.id,
          userId: friendRequest.user_id,
          friendId: friendRequest.friend_id,
          dateCreated: friendRequest.date_created
        }
      }
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to send friend request'
    });
  }
});

/**
 * PUT /api/social/friends/request/:id
 * Accept or reject friend request
 */
router.put('/friends/request/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = manageFriendRequestSchema.validate({ ...req.body, requestId: parseInt(id) });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    let result;
    if (value.action === 'accept') {
      result = await buddyBossService.acceptFriendRequest(req.user.id, value.requestId, req.token);
    } else {
      result = await buddyBossService.rejectFriendRequest(req.user.id, value.requestId, req.token);
    }

    res.json({
      success: true,
      message: `Friend request ${value.action}ed successfully`,
      data: {
        friendRequest: result
      }
    });
  } catch (error) {
    console.error('Manage friend request error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to manage friend request'
    });
  }
});

/**
 * DELETE /api/social/friends/:id
 * Remove friend
 */
router.delete('/friends/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await buddyBossService.removeFriend(req.user.id, id, req.token);

    res.json({
      success: true,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Remove friend error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to remove friend'
    });
  }
});

/**
 * GET /api/social/groups
 * Get groups
 */
router.get('/groups', async (req, res) => {
  try {
    const { page = 1, per_page = 20, search, type = 'all', status = 'all' } = req.query;
    
    const params = {
      page: parseInt(page),
      per_page: parseInt(per_page),
      type,
      status,
      order: 'desc',
      orderby: 'date_created'
    };

    if (search) params.search = search;

    const groups = await buddyBossService.getGroups(params, req.token);

    res.json({
      success: true,
      message: 'Groups retrieved successfully',
      data: {
        groups: groups.map(group => ({
          id: group.id,
          creatorId: group.creator_id,
          name: group.name,
          slug: group.slug,
          description: group.description,
          status: group.status,
          enableForum: group.enable_forum,
          dateCreated: group.date_created,
          totalMemberCount: group.total_member_count,
          lastActivity: group.last_activity,
          creator: group.creator,
          admins: group.admins,
          mods: group.mods,
          avatarUrls: group.avatar_urls,
          coverUrl: group.cover_url,
          isUserMember: group.is_user_member,
          isUserAdmin: group.is_user_admin,
          isUserMod: group.is_user_mod,
          isUserBanned: group.is_user_banned
        }))
      }
    });
  } catch (error) {
    console.error('Get groups error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve groups'
    });
  }
});

/**
 * POST /api/social/groups/:id/join
 * Join a group
 */
router.post('/groups/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await buddyBossService.joinGroup(id, req.user.id, req.token);

    res.json({
      success: true,
      message: 'Successfully joined group',
      data: {
        membership: result
      }
    });
  } catch (error) {
    console.error('Join group error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to join group'
    });
  }
});

/**
 * DELETE /api/social/groups/:id/leave
 * Leave a group
 */
router.delete('/groups/:id/leave', async (req, res) => {
  try {
    const { id } = req.params;
    
    await buddyBossService.leaveGroup(id, req.user.id, req.token);

    res.json({
      success: true,
      message: 'Successfully left group'
    });
  } catch (error) {
    console.error('Leave group error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to leave group'
    });
  }
});

/**
 * GET /api/social/groups/:id/members
 * Get group members
 */
router.get('/groups/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    
    const members = await buddyBossService.getGroupMembers(id, req.token);

    res.json({
      success: true,
      message: 'Group members retrieved successfully',
      data: {
        members: members.map(member => ({
          id: member.id,
          userId: member.user_id,
          groupId: member.group_id,
          isAdmin: member.is_admin,
          isMod: member.is_mod,
          isBanned: member.is_banned,
          dateModified: member.date_modified,
          user: member.user
        }))
      }
    });
  } catch (error) {
    console.error('Get group members error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve group members'
    });
  }
});

module.exports = router;
