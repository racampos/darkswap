import { DemoAPIServer, ServerConfig } from '../src/api/server';
import { getNetworkConfig } from './utils/networkConfig';
import { OrderStorage } from '../src/storage/orderStorage';
import { buildOrderData } from '../test/helpers/orderUtils';
import { ethers } from 'hardhat';

interface StartupOptions {
  port?: number;
  network?: string;
  enableLogging?: boolean;
}

/**
 * Load published orders from storage and register them with the MakerService
 * This enables the API to handle authorization requests for existing orders
 */
async function loadAndRegisterPublishedOrders(server: DemoAPIServer, network: string) {
  try {
    console.log(`\n📚 Loading published orders from storage...`);
    
    const orderStorage = new OrderStorage('storage/published_orders.json');
    const publishedOrders = await orderStorage.getActiveOrders(network);
    
    if (publishedOrders.length === 0) {
      console.log(`   ℹ️  No published orders found for network: ${network}`);
      return;
    }
    
    console.log(`   📋 Found ${publishedOrders.length} published orders to register`);
    
    const makerService = server.getMakerService();
    if (!makerService) {
      console.error(`   ❌ MakerService not available - cannot register orders`);
      return;
    }
    
    const networkConfig = getNetworkConfig(network);
    
    for (const order of publishedOrders) {
      try {
        // Calculate order hash
        const orderData = buildOrderData(
          BigInt(networkConfig.chainId), 
          networkConfig.routerAddress, 
          order.orderData
        );
        const orderHash = ethers.TypedDataEncoder.hash(orderData.domain, orderData.types, orderData.value);
        
        // Reconstruct order parameters
        const orderParameters = {
          maker: order.metadata.maker,
          makerAsset: order.metadata.makerAsset,
          takerAsset: order.metadata.takerAsset,
          makingAmount: BigInt(order.metadata.makingAmount),
          takingAmount: BigInt(order.metadata.takingAmount),
          commitment: order.commitment,
          originalSalt: order.metadata.originalSalt
        };
        
        // Load the real secrets from storage (convert strings back to BigInt)
        const secrets = {
          secretPrice: BigInt(order.secrets.secretPrice),
          secretAmount: BigInt(order.secrets.secretAmount),
          nonce: BigInt(order.secrets.nonce),
          maker: order.secrets.maker
        };
        
        // Register the order with the MakerService
        makerService.registerOrder(
          order.commitment,
          orderParameters,
          secrets,
          orderHash
        );
        
        console.log(`   ✅ Registered order: ${order.id} (${orderHash.slice(0, 20)}...)`);
        
      } catch (error) {
        console.error(`   ❌ Failed to register order ${order.id}:`, error);
      }
    }
    
    console.log(`   🎯 Order registration complete`);
    
  } catch (error) {
    console.error(`   ❌ Failed to load published orders:`, error);
    // Don't fail the entire service - just log the error
  }
}

async function startMakerService(options: StartupOptions = {}) {
  const {
    port = 3000,
    network = 'localhost',
    enableLogging = true
  } = options;

  try {
    console.log(`\n🚀 Starting DarkSwap Maker Service`);
    console.log(`============================================`);
    console.log(`📡 Port: ${port}`);
    console.log(`🌐 Network: ${network}`);
    console.log(`📝 Logging: ${enableLogging ? 'enabled' : 'disabled'}`);

    // Validate network configuration
    try {
      const networkConfig = getNetworkConfig(network);
      console.log(`✅ Network configuration validated`);
      console.log(`   Chain ID: ${networkConfig.chainId}`);
      console.log(`   Router: ${networkConfig.routerAddress}`);
    } catch (error) {
      console.error(`❌ Invalid network configuration for '${network}':`, error);
      process.exit(1);
    }

    // Create server configuration
    const serverConfig: ServerConfig = {
      port,
      network,
      enableLogging,
      corsOrigins: [
        'http://localhost:3000',
        'http://localhost:8080',
        'http://localhost:3001'
      ]
    };

    // Initialize server
    console.log(`\n⚙️  Initializing server...`);
    const server = new DemoAPIServer(serverConfig);
    
    // Initialize dependencies (MakerService, contracts, etc.)
    await server.initialize();
    
    // Load and register published orders
    await loadAndRegisterPublishedOrders(server, network);

    // Start the server
    console.log(`\n🚀 Starting HTTP server...`);
    await server.start();

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        console.log(`✅ Server shutdown complete`);
        process.exit(0);
      } catch (error) {
        console.error(`❌ Error during shutdown:`, error);
        process.exit(1);
      }
    };

    // Handle termination signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error(`💥 Uncaught Exception:`, error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error(`💥 Unhandled Rejection at:`, promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    console.error(`❌ Failed to start Maker Service:`, error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): StartupOptions {
  const args = process.argv.slice(2);
  const options: StartupOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--port' && i + 1 < args.length) {
      options.port = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--network' && i + 1 < args.length) {
      options.network = args[i + 1];
      i++;
    } else if (arg === '--no-logging') {
      options.enableLogging = false;
    } else if (arg === '--help') {
      console.log(`
DarkSwap Maker Service Startup Script

Usage: npx hardhat run scripts/runMakerService.ts [options]

Options:
  --port <number>     Port to run the server on (default: 3000)
  --network <name>    Network to connect to (default: localhost)
  --no-logging        Disable request logging
  --help              Show this help message

Examples:
  npx hardhat run scripts/runMakerService.ts
  npx hardhat run scripts/runMakerService.ts --port 8080 --network localhost
  npx hardhat run scripts/runMakerService.ts --no-logging

Note: Make sure you have a running Hardhat node if using 'localhost' network:
  npx hardhat node --fork https://eth-mainnet.alchemyapi.io/v2/[YOUR_KEY]
`);
      process.exit(0);
    }
  }

  return options;
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  startMakerService(options).catch((error) => {
    console.error(`💥 Startup failed:`, error);
    process.exit(1);
  });
}

export { startMakerService }; 