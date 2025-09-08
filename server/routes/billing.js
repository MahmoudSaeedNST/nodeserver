const express = require('express');
const Joi = require('joi');
const wooCommerceService = require('../services/wooCommerceService');

const router = express.Router();

// Validation schemas
const updateBillingSchema = Joi.object({
  billing: Joi.object({
    first_name: Joi.string().optional().max(50),
    last_name: Joi.string().optional().max(50),
    company: Joi.string().optional().max(100),
    address_1: Joi.string().optional().max(100),
    address_2: Joi.string().optional().max(100),
    city: Joi.string().optional().max(50),
    state: Joi.string().optional().max(50),
    postcode: Joi.string().optional().max(20),
    country: Joi.string().optional().max(2),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional().max(20)
  }).optional(),
  shipping: Joi.object({
    first_name: Joi.string().optional().max(50),
    last_name: Joi.string().optional().max(50),
    company: Joi.string().optional().max(100),
    address_1: Joi.string().optional().max(100),
    address_2: Joi.string().optional().max(100),
    city: Joi.string().optional().max(50),
    state: Joi.string().optional().max(50),
    postcode: Joi.string().optional().max(20),
    country: Joi.string().optional().max(2)
  }).optional()
});

const createOrderSchema = Joi.object({
  payment_method: Joi.string().required(),
  payment_method_title: Joi.string().required(),
  set_paid: Joi.boolean().optional(),
  billing: Joi.object().required(),
  shipping: Joi.object().optional(),
  line_items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().required(),
      quantity: Joi.number().min(1).required(),
      variation_id: Joi.number().optional()
    })
  ).required(),
  shipping_lines: Joi.array().optional(),
  coupon_lines: Joi.array().optional()
});

/**
 * GET /api/billing/customer
 * Get customer billing information
 */
router.get('/customer', async (req, res) => {
  try {
    // Assuming user.id corresponds to WooCommerce customer ID
    const customer = await wooCommerceService.getCustomer(req.user.id);

    res.json({
      success: true,
      message: 'Customer information retrieved successfully',
      data: {
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          username: customer.username,
          billing: customer.billing,
          shipping: customer.shipping,
          isPayingCustomer: customer.is_paying_customer,
          ordersCount: customer.orders_count,
          totalSpent: customer.total_spent,
          avatarUrl: customer.avatar_url,
          role: customer.role,
          dateCreated: customer.date_created,
          dateModified: customer.date_modified
        }
      }
    });
  } catch (error) {
    console.error('Get customer error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer information'
    });
  }
});

/**
 * PUT /api/billing/customer
 * Update customer billing information
 */
router.put('/customer', async (req, res) => {
  try {
    const { error, value } = updateBillingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const updatedCustomer = await wooCommerceService.updateCustomer(req.user.id, value);

    res.json({
      success: true,
      message: 'Customer information updated successfully',
      data: {
        customer: {
          id: updatedCustomer.id,
          email: updatedCustomer.email,
          firstName: updatedCustomer.first_name,
          lastName: updatedCustomer.last_name,
          billing: updatedCustomer.billing,
          shipping: updatedCustomer.shipping,
          dateModified: updatedCustomer.date_modified
        }
      }
    });
  } catch (error) {
    console.error('Update customer error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update customer information'
    });
  }
});

/**
 * GET /api/billing/user/orders
 * Get user orders (alternative endpoint for payment service)
 */
router.get('/user/orders', async (req, res) => {
  try {
    const { page = 1, per_page = 20, status } = req.query;
    
    console.log(`Getting user orders - Page: ${page}, Per page: ${per_page}, Status: ${status || 'all'}`);

    const params = {
      page: parseInt(page),
      per_page: parseInt(per_page),
      order: 'desc',
      orderby: 'date'
    };
    
    if (status && status !== 'all') {
      params.status = status;
    }

    const orders = await wooCommerceService.getCustomerOrders(req.user.id, params);
    
    res.json({
      success: true,
      data: orders.data || orders,
      total: orders.total || 0,
      total_pages: orders.total_pages || Math.ceil((orders.total || 0) / parseInt(per_page)),
      message: 'User orders retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user orders',
      error: error.message
    });
  }
});

/**
 * GET /api/billing/order/:id
 * Get single order details (alternative endpoint for payment service)
 */
router.get('/order/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Getting order details for order ${id}`);

    const order = await wooCommerceService.getOrder(id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
        error_code: 'ORDER_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: order,
      message: 'Order details retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  }
});

/**
 * GET /api/billing/user/billing
 * Get user billing information (alternative endpoint for payment service)
 */
router.get('/user/billing', async (req, res) => {
  try {
    console.log('Getting user billing information');

    const customer = await wooCommerceService.getCustomer(req.user.id);
    
    res.json({
      success: true,
      data: {
        billing: customer.billing,
        shipping: customer.shipping
      },
      message: 'User billing information retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user billing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user billing information',
      error: error.message
    });
  }
});

/**
 * POST /api/billing/user/billing
 * Update user billing information (alternative endpoint for payment service)
 */
router.post('/user/billing', async (req, res) => {
  try {
    const billingData = req.body;
    
    console.log('Updating user billing information');

    const updatedCustomer = await wooCommerceService.updateCustomer(req.user.id, billingData);
    
    res.json({
      success: true,
      data: {
        billing: updatedCustomer.billing,
        shipping: updatedCustomer.shipping
      },
      message: 'User billing information updated successfully'
    });
  } catch (error) {
    console.error('Error updating user billing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user billing information',
      error: error.message
    });
  }
});

/**
 * GET /api/billing/user/subscriptions
 * Get user subscriptions (alternative endpoint for payment service)
 */
router.get('/user/subscriptions', async (req, res) => {
  try {
    console.log('Getting user subscriptions');

    const subscriptions = await wooCommerceService.getCustomerSubscriptions(req.user.id);
    
    res.json({
      success: true,
      data: subscriptions.data || subscriptions || [],
      message: 'User subscriptions retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user subscriptions',
      error: error.message
    });
  }
});

/**
 * GET /api/billing/user/payment-methods
 * Get user payment methods (alternative endpoint for payment service)
 */
router.get('/user/payment-methods', async (req, res) => {
  try {
    console.log('Getting user payment methods');

    const paymentMethods = await wooCommerceService.getCustomerPaymentMethods(req.user.id);
    
    res.json({
      success: true,
      data: paymentMethods.data || paymentMethods || [],
      message: 'User payment methods retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user payment methods',
      error: error.message
    });
  }
});

/**
 * POST /api/billing/user/payment-methods
 * Add user payment method (alternative endpoint for payment service)
 */
router.post('/user/payment-methods', async (req, res) => {
  try {
    const paymentMethodData = req.body;
    
    console.log('Adding user payment method');

    const result = await wooCommerceService.addCustomerPaymentMethod(req.user.id, paymentMethodData);
    
    res.json({
      success: true,
      data: result,
      message: 'Payment method added successfully'
    });
  } catch (error) {
    console.error('Error adding payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add payment method',
      error: error.message
    });
  }
});

/**
 * DELETE /api/billing/user/payment-methods/:id
 * Remove user payment method (alternative endpoint for payment service)
 */
router.delete('/user/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Removing user payment method ${id}`);

    const result = await wooCommerceService.removeCustomerPaymentMethod(req.user.id, id);
    
    res.json({
      success: true,
      data: result,
      message: 'Payment method removed successfully'
    });
  } catch (error) {
    console.error('Error removing payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove payment method',
      error: error.message
    });
  }
});

/**
 * GET /api/billing/orders
 * Get customer orders
 */
router.get('/orders', async (req, res) => {
  try {
    const { page = 1, per_page = 10, status } = req.query;
    
    const params = {
      page: parseInt(page),
      per_page: parseInt(per_page),
      order: 'desc',
      orderby: 'date'
    };

    if (status) {
      params.status = status;
    }

    const orders = await wooCommerceService.getCustomerOrders(req.user.id, params);

    res.json({
      success: true,
      message: 'Orders retrieved successfully',
      data: {
        orders: orders.map(order => ({
          id: order.id,
          number: order.number,
          status: order.status,
          currency: order.currency,
          total: order.total,
          totalTax: order.total_tax,
          dateCreated: order.date_created,
          dateModified: order.date_modified,
          lineItems: order.line_items,
          billing: order.billing,
          shipping: order.shipping,
          paymentMethod: order.payment_method,
          paymentMethodTitle: order.payment_method_title,
          transactionId: order.transaction_id
        }))
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders'
    });
  }
});

/**
 * GET /api/billing/orders/:id
 * Get specific order details
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await wooCommerceService.getOrder(id);

    // Verify order belongs to current user
    if (order.customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this order'
      });
    }

    res.json({
      success: true,
      message: 'Order details retrieved successfully',
      data: {
        order: {
          id: order.id,
          number: order.number,
          status: order.status,
          currency: order.currency,
          total: order.total,
          subtotal: order.subtotal,
          totalTax: order.total_tax,
          shippingTotal: order.shipping_total,
          discountTotal: order.discount_total,
          dateCreated: order.date_created,
          dateModified: order.date_modified,
          datePaid: order.date_paid,
          dateCompleted: order.date_completed,
          lineItems: order.line_items,
          taxLines: order.tax_lines,
          shippingLines: order.shipping_lines,
          feeLines: order.fee_lines,
          couponLines: order.coupon_lines,
          billing: order.billing,
          shipping: order.shipping,
          paymentMethod: order.payment_method,
          paymentMethodTitle: order.payment_method_title,
          transactionId: order.transaction_id,
          customerNote: order.customer_note,
          refunds: order.refunds
        }
      }
    });
  } catch (error) {
    console.error('Get order details error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order details'
    });
  }
});

/**
 * POST /api/billing/orders
 * Create a new order
 */
router.post('/orders', async (req, res) => {
  try {
    const { error, value } = createOrderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const orderData = {
      ...value,
      customer_id: req.user.id,
      status: 'pending'
    };

    const newOrder = await wooCommerceService.createOrder(orderData);

    res.json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: {
          id: newOrder.id,
          number: newOrder.number,
          status: newOrder.status,
          total: newOrder.total,
          currency: newOrder.currency,
          dateCreated: newOrder.date_created,
          paymentUrl: newOrder.payment_url
        }
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to create order'
    });
  }
});

/**
 * PUT /api/billing/orders/:id/cancel
 * Cancel an order
 */
router.put('/orders/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First verify the order belongs to the user
    const order = await wooCommerceService.getOrder(id);
    if (order.customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this order'
      });
    }

    // Check if order can be cancelled
    if (!['pending', 'processing', 'on-hold'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled in its current status'
      });
    }

    const cancelledOrder = await wooCommerceService.cancelOrder(id);

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        order: {
          id: cancelledOrder.id,
          status: cancelledOrder.status,
          dateModified: cancelledOrder.date_modified
        }
      }
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order'
    });
  }
});

/**
 * GET /api/billing/subscriptions
 * Get customer subscriptions
 */
router.get('/subscriptions', async (req, res) => {
  try {
    const { page = 1, per_page = 10, status } = req.query;
    
    const params = {
      page: parseInt(page),
      per_page: parseInt(per_page),
      order: 'desc',
      orderby: 'date'
    };

    if (status) {
      params.status = status;
    }

    const subscriptions = await wooCommerceService.getCustomerSubscriptions(req.user.id, params);

    res.json({
      success: true,
      message: 'Subscriptions retrieved successfully',
      data: {
        subscriptions: subscriptions.map(subscription => ({
          id: subscription.id,
          status: subscription.status,
          currency: subscription.currency,
          total: subscription.total,
          billingPeriod: subscription.billing_period,
          billingInterval: subscription.billing_interval,
          startDate: subscription.start_date,
          nextPaymentDate: subscription.next_payment_date,
          endDate: subscription.end_date,
          trialEndDate: subscription.trial_end_date,
          lineItems: subscription.line_items,
          paymentMethod: subscription.payment_method,
          paymentMethodTitle: subscription.payment_method_title
        }))
      }
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscriptions'
    });
  }
});

/**
 * PUT /api/billing/subscriptions/:id/cancel
 * Cancel a subscription
 */
router.put('/subscriptions/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First verify the subscription belongs to the user
    const subscription = await wooCommerceService.getSubscription(id);
    if (subscription.customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this subscription'
      });
    }

    const cancelledSubscription = await wooCommerceService.cancelSubscription(id);

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: {
        subscription: {
          id: cancelledSubscription.id,
          status: cancelledSubscription.status,
          endDate: cancelledSubscription.end_date,
          dateModified: cancelledSubscription.date_modified
        }
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
});

/**
 * GET /api/billing/payment-methods
 * Get available payment methods
 */
router.get('/payment-methods', async (req, res) => {
  try {
    const paymentMethods = await wooCommerceService.getPaymentMethods();

    res.json({
      success: true,
      message: 'Payment methods retrieved successfully',
      data: {
        paymentMethods: paymentMethods.filter(method => method.enabled).map(method => ({
          id: method.id,
          title: method.title,
          description: method.description,
          order: method.order,
          enabled: method.enabled,
          methodTitle: method.method_title,
          methodDescription: method.method_description,
          settings: method.settings
        }))
      }
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment methods'
    });
  }
});

/**
 * GET /api/billing/downloads
 * Get customer downloadable products
 */
router.get('/downloads', async (req, res) => {
  try {
    const downloads = await wooCommerceService.getCustomerDownloads(req.user.id);

    res.json({
      success: true,
      message: 'Downloads retrieved successfully',
      data: {
        downloads: downloads.map(download => ({
          downloadId: download.download_id,
          downloadUrl: download.download_url,
          productId: download.product_id,
          productName: download.product_name,
          downloadName: download.download_name,
          orderId: download.order_id,
          orderKey: download.order_key,
          downloadsRemaining: download.downloads_remaining,
          accessExpires: download.access_expires,
          file: download.file
        }))
      }
    });
  } catch (error) {
    console.error('Get downloads error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve downloads'
    });
  }
});

module.exports = router;
