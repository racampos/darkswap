import { Router, Request, Response } from 'express';
import { MakerService } from '../makerService';
import { OrderStorage } from '../../storage/orderStorage';

export interface AuthorizeFillRequest {
  orderHash: string;
  fillAmount: string;
  takerAddress: string;
}

export interface AuthorizeFillResponse {
  success: boolean;
  orderWithExtension?: any;
  signature?: string;
  error?: string;
  timestamp: string;
}

export function ordersRouter(makerService: MakerService): Router {
  const router = Router();
  const orderStorage = new OrderStorage();

  // POST /api/authorize-fill - Request ZK proof for order fill
  router.post('/authorize-fill', async (req: Request, res: Response) => {
    try {
      const { orderHash, fillAmount, takerAddress }: AuthorizeFillRequest = req.body;

      // Validate required parameters
      if (!orderHash || !fillAmount || !takerAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: orderHash, fillAmount, takerAddress',
          timestamp: new Date().toISOString()
        });
      }

      console.log(`📝 Authorization request received:`);
      console.log(`   Order Hash: ${orderHash}`);
      console.log(`   Fill Amount: ${fillAmount}`);
      console.log(`   Taker: ${takerAddress}`);

      // Call MakerService to authorize the fill
      const authResult = await makerService.authorizeFillRequest(
        orderHash,
        BigInt(fillAmount)
      );

      if (authResult.success) {
        console.log(`✅ Authorization successful for ${fillAmount} tokens`);
        
        const response: AuthorizeFillResponse = {
          success: true,
          orderWithExtension: authResult.orderWithExtension,
          signature: authResult.signature,
          timestamp: new Date().toISOString()
        };
        
        // BigInt replacer function for JSON serialization
        const bigIntReplacer = (key: string, value: any) => {
          if (typeof value === 'bigint') {
            return value.toString();
          }
          return value;
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(response, bigIntReplacer, 2));
      } else {
        console.log(`❌ Authorization failed: ${authResult.error}`);
        
        const response: AuthorizeFillResponse = {
          success: false,
          error: authResult.error,
          timestamp: new Date().toISOString()
        };
        
        res.status(403).json(response);
      }

    } catch (error: any) {
      console.error('❌ Authorization endpoint error:', error);
      
      const response: AuthorizeFillResponse = {
        success: false,
        error: error.message || 'Internal server error during authorization',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  });

  // GET /api/orders - List published orders
  router.get('/orders', async (req: Request, res: Response) => {
    try {
      console.log(`📋 Orders list requested`);

      // Parse query parameters for filtering
      const {
        status,
        network,
        maker,
        makerAsset,
        takerAsset,
        limit = '50',
        offset = '0'
      } = req.query;

      // Build filter object
      const filter: any = {};
      if (status) filter.status = status as string;
      if (network) filter.network = network as string;
      if (maker) filter.maker = maker as string;
      if (makerAsset) filter.makerAsset = makerAsset as string;
      if (takerAsset) filter.takerAsset = takerAsset as string;

      const limitNum = parseInt(limit as string) || 50;
      const offsetNum = parseInt(offset as string) || 0;

      // Retrieve orders from storage
      const result = await orderStorage.getOrders(filter);

      console.log(`📊 Found ${result.totalCount} orders (returning ${result.orders.length})`);

      res.json({
        success: true,
        orders: result.orders,
        pagination: {
          total: result.totalCount,
          limit: limitNum,
          offset: offsetNum,
          hasMore: false // TODO: Implement proper pagination
        },
        filters: filter,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Orders endpoint error:', error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error while fetching orders',
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/orders/active/:network - Get active orders for specific network (MUST come before /:id)
  router.get('/orders/active/:network', async (req: Request, res: Response) => {
    try {
      const { network } = req.params;
      console.log(`🌐 Active orders requested for network: ${network}`);

      const activeOrders = await orderStorage.getActiveOrders(network);

      console.log(`📊 Found ${activeOrders.length} active orders for ${network}`);

      res.json({
        success: true,
        orders: activeOrders,
        network,
        count: activeOrders.length,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Active orders endpoint error:', error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error while fetching active orders',
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/orders/:id - Get specific order by ID (MUST come after specific routes)
  router.get('/orders/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log(`🔍 Order requested: ${id}`);

      const order = await orderStorage.getOrderById(id);

      if (!order) {
        console.log(`❌ Order not found: ${id}`);
        return res.status(404).json({
          success: false,
          error: `Order not found: ${id}`,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ Order found: ${order.metadata.maker}`);

      res.json({
        success: true,
        order,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Order by ID endpoint error:', error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error while fetching order',
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
} 