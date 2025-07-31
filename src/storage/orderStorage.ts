import fs from 'fs';
import path from 'path';
import { 
  PublishedOrder, 
  OrderStorageData, 
  OrderFilter, 
  OrderSearchResult, 
  CreateOrderRequest, 
  UpdateOrderStatusRequest, 
  StorageOperationResult,
  OrderStatus 
} from '../types/orderTypes';

export class OrderStorage {
  private storageFile: string;
  private lockFile: string;
  private readonly STORAGE_VERSION = '1.0.0';

  constructor(storageFilePath: string = 'storage/published_orders.json') {
    this.storageFile = path.resolve(storageFilePath);
    this.lockFile = this.storageFile + '.lock';
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    const dir = path.dirname(this.storageFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private async acquireLock(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    while (attempts < maxAttempts) {
      try {
        fs.writeFileSync(this.lockFile, process.pid.toString(), { flag: 'wx' });
        return;
      } catch (error) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    throw new Error('Failed to acquire storage lock after 5 seconds');
  }

  private releaseLock(): void {
    try {
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile);
      }
    } catch (error) {
      console.warn('Warning: Failed to release storage lock:', error);
    }
  }

  private loadStorageData(): OrderStorageData {
    if (!fs.existsSync(this.storageFile)) {
      const initialData: OrderStorageData = {
        orders: [],
        lastUpdated: new Date().toISOString(),
        version: this.STORAGE_VERSION
      };
      this.saveStorageData(initialData);
      return initialData;
    }

    try {
      const data = fs.readFileSync(this.storageFile, 'utf8');
      const parsed = JSON.parse(data) as OrderStorageData;
      
      // Validate version compatibility
      if (!parsed.version || parsed.version !== this.STORAGE_VERSION) {
        console.warn(`Storage version mismatch. Expected: ${this.STORAGE_VERSION}, Found: ${parsed.version || 'unknown'}`);
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to load storage data:', error);
      throw new Error(`Storage file corrupted: ${this.storageFile}`);
    }
  }

  private saveStorageData(data: OrderStorageData): void {
    data.lastUpdated = new Date().toISOString();
    data.version = this.STORAGE_VERSION;
    
    try {
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save storage data:', error);
      throw new Error(`Failed to write to storage file: ${this.storageFile}`);
    }
  }

  private generateOrderId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `order_${timestamp}_${random}`;
  }

  async publishOrder(request: CreateOrderRequest): Promise<StorageOperationResult> {
    const orderId = this.generateOrderId();
    
    try {
      await this.acquireLock();
      
      const storageData = this.loadStorageData();
      
      // Check for duplicate commitment
      const existingOrder = storageData.orders.find(
        order => order.commitment === request.commitment && order.metadata.status === 'active'
      );
      
      if (existingOrder) {
        return {
          success: false,
          error: `Order with commitment ${request.commitment} already exists`,
          timestamp: new Date().toISOString()
        };
      }

      const publishedOrder: PublishedOrder = {
        id: orderId,
        orderData: request.orderData,
        signature: request.signature,
        commitment: request.commitment,
        metadata: {
          ...request.metadata,
          published: new Date().toISOString(),
          status: 'active' as OrderStatus
        }
      };

      storageData.orders.push(publishedOrder);
      this.saveStorageData(storageData);

      return {
        success: true,
        orderId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    } finally {
      this.releaseLock();
    }
  }

  async getOrders(filter?: OrderFilter): Promise<OrderSearchResult> {
    try {
      await this.acquireLock();
      
      const storageData = this.loadStorageData();
      let filteredOrders = [...storageData.orders];

      if (filter) {
        if (filter.status) {
          filteredOrders = filteredOrders.filter(order => order.metadata.status === filter.status);
        }
        if (filter.maker) {
          filteredOrders = filteredOrders.filter(order => 
            order.metadata.maker.toLowerCase() === filter.maker!.toLowerCase()
          );
        }
        if (filter.makerAsset) {
          filteredOrders = filteredOrders.filter(order => 
            order.metadata.makerAsset.toLowerCase() === filter.makerAsset!.toLowerCase()
          );
        }
        if (filter.takerAsset) {
          filteredOrders = filteredOrders.filter(order => 
            order.metadata.takerAsset.toLowerCase() === filter.takerAsset!.toLowerCase()
          );
        }
        if (filter.network) {
          filteredOrders = filteredOrders.filter(order => order.metadata.network === filter.network);
        }
      }

      // Sort by published date (newest first)
      filteredOrders.sort((a, b) => 
        new Date(b.metadata.published).getTime() - new Date(a.metadata.published).getTime()
      );

      return {
        orders: filteredOrders,
        totalCount: filteredOrders.length,
        filters: filter || {}
      };

    } catch (error) {
      console.error('Failed to get orders:', error);
      throw error;
    } finally {
      this.releaseLock();
    }
  }

  async getOrderById(id: string): Promise<PublishedOrder | null> {
    try {
      await this.acquireLock();
      
      const storageData = this.loadStorageData();
      return storageData.orders.find(order => order.id === id) || null;

    } catch (error) {
      console.error('Failed to get order by ID:', error);
      return null;
    } finally {
      this.releaseLock();
    }
  }

  async updateOrderStatus(request: UpdateOrderStatusRequest): Promise<StorageOperationResult> {
    try {
      await this.acquireLock();
      
      const storageData = this.loadStorageData();
      const orderIndex = storageData.orders.findIndex(order => order.id === request.orderId);

      if (orderIndex === -1) {
        return {
          success: false,
          error: `Order with ID ${request.orderId} not found`,
          timestamp: new Date().toISOString()
        };
      }

      const oldStatus = storageData.orders[orderIndex].metadata.status;
      storageData.orders[orderIndex].metadata.status = request.status;
      
      this.saveStorageData(storageData);

      console.log(`Order ${request.orderId} status updated: ${oldStatus} → ${request.status}`);

      return {
        success: true,
        orderId: request.orderId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    } finally {
      this.releaseLock();
    }
  }

  async getActiveOrders(network?: string): Promise<PublishedOrder[]> {
    const filter: OrderFilter = { status: 'active' };
    if (network) {
      filter.network = network;
    }
    
    const result = await this.getOrders(filter);
    return result.orders;
  }

  async getStorageStats(): Promise<{ totalOrders: number; activeOrders: number; filledOrders: number; cancelledOrders: number }> {
    const allOrders = await this.getOrders();
    const activeOrders = await this.getOrders({ status: 'active' });
    const filledOrders = await this.getOrders({ status: 'filled' });
    const cancelledOrders = await this.getOrders({ status: 'cancelled' });

    return {
      totalOrders: allOrders.totalCount,
      activeOrders: activeOrders.totalCount,
      filledOrders: filledOrders.totalCount,
      cancelledOrders: cancelledOrders.totalCount
    };
  }

  getStorageFilePath(): string {
    return this.storageFile;
  }
} 