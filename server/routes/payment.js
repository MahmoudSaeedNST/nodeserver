const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/payment/create-order
 * Create a payment order for course enrollment - Proxy to WordPress
 */
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const { course_id, payment_method = 'stripe', user_data = {} } = req.body;
    const user_id = req.user.id;

    if (!course_id) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required',
        error_code: 'MISSING_COURSE_ID'
      });
    }

    console.log(`Proxying payment order creation to WordPress for course ${course_id} by user ${user_id}`);

    // Prepare data for WordPress endpoint
    const wordPressData = {
      course_id,
      payment_method,
      user_data: {
        user_id,
        ...user_data
      }
    };

    // Call WordPress endpoint directly
    const response = await fetch(`${process.env.WORDPRESS_URL}/wp-json/olomak/v1/payment/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.user.token}`
      },
      body: JSON.stringify(wordPressData)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('Payment order created successfully via WordPress');
      return res.json(result);
    } else {
      console.error('WordPress payment order creation failed:', result);
      return res.status(response.status || 500).json(result);
    }
  } catch (error) {
    console.error('Error creating payment order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.message
    });
  }
});

/**
 * POST /api/payment/verify-enroll
 * Verify payment and enroll user in course - Proxy to WordPress
 */
router.post('/verify-enroll', authenticateToken, async (req, res) => {
  try {
    const { order_id, course_id, transaction_id } = req.body;
    const user_id = req.user.id;

    if (!order_id || !course_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and Course ID are required',
        error_code: 'MISSING_PARAMETERS'
      });
    }

    console.log(`Proxying payment verification to WordPress for order ${order_id}, course ${course_id}, user ${user_id}`);

    // Prepare data for WordPress endpoint
    const wordPressData = {
      order_id,
      course_id,
      transaction_id,
      user_id
    };

    // Call WordPress endpoint directly
    const response = await fetch(`${process.env.WORDPRESS_URL}/wp-json/olomak/v1/payment/verify-enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.user.token}`
      },
      body: JSON.stringify(wordPressData)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('Payment verification and enrollment successful via WordPress');
      return res.json(result);
    } else {
      console.error('WordPress payment verification failed:', result);
      return res.status(response.status || 500).json(result);
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
});

/**
 * GET /api/payment/course-pricing/:courseId
 * Get course pricing information - Proxy to WordPress
 */
router.get('/course-pricing/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    console.log(`Proxying course pricing request to WordPress for course ${courseId}`);

    // Call WordPress endpoint directly
    const response = await fetch(`${process.env.WORDPRESS_URL}/wp-json/olomak/v1/payment/course-pricing/${courseId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.user.token}`
      }
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('Course pricing retrieved successfully via WordPress');
      return res.json(result);
    } else {
      console.error('WordPress course pricing retrieval failed:', result);
      return res.status(response.status || 500).json(result);
    }
  } catch (error) {
    console.error('Error getting course pricing:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get course pricing',
      error: error.message
    });
  }
});

/**
 * GET /api/payment/methods
 * Get available payment methods - Proxy to WordPress
 */
router.get('/methods', authenticateToken, async (req, res) => {
  try {
    console.log('Proxying payment methods request to WordPress');

    // Call WordPress endpoint directly
    const response = await fetch(`${process.env.WORDPRESS_URL}/wp-json/olomak/v1/payment/methods`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.user.token}`
      }
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('Payment methods retrieved successfully via WordPress');
      return res.json(result);
    } else {
      console.error('WordPress payment methods retrieval failed:', result);
      return res.status(response.status || 500).json(result);
    }
  } catch (error) {
    console.error('Error getting payment methods:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get payment methods',
      error: error.message
    });
  }
});

/**
 * POST /api/payment/free-enroll
 * Enroll in free course - Proxy to WordPress
 */
router.post('/free-enroll', authenticateToken, async (req, res) => {
  try {
    const { course_id } = req.body;
    const user_id = req.user.id;

    if (!course_id) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required',
        error_code: 'MISSING_COURSE_ID'
      });
    }

    console.log(`Proxying free enrollment to WordPress for course ${course_id} by user ${user_id}`);

    // Prepare data for WordPress endpoint
    const wordPressData = {
      course_id,
      user_id
    };

    // Call WordPress endpoint directly
    const response = await fetch(`${process.env.WORDPRESS_URL}/wp-json/olomak/v1/payment/free-enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.user.token}`
      },
      body: JSON.stringify(wordPressData)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('Free enrollment successful via WordPress');
      return res.json(result);
    } else {
      console.error('WordPress free enrollment failed:', result);
      return res.status(response.status || 500).json(result);
    }
  } catch (error) {
    console.error('Error with free enrollment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to enroll in free course',
      error: error.message
    });
  }
});

module.exports = router;
