const axios = require('axios');
require('dotenv').config();

class WooCommerceService {
  constructor() {
    this.baseUrl = process.env.WORDPRESS_URL;
    this.authToken = null;
  }

  /**
   * Set authentication token for API requests
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Make authenticated API request to WordPress WooCommerce endpoints
   */
  async apiRequest(endpoint, options = {}) {
    try {
      const config = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      };

      if (this.authToken) {
        config.headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const url = `${this.baseUrl}/wp-json/olomak/v1${endpoint}`;
      console.log(`WooCommerceService: Making request to ${url}`);
      
      const response = await axios({
        url,
        ...config,
      });

      return response.data;
    } catch (error) {
      console.error('WooCommerceService API request failed:', error.response?.data || error.message);
      
      if (error.response?.data) {
        throw new Error(error.response.data.message || 'API request failed');
      }
      throw error;
    }
  }

  // ============ BILLING & CUSTOMER MANAGEMENT ============

  /**
   * Get user billing information
   */
  async getUserBilling(userId) {
    try {
      console.log(`WooCommerceService: Getting billing info for user ${userId}`);

      const response = await this.apiRequest(`/user/${userId}/billing`);

      console.log('WooCommerceService: User billing response:', response);
      return response;
    } catch (error) {
      console.error('WooCommerceService: Failed to get user billing:', error);
      throw error;
    }
  }

  /**
   * Update user billing information
   */
  async updateUserBilling(userId, billingData) {
    try {
      console.log(`WooCommerceService: Updating billing for user ${userId}:`, billingData);

      const response = await this.apiRequest(`/user/${userId}/billing`, {
        method: 'POST',
        data: billingData,
      });

      console.log('WooCommerceService: Billing update response:', response);
      return response;
    } catch (error) {
      console.error('WooCommerceService: Failed to update billing:', error);
      throw error;
    }
  }

  // ============ ORDERS MANAGEMENT ============

  /**
   * Get user orders
   */
  async getUserOrders(userId, params = {}) {
    try {
      console.log(`WooCommerceService: Getting orders for user ${userId}`);

      const queryParams = new URLSearchParams(params).toString();
      const endpoint = `/user/${userId}/orders${queryParams ? `?${queryParams}` : ''}`;
      
      const response = await this.apiRequest(endpoint);

      console.log('WooCommerceService: User orders response:', response);
      return response;
    } catch (error) {
      console.error('WooCommerceService: Failed to get user orders:', error);
      throw error;
    }
  }

  /**
   * Get specific user order
   */
  async getUserOrder(userId, orderId) {
    try {
      console.log(`WooCommerceService: Getting order ${orderId} for user ${userId}`);

      const response = await this.apiRequest(`/user/${userId}/orders/${orderId}`);

      console.log('WooCommerceService: User order response:', response);
      return response;
    } catch (error) {
      console.error('WooCommerceService: Failed to get user order:', error);
      throw error;
    }
  }

  /**
   * Create order for user
   */
  async createUserOrder(userId, orderData) {
    try {
      console.log(`WooCommerceService: Creating order for user ${userId}:`, orderData);

      const response = await this.apiRequest(`/user/${userId}/orders/create`, {
        method: 'POST',
        data: orderData,
      });

      console.log('WooCommerceService: Order creation response:', response);
      return response;
    } catch (error) {
      console.error('WooCommerceService: Failed to create user order:', error);
      throw error;
    }
  }

  // ============ PAYMENT METHODS ============

  /**
   * Get available payment methods
   */
  async getPaymentMethods() {
    try {
      console.log('WooCommerceService: Getting payment methods');

      const response = await this.apiRequest('/woocommerce/payment-methods');

      console.log('WooCommerceService: Payment methods response:', response);
      return response;
    } catch (error) {
      console.error('WooCommerceService: Failed to get payment methods:', error);
      throw error;
    }
  }

  // ============ SUBSCRIPTIONS ============

  /**
   * Get user subscriptions
   */
  async getUserSubscriptions(userId) {
    try {
      console.log(`WooCommerceService: Getting subscriptions for user ${userId}`);

      const response = await this.apiRequest(`/user/${userId}/subscriptions`);

      console.log('WooCommerceService: User subscriptions response:', response);
      return response;
    } catch (error) {
      console.error('WooCommerceService: Failed to get user subscriptions:', error);
      throw error;
    }
  }

  // ============ COURSE PAYMENT INTEGRATION ============

  /**
   * Create course payment order
   */
  async createCoursePaymentOrder(orderData) {
    try {
      console.log('WooCommerceService: Creating course payment order:', orderData);

      const response = await this.apiRequest('/payment/create-course-order', {
        method: 'POST',
        data: orderData,
      });

      console.log('WooCommerceService: Course payment order response:', response);
      return response;
    } catch (error) {
      console.error('WooCommerceService: Failed to create course payment order:', error);
      throw error;
    }
  }

  /**
   * Verify payment and enroll user in course
   */
  async verifyPaymentAndEnroll(verificationData) {
    try {
      console.log('WooCommerceService: Verifying payment and enrolling:', verificationData);

      const response = await this.apiRequest('/payment/verify-and-enroll', {
        method: 'POST',
        data: verificationData,
      });

      console.log('WooCommerceService: Payment verification response:', response);
      return response;
    } catch (error) {
      console.error('WooCommerceService: Failed to verify payment:', error);
      throw error;
    }
  }

  /**
   * Get course pricing information
   */
  async getCoursePricing(courseId) {
    try {
      console.log(`WooCommerceService: Getting pricing for course ${courseId}`);

      const response = await this.apiRequest(`/courses/${courseId}/pricing`);

      console.log('WooCommerceService: Course pricing response:', response);
      return response;
    } catch (error) {
      console.error('WooCommerceService: Failed to get course pricing:', error);
      throw error;
    }
  }

  /**
   * Enroll user in free course
   */
  async enrollInFreeCourse(courseId) {
    try {
      console.log(`WooCommerceService: Enrolling in free course ${courseId}`);

      const response = await this.apiRequest(`/courses/${courseId}/enroll-free`, {
        method: 'POST',
      });

      console.log('WooCommerceService: Free course enrollment response:', response);
      return response;
    } catch (error) {
      console.error('WooCommerceService: Failed to enroll in free course:', error);
      throw error;
    }
  }

  /**
   * Handle payment webhook
   */
  async handlePaymentWebhook(webhookData) {
    try {
      console.log('WooCommerceService: Processing payment webhook:', webhookData);

      const response = await this.apiRequest('/payment/webhook', {
        method: 'POST',
        data: webhookData,
      });

      console.log('WooCommerceService: Webhook processing response:', response);
      return response;
    } catch (error) {
      console.error('WooCommerceService: Failed to process webhook:', error);
      throw error;
    }
  }

  // ============ UTILITY METHODS ============

  /**
   * Validate payment data
   */
  validatePaymentData(data) {
    const required = ['course_id', 'payment_method'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    return true;
  }

  /**
   * Format order response for mobile app
   */
  formatOrderResponse(orderData) {
    return {
      id: orderData.id,
      status: orderData.status,
      total: parseFloat(orderData.total),
      currency: orderData.currency,
      paymentMethod: orderData.paymentMethod,
      dateCreated: orderData.dateCreated,
      items: orderData.lineItems || [],
      billing: orderData.billing || {},
      shipping: orderData.shipping || {}
    };
  }

  /**
   * Format pricing response for mobile app
   */
  formatPricingResponse(pricingData) {
    return {
      courseId: pricingData.course_id,
      isFree: pricingData.is_free,
      price: parseFloat(pricingData.price),
      salePrice: pricingData.sale_price ? parseFloat(pricingData.sale_price) : null,
      currency: pricingData.currency,
      currencySymbol: pricingData.currency_symbol,
      formattedPrice: pricingData.formatted_price,
      woocommerceProduct: pricingData.woocommerce_product
    };
  }

  /**
   * Check if user can access order
   */
  canUserAccessOrder(order, userId) {
    return order.customerId === userId || order.customer_id === userId;
  }

  /**
   * Get order status display name
   */
  getOrderStatusDisplayName(status) {
    const statusMap = {
      'pending': 'Pending Payment',
      'processing': 'Processing',
      'on-hold': 'On Hold',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'refunded': 'Refunded',
      'failed': 'Failed'
    };
    
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
  }

  /**
   * Generate order summary for notifications
   */
  generateOrderSummary(order) {
    const itemCount = order.lineItems ? order.lineItems.length : 0;
    const itemText = itemCount === 1 ? 'item' : 'items';
    
    return `Order #${order.number || order.id} - ${itemCount} ${itemText} - ${order.currency}${order.total}`;
  }

  /**
   * Calculate order taxes (if needed)
   */
  calculateOrderTax(subtotal, taxRate = 0) {
    return subtotal * (taxRate / 100);
  }

  /**
   * Apply discount to order
   */
  applyDiscount(amount, discountPercent) {
    return amount * (1 - discountPercent / 100);
  }
}

module.exports = WooCommerceService;
