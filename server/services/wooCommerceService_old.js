const axios = require('axios');

class WooCommerceService {
  constructor() {
    this.baseUrl = process.env.WORDPRESS_URL || 'https://olomak.com';
    this.apiVersion = 'wc/v3';
    this.consumerKey = process.env.WOO_CONSUMER_KEY;
    this.consumerSecret = process.env.WOO_CONSUMER_SECRET;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Make authenticated request to WooCommerce API
   */
  async makeAuthenticatedRequest(endpoint, options = {}, useAuth = true) {
    try {
      const config = {
        ...options,
        auth: useAuth && this.consumerKey && this.consumerSecret ? {
          username: this.consumerKey,
          password: this.consumerSecret
        } : undefined
      };

      const response = await this.axiosInstance.request({
        url: `/wp-json/${this.apiVersion}/${endpoint}`,
        ...config
      });

      return response.data;
    } catch (error) {
      console.error('WooCommerce API request failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId) {
    return await this.makeAuthenticatedRequest(`customers/${customerId}`, {
      method: 'GET'
    });
  }

  /**
   * Create customer
   */
  async createCustomer(customerData) {
    return await this.makeAuthenticatedRequest('customers', {
      method: 'POST',
      data: customerData
    });
  }

  /**
   * Update customer
   */
  async updateCustomer(customerId, customerData) {
    return await this.makeAuthenticatedRequest(`customers/${customerId}`, {
      method: 'PUT',
      data: customerData
    });
  }

  /**
   * Delete customer
   */
  async deleteCustomer(customerId) {
    return await this.makeAuthenticatedRequest(`customers/${customerId}`, {
      method: 'DELETE',
      data: { force: true }
    });
  }

  /**
   * Get customer orders
   */
  async getCustomerOrders(customerId, params = {}) {
    const queryParams = new URLSearchParams({ customer: customerId, ...params }).toString();
    return await this.makeAuthenticatedRequest(`orders?${queryParams}`, {
      method: 'GET'
    });
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId) {
    return await this.makeAuthenticatedRequest(`orders/${orderId}`, {
      method: 'GET'
    });
  }

  /**
   * Create order
   */
  async createOrder(orderData) {
    return await this.makeAuthenticatedRequest('orders', {
      method: 'POST',
      data: orderData
    });
  }

  /**
   * Update order
   */
  async updateOrder(orderId, orderData) {
    return await this.makeAuthenticatedRequest(`orders/${orderId}`, {
      method: 'PUT',
      data: orderData
    });
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId) {
    return await this.makeAuthenticatedRequest(`orders/${orderId}`, {
      method: 'PUT',
      data: { status: 'cancelled' }
    });
  }

  /**
   * Get products
   */
  async getProducts(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return await this.makeAuthenticatedRequest(`products${queryParams ? '?' + queryParams : ''}`, {
      method: 'GET'
    });
  }

  /**
   * Get product by ID
   */
  async getProduct(productId) {
    return await this.makeAuthenticatedRequest(`products/${productId}`, {
      method: 'GET'
    });
  }

  /**
   * Get product categories
   */
  async getProductCategories(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return await this.makeAuthenticatedRequest(`products/categories${queryParams ? '?' + queryParams : ''}`, {
      method: 'GET'
    });
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods() {
    return await this.makeAuthenticatedRequest('payment_gateways', {
      method: 'GET'
    });
  }

  /**
   * Get shipping methods
   */
  async getShippingMethods() {
    return await this.makeAuthenticatedRequest('shipping_methods', {
      method: 'GET'
    });
  }

  /**
   * Get cart contents (requires custom endpoint)
   */
  async getCart(sessionKey) {
    return await this.makeAuthenticatedRequest(`cart/${sessionKey}`, {
      method: 'GET'
    });
  }

  /**
   * Add item to cart (requires custom endpoint)
   */
  async addToCart(sessionKey, productId, quantity = 1, variation = {}) {
    return await this.makeAuthenticatedRequest('cart/add-item', {
      method: 'POST',
      data: {
        session_key: sessionKey,
        product_id: productId,
        quantity: quantity,
        variation: variation
      }
    });
  }

  /**
   * Update cart item (requires custom endpoint)
   */
  async updateCartItem(sessionKey, itemKey, quantity) {
    return await this.makeAuthenticatedRequest('cart/update-item', {
      method: 'POST',
      data: {
        session_key: sessionKey,
        item_key: itemKey,
        quantity: quantity
      }
    });
  }

  /**
   * Remove cart item (requires custom endpoint)
   */
  async removeCartItem(sessionKey, itemKey) {
    return await this.makeAuthenticatedRequest('cart/remove-item', {
      method: 'POST',
      data: {
        session_key: sessionKey,
        item_key: itemKey
      }
    });
  }

  /**
   * Clear cart (requires custom endpoint)
   */
  async clearCart(sessionKey) {
    return await this.makeAuthenticatedRequest('cart/clear', {
      method: 'POST',
      data: {
        session_key: sessionKey
      }
    });
  }

  /**
   * Process payment (requires custom endpoint)
   */
  async processPayment(paymentData) {
    return await this.makeAuthenticatedRequest('checkout/process-payment', {
      method: 'POST',
      data: paymentData
    });
  }

  /**
   * Get coupons
   */
  async getCoupons(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return await this.makeAuthenticatedRequest(`coupons${queryParams ? '?' + queryParams : ''}`, {
      method: 'GET'
    });
  }

  /**
   * Apply coupon (requires custom endpoint)
   */
  async applyCoupon(sessionKey, couponCode) {
    return await this.makeAuthenticatedRequest('cart/apply-coupon', {
      method: 'POST',
      data: {
        session_key: sessionKey,
        coupon_code: couponCode
      }
    });
  }

  /**
   * Remove coupon (requires custom endpoint)
   */
  async removeCoupon(sessionKey, couponCode) {
    return await this.makeAuthenticatedRequest('cart/remove-coupon', {
      method: 'POST',
      data: {
        session_key: sessionKey,
        coupon_code: couponCode
      }
    });
  }

  /**
   * Get tax rates
   */
  async getTaxRates(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return await this.makeAuthenticatedRequest(`taxes${queryParams ? '?' + queryParams : ''}`, {
      method: 'GET'
    });
  }

  /**
   * Calculate shipping (requires custom endpoint)
   */
  async calculateShipping(shippingData) {
    return await this.makeAuthenticatedRequest('shipping/calculate', {
      method: 'POST',
      data: shippingData
    });
  }

  /**
   * Get customer downloads
   */
  async getCustomerDownloads(customerId) {
    return await this.makeAuthenticatedRequest(`customers/${customerId}/downloads`, {
      method: 'GET'
    });
  }

  /**
   * Get subscription (if WooCommerce Subscriptions is active)
   */
  async getSubscription(subscriptionId) {
    return await this.makeAuthenticatedRequest(`subscriptions/${subscriptionId}`, {
      method: 'GET'
    });
  }

  /**
   * Get customer subscriptions (if WooCommerce Subscriptions is active)
   */
  async getCustomerSubscriptions(customerId, params = {}) {
    const queryParams = new URLSearchParams({ customer: customerId, ...params }).toString();
    return await this.makeAuthenticatedRequest(`subscriptions?${queryParams}`, {
      method: 'GET'
    });
  }

  /**
   * Update subscription (if WooCommerce Subscriptions is active)
   */
  async updateSubscription(subscriptionId, subscriptionData) {
    return await this.makeAuthenticatedRequest(`subscriptions/${subscriptionId}`, {
      method: 'PUT',
      data: subscriptionData
    });
  }

  /**
   * Cancel subscription (if WooCommerce Subscriptions is active)
   */
  async cancelSubscription(subscriptionId) {
    return await this.makeAuthenticatedRequest(`subscriptions/${subscriptionId}`, {
      method: 'PUT',
      data: { status: 'cancelled' }
    });
  }

  /**
   * Get refunds for an order
   */
  async getOrderRefunds(orderId) {
    return await this.makeAuthenticatedRequest(`orders/${orderId}/refunds`, {
      method: 'GET'
    });
  }

  /**
   * Create refund for an order
   */
  async createRefund(orderId, refundData) {
    return await this.makeAuthenticatedRequest(`orders/${orderId}/refunds`, {
      method: 'POST',
      data: refundData
    });
  }

  /**
   * Get reports
   */
  async getReports(reportType, params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return await this.makeAuthenticatedRequest(`reports/${reportType}${queryParams ? '?' + queryParams : ''}`, {
      method: 'GET'
    });
  }
}

module.exports = new WooCommerceService();
