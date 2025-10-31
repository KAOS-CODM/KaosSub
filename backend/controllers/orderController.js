const supabase = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/response');

class OrderController {
  // Get user orders
  async getUserOrders(req, res) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          networks (name),
          data_plans (name, price, validity)
        `)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return successResponse(res, 'Orders retrieved successfully', orders);

    } catch (error) {
      console.error('Orders error:', error);
      return errorResponse(res, error.message, 500);
    }
  }
}

module.exports = new OrderController();
