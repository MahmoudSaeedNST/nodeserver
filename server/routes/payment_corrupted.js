const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const TutorLMSService = require('../services/tutorLMSService');
const WooCommerceService = require('../services/wooCommerceService');

// Initialize services
const tutorLMSService = new TutorLMSService();
const wooCommerceService = new WooCommerceService();

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

    // Check if user is already enrolled
    const enrollmentStatus = await tutorLMSService.checkEnrollmentStatus(course_id, user_id);
    if (enrollmentStatus.is_enrolled) {
      return res.status(400).json({
        success: false,
        message: 'User is already enrolled in this course',
        error_code: 'ALREADY_ENROLLED'
      });
    }

    // Create payment order via WordPress
    const orderData = {
      course_id: course_id,
      user_id: user_id,
      payment_method: payment_method
    };

    const orderResult = await wooCommerceService.createCourseOrder(orderData);

    if (!orderResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment order',
        error_code: 'ORDER_CREATION_FAILED',
        details: orderResult.message
      });
    }

    res.json({
      success: true,
      data: {
        order_id: orderResult.data.order_id,
        order_key: orderResult.data.order_key,
        order_total: orderResult.data.order_total,
        payment_url: orderResult.data.payment_url,
        payment_method: payment_method,
        course_id: course_id,
        course_title: course.title,
        course_price: course.price,
        currency: orderResult.data.currency || 'USD'
      },
      message: 'Payment order created successfully'
    });

  } catch (error) {
    console.error('Failed to create payment order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error_code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /api/payment/verify
 * Verify payment and enroll user in course
 */
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { order_id, course_id } = req.body;
    const user_id = req.user.id;

    if (!order_id || !course_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and Course ID are required',
        error_code: 'MISSING_PARAMETERS'
      });
    }

    // Set auth token for services
    tutorLMSService.setAuthToken(req.user.token);
    wooCommerceService.setAuthToken(req.user.token);

    console.log(`Verifying payment for order ${order_id}, course ${course_id}, user ${user_id}`);

    // Verify payment via WordPress
    const verificationData = {
      order_id: order_id,
      course_id: course_id,
      user_id: user_id
    };

    const verificationResult = await wooCommerceService.verifyPaymentAndEnroll(verificationData);

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: verificationResult.message,
        error_code: verificationResult.error_code || 'VERIFICATION_FAILED',
        order_status: verificationResult.order_status
      });
    }

    // Clear any cached enrollment data
    await tutorLMSService.clearUserCaches(user_id);

    res.json({
      success: true,
      data: {
        enrollment_status: verificationResult.data.enrollment_status,
        course_id: course_id,
        user_id: user_id,
        order_id: order_id,
        enrollment_date: verificationResult.data.enrollment_date
      },
      message: 'Payment verified and enrollment completed successfully'
    });

  } catch (error) {
    console.error('Failed to verify payment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error_code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * GET /api/payment/order-status/:order_id
 * Get payment order status
 */
router.get('/order-status/:order_id', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    const user_id = req.user.id;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
        error_code: 'MISSING_ORDER_ID'
      });
    }

    // Set auth token for services
    wooCommerceService.setAuthToken(req.user.token);

    console.log(`Getting order status for order ${order_id} by user ${user_id}`);

    const orderStatus = await wooCommerceService.getOrderStatus(order_id);

    if (!orderStatus.success) {
      return res.status(404).json({
        success: false,
        message: orderStatus.message,
        error_code: orderStatus.error_code || 'ORDER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: orderStatus.data,
      message: 'Order status retrieved successfully'
    });

  } catch (error) {
    console.error('Failed to get order status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error_code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /api/payment/webhook
 * Handle payment webhooks from external processors
 */
router.post('/webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    const signature = req.headers['x-webhook-signature'] || req.headers['stripe-signature'];

    console.log('Payment webhook received:', webhookData);

    // Verify webhook signature (implementation depends on payment processor)
    if (!verifyWebhookSignature(webhookData, signature)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    // Process webhook via WordPress
    wooCommerceService.setAuthToken(null); // Webhooks don't use user auth
    const webhookResult = await wooCommerceService.handlePaymentWebhook(webhookData);

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      result: webhookResult
    });

  } catch (error) {
    console.error('Failed to process webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      details: error.message
    });
  }
});

/**
 * GET /api/payment/course-pricing/:course_id
 * Get course pricing information
 */
router.get('/course-pricing/:course_id', async (req, res) => {
  try {
    const { course_id } = req.params;

    if (!course_id) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required',
        error_code: 'MISSING_COURSE_ID'
      });
    }

    console.log(`Getting pricing for course ${course_id}`);

    const pricingResult = await wooCommerceService.getCoursePricing(course_id);

    if (!pricingResult.success) {
      return res.status(404).json({
        success: false,
        message: pricingResult.message,
        error_code: pricingResult.error_code || 'COURSE_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: pricingResult.data,
      message: 'Course pricing retrieved successfully'
    });

  } catch (error) {
    console.error('Failed to get course pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error_code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /api/payment/enroll-free
 * Enroll in free course (no payment required)
 */
router.post('/enroll-free', authenticateToken, async (req, res) => {
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

    // Set auth token for services
    tutorLMSService.setAuthToken(req.user.token);

    console.log(`Enrolling user ${user_id} in free course ${course_id}`);

    // Get course details
    const course = await tutorLMSService.getCourseById(course_id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
        error_code: 'COURSE_NOT_FOUND'
      });
    }

    // Check if course is actually free
    if (!course.is_free && course.price > 0) {
      return res.status(400).json({
        success: false,
        message: 'Course is not free, payment required',
        error_code: 'PAYMENT_REQUIRED',
        course_price: course.price
      });
    }

    // Check if user is already enrolled
    const enrollmentStatus = await tutorLMSService.checkEnrollmentStatus(course_id, user_id);
    if (enrollmentStatus.is_enrolled) {
      return res.status(400).json({
        success: false,
        message: 'User is already enrolled in this course',
        error_code: 'ALREADY_ENROLLED'
      });
    }

    // Enroll user in free course
    const enrollmentResult = await tutorLMSService.enrollInCourse(course_id, user_id);

    if (!enrollmentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to enroll in course',
        error_code: 'ENROLLMENT_FAILED',
        details: enrollmentResult.message
      });
    }

    // Clear any cached data
    await tutorLMSService.clearUserCaches(user_id);

    res.json({
      success: true,
      data: {
        enrollment_status: 'enrolled',
        course_id: course_id,
        user_id: user_id,
        enrollment_date: new Date().toISOString()
      },
      message: 'Successfully enrolled in free course'
    });

  } catch (error) {
    console.error('Failed to enroll in free course:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error_code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * Verify webhook signature (placeholder - implement based on payment processor)
 */
function verifyWebhookSignature(data, signature) {
  // This should be implemented based on your payment processor
  // For Stripe, you'd verify using their webhook secret
  // For PayPal, you'd verify using their IPN verification
  
  if (!signature) {
    return false; // In production, always require signature
  }
  
  // Placeholder verification - implement actual signature verification
  return true;
}

module.exports = router;
