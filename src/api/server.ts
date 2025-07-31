import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { MakerService } from './makerService';
import { ordersRouter } from './routes/orders';
// import { validationMiddleware } from './middleware/validation';
import { getNetworkConfig } from '../../scripts/utils/networkConfig';
import { ethers } from 'hardhat';

export interface ServerConfig {
  port: number;
  network: string;
  corsOrigins?: string[];
  enableLogging?: boolean;
}

export class DemoAPIServer {
  private app: Application;
  private makerService?: MakerService;
  private config: ServerConfig;
  private server?: any;

  constructor(config: ServerConfig = { port: 3000, network: 'localhost' }) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    // Note: setupRoutes() will be called after MakerService is initialized
  }

  private setupMiddleware(): void {
    // CORS configuration
    const corsOptions = {
      origin: this.config.corsOrigins || ['http://localhost:3000', 'http://localhost:8080'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    };
    
    this.app.use(cors(corsOptions));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    if (this.config.enableLogging !== false) {
      this.app.use((req: Request, res: Response, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
      });
    }

    // Validation middleware
    // this.app.use(validationMiddleware);
  }

  private setupRoutes(): void {
    if (!this.makerService) {
      throw new Error('MakerService must be initialized before setting up routes');
    }

    // Health check endpoint
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        network: this.config.network,
        service: 'DarkSwap Maker Service'
      });
    });

    // Orders router with all order-related endpoints
    this.app.use('/api', ordersRouter(this.makerService));

    // Error handling middleware
    this.app.use((error: any, req: Request, res: Response, next: any) => {
      console.error('API Error:', error);
      
      const statusCode = error.statusCode || 500;
      const message = error.message || 'Internal server error';
      
      res.status(statusCode).json({
        error: {
          message,
          code: statusCode,
          timestamp: new Date().toISOString(),
          path: req.path
        }
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: {
          message: 'Endpoint not found',
          code: 404,
          timestamp: new Date().toISOString(),
          path: req.path
        }
      });
    });
  }

  async initialize(): Promise<void> {
    try {
      console.log(`Initializing DemoAPIServer for network: ${this.config.network}`);
      
      // Get network configuration
      const networkConfig = getNetworkConfig(this.config.network);
      console.log(`Network config:`, networkConfig);

      // Initialize the MakerService with the router address and chain ID
      console.log(`Creating MakerService with router: ${networkConfig.routerAddress}`);
      this.makerService = new MakerService(networkConfig.routerAddress, BigInt(networkConfig.chainId));
      
      // Initialize the MakerService with deployed contracts
      await this.makerService.initialize();
      
      // Now that MakerService is ready, set up the routes
      this.setupRoutes();
      
      console.log('✅ MakerService initialized successfully');
      console.log('✅ DemoAPIServer ready to start');
      
    } catch (error) {
      console.error('❌ Failed to initialize DemoAPIServer:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.makerService) {
      throw new Error('Server must be initialized before starting');
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          console.log(`\n🚀 DarkSwap Maker Service API is running!`);
          console.log(`📡 Server: http://localhost:${this.config.port}`);
          console.log(`🌐 Network: ${this.config.network}`);
          console.log(`\n📚 Available endpoints:`);
          console.log(`  GET  /api/health          - Service health check`);
          console.log(`  GET  /api/orders          - List published orders`);
          console.log(`  POST /api/authorize-fill  - Request ZK proof for order fill`);
          console.log(`\n💡 Test the service:`);
          console.log(`  curl http://localhost:${this.config.port}/api/health`);
          console.log(`  curl http://localhost:${this.config.port}/api/orders`);
          console.log(`\n✨ Ready to process maker authorization requests!`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`❌ Port ${this.config.port} is already in use`);
            console.log(`💡 Try a different port or stop the existing service`);
          } else {
            console.error('❌ Server error:', error);
          }
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 DemoAPIServer stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getApp(): Application {
    return this.app;
  }

  getMakerService(): MakerService | undefined {
    return this.makerService;
  }
} 