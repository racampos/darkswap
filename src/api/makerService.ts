import express, { Request, Response, NextFunction } from 'express';
import { ethers } from 'hardhat';
import { generateFormattedProof } from '../utils/proofGenerator';
import { calculateCommitment } from '../utils/commitmentUtils';
import { getCommitmentFromOrder } from '../utils/commitmentOrders';

/**
 * Secret parameters for a commitment
 */
interface SecretParameters {
  secretPrice: bigint;
  secretAmount: bigint;
  nonce: bigint;
  maker: string;
}

/**
 * Order parameters for rebuilding orders with extensions
 */
interface OrderParameters {
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: bigint;
  takingAmount: bigint;
  commitment: string;
  originalSalt?: string; // Optional for backward compatibility
}

/**
 * Fill authorization request from taker
 */
interface FillAuthorizationRequest {
  orderHash: string;
  orderParams: OrderParameters; // Store parameters, not final order
  signature: {
    r: string;
    vs: string;
  };
  fillAmount: bigint;
  taker: string;
}

/**
 * Fill authorization response to taker
 */
interface FillAuthorizationResponse {
  success: boolean;
  orderWithExtension?: any; // Complete order with ZK extension
  signature?: string; // Signature for the new order
  error?: string;
  reason?: string;
}

/**
 * Service for handling maker authorization requests and ZK proof generation
 */
export class MakerService {
  private app?: express.Application;
  private secretsDatabase: Map<string, SecretParameters>;
  private orderParamsDatabase: Map<string, OrderParameters>;
  private routerAddress: string;
  private chainId: bigint;
  private zkPredicateAddress?: string;

  constructor(routerAddress: string, chainId: bigint = 1n, setupExpress: boolean = false) {
    this.secretsDatabase = new Map();
    this.orderParamsDatabase = new Map();
    this.routerAddress = routerAddress;
    this.chainId = chainId;
    
    // Only set up Express app if explicitly requested (for backward compatibility)
    if (setupExpress) {
      this.app = express();
      this.setupMiddleware();
      this.setupRoutes();
    }
  }

  /**
   * Initialize the service with deployed ZK predicate contract
   */
  public async initialize(): Promise<void> {
    console.log(`Initializing maker service...`);
    
    // Try to read predicate address from deployment config first
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const configPath = path.join(__dirname, "../../config/deployed-addresses.json");
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, "utf8");
        const config = JSON.parse(configData);
        
        // Use localhost network deployment
        const deployment = config.networks?.localhost || config.networks?.hardhat;
        if (deployment?.contracts?.HiddenParamPredicateZK) {
          this.zkPredicateAddress = deployment.contracts.HiddenParamPredicateZK;
          console.log(`   Using deployed predicate from config: ${this.zkPredicateAddress}`);
          console.log(`Maker service initialized with ZK predicate: ${this.zkPredicateAddress}`);
          return;
        }
      }
    } catch (configError) {
      const errorMessage = configError instanceof Error ? configError.message : String(configError);
      console.log(`   Could not read deployment config: ${errorMessage}`);
    }
    
    // Fallback: Deploy ZK predicate contract to forked network
    console.log(`   Deployment config not found, deploying new contracts...`);
    this.zkPredicateAddress = await this.deployZKPredicate();
    
    console.log(`Maker service initialized with ZK predicate: ${this.zkPredicateAddress}`);
  }

  /**
   * Deploy ZK predicate contract to forked network
   */
  private async deployZKPredicate(): Promise<string> {
    const { ethers } = await import('hardhat');
    
    console.log(`   Deploying Groth16Verifier...`);
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log(`   Groth16Verifier deployed: ${verifierAddress}`);

    console.log(`   Deploying HiddenParamPredicateZK...`);
    const PredicateFactory = await ethers.getContractFactory("HiddenParamPredicateZK");
    const predicate = await PredicateFactory.deploy(verifierAddress);
    await predicate.waitForDeployment();
    const predicateAddress = await predicate.getAddress();
    console.log(`   HiddenParamPredicateZK deployed: ${predicateAddress}`);

    return predicateAddress;
  }

  /**
   * Register order parameters and secrets for a commitment
   */
  public registerOrder(commitment: string, orderParams: OrderParameters, secrets: SecretParameters, orderHash?: string): void {
    console.log(`🔍 MakerService.registerOrder called:`);
    console.log(`   Commitment key: ${commitment}`);
    console.log(`   OrderParams.commitment: ${orderParams.commitment}`);
    console.log(`   OrderHash: ${orderHash}`);
    
    this.orderParamsDatabase.set(commitment, orderParams);
    this.secretsDatabase.set(commitment, secrets);
    
    // Also register by orderHash if provided (for authorizeFillRequest lookup)
    if (orderHash) {
      console.log(`   Storing orderParams by orderHash: ${orderHash}`);
      this.orderParamsDatabase.set(orderHash, orderParams);
      console.log(`   Stored orderParams.commitment: ${orderParams.commitment}`);
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  public registerSecrets(commitment: string, secrets: SecretParameters): void {
    this.secretsDatabase.set(commitment, secrets);
  }

  /**
   * Generate ZK proof for fill authorization
   */
  private async generateZKProof(
    secrets: SecretParameters, 
    fillAmount: bigint, 
    commitment: bigint
  ): Promise<{ success: boolean; proof?: any; error?: string }> {
    try {
      console.log(`     🔧 Preparing proof inputs...`);
      const proofInputs = {
        secretPrice: secrets.secretPrice.toString(),
        secretAmount: secrets.secretAmount.toString(),
        commit: commitment.toString(),
        nonce: secrets.nonce.toString(),
        offeredPrice: fillAmount.toString(),
        offeredAmount: fillAmount.toString()
      };

      console.log(`     📁 Setting up proof config with paths...`);
      const proofConfig = {
        wasmPath: './circuits/hidden_params_js/hidden_params.wasm',
        zkeyPath: './circuits/hidden_params_0001.zkey',
        enableLogging: true
      };

      console.log(`     ⚡ Calling generateFormattedProof...`);
      const proofGenStartTime = Date.now();
      const result = await generateFormattedProof(proofInputs, proofConfig);
      const proofGenEndTime = Date.now();
      console.log(`     ✅ generateFormattedProof completed in ${proofGenEndTime - proofGenStartTime}ms`);
      
      return {
        success: true,
        proof: result
      };
    } catch (error) {
      console.log(`     ❌ Proof generation error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown proof generation error'
      };
    }
  }

  /**
   * Build order with ZK extension and return signed order ready for execution
   */
  private async buildOrderWithExtension(
    orderParams: OrderParameters,
    fillAmount: bigint,
    proof: any,
    taker: string
  ): Promise<{ success: boolean; orderWithExtension?: any; signature?: string; error?: string }> {
    try {
      if (!this.zkPredicateAddress) {
        throw new Error("Service not initialized");
      }

      const { ethers } = await import('hardhat');
      
      console.log(`Rebuilding order with ZK extension...`);
      
      // Build ZK predicate extension following working pattern
      const routerInterface = new ethers.Interface([
        "function arbitraryStaticCall(address target, bytes calldata data) external view returns (bytes memory)",
        "function gt(uint256 value, bytes calldata data) external view returns (bool)"
      ]);

      // Encode ZK predicate call with proof
      const zkPredicateCall = routerInterface.encodeFunctionData("arbitraryStaticCall", [
        this.zkPredicateAddress,
        ethers.Interface.from(["function predicate(bytes calldata data) external view returns (uint256 result)"]).encodeFunctionData("predicate", [proof.encodedData])
      ]);

      // Wrap in gt() for boolean result
      const zkWrappedPredicate = routerInterface.encodeFunctionData("gt", [0, zkPredicateCall]);
      
      console.log(`   ZK wrapped predicate: ${zkWrappedPredicate.length} chars`);

      // Import 1inch utilities
      const { buildOrder, buildMakerTraits } = await import('../../test/helpers/orderUtils');
      
      // Build maker traits
      const makerTraits = buildMakerTraits({
        allowPartialFill: true,
        allowMultipleFills: true,
      });

      // Rebuild order with ZK extension (simple approach)
      // Let buildOrder handle salt updates automatically when extension is present
      const orderWithExtension = buildOrder({
        maker: orderParams.maker,
        makerAsset: orderParams.makerAsset,
        takerAsset: orderParams.takerAsset,
        makingAmount: orderParams.makingAmount,
        takingAmount: orderParams.takingAmount,
        makerTraits: makerTraits,
        salt: orderParams.originalSalt ? BigInt(orderParams.originalSalt) : BigInt(orderParams.commitment),
      }, {
        makerAssetSuffix: '0x',
        takerAssetSuffix: '0x', 
        makingAmountData: '0x',
        takingAmountData: '0x',
        predicate: zkWrappedPredicate, // Extension - buildOrder will handle salt update
        permit: '0x',
        preInteraction: '0x',
        postInteraction: '0x',
      });

      console.log(`   Order rebuilt with extension`);
      console.log(`   Extension length: ${(orderWithExtension as any).extension?.length || 0} chars`);

      // Sign the new order - use private key from environment
      const { signCommitmentOrder } = await import('../utils/commitmentOrders');
      
      let makerSigner;
      
      try {
        console.log(`   🔑 Using MAKER_PRIVATE_KEY from environment`);
        
        // Get private key from environment
        const makerPrivateKey = process.env.MAKER_PRIVATE_KEY;
        if (!makerPrivateKey) {
          throw new Error('MAKER_PRIVATE_KEY not found in environment variables');
        }
        
        // Create signer directly from private key
        const privateSigner = new ethers.Wallet(makerPrivateKey, ethers.provider);
        
        console.log(`   ✅ Created wallet signer: ${privateSigner.address}`);
        console.log(`   🔍 Expected maker address: ${orderParams.maker}`);
        console.log(`   🔍 Addresses match: ${privateSigner.address.toLowerCase() === orderParams.maker.toLowerCase()}`);
        
        // Check if the private key signer matches the expected maker
        if (privateSigner.address.toLowerCase() === orderParams.maker.toLowerCase()) {
          makerSigner = privateSigner;
          console.log(`   ✅ Using MAKER_PRIVATE_KEY signer (addresses match)`);
        } else {
          console.log(`   ⚠️  Address mismatch, falling back to Hardhat signer`);
          throw new Error('Address mismatch');
        }
        
      } catch (privateKeyError) {
        const errorMessage = privateKeyError instanceof Error ? privateKeyError.message : String(privateKeyError);
        console.log(`   ❌ Private key signing failed or address mismatch: ${errorMessage}`);
        console.log(`   🔄 Falling back to default signer...`);
        
        // Fallback to original method if private key fails or address doesn't match
        const [, defaultMaker] = await ethers.getSigners();
        makerSigner = defaultMaker;
        
        console.log(`   ⚠️  Using fallback signer: ${makerSigner.address}`);
        console.log(`   🔍 Final address match: ${makerSigner.address.toLowerCase() === orderParams.maker.toLowerCase()}`);
      }
      
//       console.log(`🔍 ABOUT TO SIGN ORDER:`);
//       console.log(`   Order structure: {
//   "salt": "${orderWithExtension.salt}",
//   "maker": "${orderWithExtension.maker}",
//   "receiver": "${orderWithExtension.receiver}",
//   "makerAsset": "${orderWithExtension.makerAsset}",
//   "takerAsset": "${orderWithExtension.takerAsset}",
//   "makingAmount": "${orderWithExtension.makingAmount}",
//   "takingAmount": "${orderWithExtension.takingAmount}",
//   "makerTraits": "${orderWithExtension.makerTraits}",
//   "hasExtension": ${!!(orderWithExtension as any).extension}
// }`);

      // // ===== CRITICAL DEBUGGING: LOG EXACT SIGNING PARAMETERS =====
      // console.log(`🔍 SIGNING PARAMETERS FOR COMPARISON WITH DEMO:`);
      // console.log(`   Router Address: ${this.routerAddress}`);
      // console.log(`   Chain ID: ${this.chainId} (type: ${typeof this.chainId})`);
      // console.log(`   Chain ID as BigInt: ${BigInt(this.chainId)}`);
      // console.log(`   Signer Address: ${makerSigner.address}`);
      // console.log(`   Expected Maker: ${orderWithExtension.maker}`);
      // console.log(`   Addresses Match: ${makerSigner.address.toLowerCase() === orderWithExtension.maker.toLowerCase()}`);
      
      // // Log the EIP-712 domain that will be used by the backend signing
      // const { buildOrderData } = await import("../../test/helpers/orderUtils");
      // const orderData = buildOrderData(this.chainId, this.routerAddress, orderWithExtension);
      // console.log(`🔍 EIP-712 DOMAIN BEING USED:`);
      // console.log(`   Name: "${orderData.domain.name}"`);
      // console.log(`   Version: "${orderData.domain.version}"`);
      // console.log(`   ChainId: ${orderData.domain.chainId} (type: ${typeof orderData.domain.chainId})`);
      // console.log(`   VerifyingContract: ${orderData.domain.verifyingContract}`);
      
      // // Log exact order value for signing
      // console.log(`🔍 ORDER VALUE FOR EIP-712 SIGNING:`);
      // console.log(JSON.stringify(orderData.value, (key, value) => 
      //   typeof value === 'bigint' ? value.toString() : value, 2));
      
      console.log(`🔍 CALLING signCommitmentOrder...`);
      
      const signature = await signCommitmentOrder(
        orderWithExtension,
        this.chainId,
        this.routerAddress,
        makerSigner
      );

      console.log(`   Order signed`);
      console.log(`   Signature: ${signature}`);

      return {
        success: true,
        orderWithExtension,
        signature
      };

    } catch (error) {
      console.log(`   Order building failed: ${error}`);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Public authorization method for REST API server
   */
  public async authorizeFillRequest(orderHash: string, fillAmount: bigint): Promise<{
    success: boolean;
    orderWithExtension?: any;
    signature?: string;
    error?: string;
  }> {
    try {
      // Look up order parameters by order hash
      console.log(`🔍 Looking up order parameters for orderHash: ${orderHash}`);
      const orderParams = this.orderParamsDatabase.get(orderHash);
      if (!orderParams) {
        return {
          success: false,
          error: 'Order not found - no parameters registered for this hash'
        };
      }
      
      console.log(`🔍 Retrieved orderParams:`);
      console.log(`   orderParams.commitment: ${orderParams.commitment}`);
      console.log(`   orderParams.maker: ${orderParams.maker}`);

      // Extract commitment from order - handle both string and numeric formats
      let commitmentStr: string;
      try {
        // Try to convert to BigInt first (new numeric format)
        const commitment = BigInt(orderParams.commitment);
        commitmentStr = commitment.toString();
      } catch (conversionError) {
        // If conversion fails, use the string directly (old format)
        commitmentStr = orderParams.commitment;
        console.log(`   Using string commitment directly: ${commitmentStr}`);
      }
      
      console.log(`   Extracted Commitment: ${commitmentStr}`);

      // Look up secrets for this commitment
      const secrets = this.secretsDatabase.get(commitmentStr);
      if (!secrets) {
        return {
          success: false,
          error: 'Order not found - no secrets registered for this commitment'
        };
      }

      console.log(`   Found secrets for maker: ${secrets.maker}`);

      // Verify the order is from the expected maker
      if (orderParams.maker.toLowerCase() !== secrets.maker.toLowerCase()) {
        return {
          success: false,
          error: 'Unauthorized - order maker does not match registered maker'
        };
      }

      // Check if fill amount meets secret requirements
      const fillAmountNumber = Number(fillAmount);
      if (fillAmountNumber < secrets.secretPrice) {
        return {
          success: false,
          error: `Insufficient amount - fill amount ${fillAmountNumber} below minimum threshold ${secrets.secretPrice}`
        };
      }

      console.log(`   Fill amount ${fillAmountNumber} >= secret minimum ${secrets.secretPrice}`);

      // Generate ZK proof for this fill
      console.log(`   Generating ZK proof...`);
      const proofStartTime = Date.now();
      const proofResult = await this.generateZKProof(secrets, BigInt(fillAmountNumber), BigInt(orderParams.commitment));
      const proofEndTime = Date.now();
      
      if (!proofResult.success) {
        return {
          success: false,
          error: `Proof generation failed: ${proofResult.error}`
        };
      }

      console.log(`   ZK proof generated successfully in ${proofEndTime - proofStartTime}ms`);

      // Build order with extension and sign
      console.log(`   Building order with ZK extension...`);
      const orderResult = await this.buildOrderWithExtension(
        orderParams,
        BigInt(fillAmountNumber),
        proofResult.proof!,
        "0x0000000000000000000000000000000000000000" // Placeholder taker for now
      );

      if (!orderResult.success) {
        return {
          success: false,
          error: `Order building failed: ${orderResult.error}`
        };
      }

      console.log(`   AUTHORIZATION SUCCESSFUL`);

      return {
        success: true,
        orderWithExtension: orderResult.orderWithExtension,
        signature: orderResult.signature
      };

    } catch (error) {
      console.error('Authorization error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Main authorization logic (Express handler)
   */
  private async authorizeFill(req: Request, res: Response) {
    try {
      const request: FillAuthorizationRequest = req.body;
      
      console.log(`\nFILL AUTHORIZATION REQUEST`);
      console.log(`   Order Hash: ${request.orderHash}`);
      console.log(`   Fill Amount: ${request.fillAmount} wei`);
      console.log(`   Taker: ${request.taker}`);

      // Extract commitment from order - handle both string and numeric formats
      let commitmentStr: string;
      try {
        // Try to convert to BigInt first (new numeric format)
        const commitment = BigInt(request.orderParams.commitment);
        commitmentStr = commitment.toString();
      } catch (conversionError) {
        // If conversion fails, use the string directly (old format)
        commitmentStr = request.orderParams.commitment;
        console.log(`   Using string commitment directly: ${commitmentStr}`);
      }
      
      console.log(`   Extracted Commitment: ${commitmentStr}`);

      // Look up secrets for this commitment
      const secrets = this.secretsDatabase.get(commitmentStr);
      if (!secrets) {
        console.log(`   No secrets found for commitment`);
        return res.status(404).json({
          success: false,
          error: 'Order not found',
          reason: 'No secrets registered for this commitment'
        });
      }

      console.log(`   Found secrets for maker: ${secrets.maker}`);

      // Verify the order is from the expected maker
      if (request.orderParams.maker.toLowerCase() !== secrets.maker.toLowerCase()) {
        console.log(`   Maker mismatch: expected ${secrets.maker}, got ${request.orderParams.maker}`);
        return res.status(403).json({
          success: false,
          error: 'Unauthorized',
          reason: 'Order maker does not match registered maker'
        });
      }

      // Check if fill amount meets secret requirements
      if (request.fillAmount < secrets.secretPrice) {
        console.log(`   Fill amount ${request.fillAmount} < secret minimum ${secrets.secretPrice}`);
        return res.status(400).json({
          success: false,
          error: 'Insufficient amount',
          reason: `Fill amount below minimum threshold`
        });
      }

      console.log(`   Fill amount ${request.fillAmount} >= secret minimum ${secrets.secretPrice}`);

      // Generate ZK proof for this fill
      console.log(`   Generating ZK proof...`);
      const proofStartTime = Date.now();
      const proofResult = await this.generateZKProof(secrets, request.fillAmount, BigInt(request.orderParams.commitment));
      const proofEndTime = Date.now();
      
      if (!proofResult.success) {
        console.log(`   ZK proof generation failed: ${proofResult.error}`);
        return res.status(500).json({
          success: false,
          error: 'Proof generation failed',
          reason: proofResult.error
        });
      }

      console.log(`   ZK proof generated successfully in ${proofEndTime - proofStartTime}ms`);

      // Build order with extension and sign
      console.log(`   Building order with ZK extension...`);
      const orderResult = await this.buildOrderWithExtension(
        request.orderParams,
        request.fillAmount,
        proofResult.proof!,
        request.taker
      );

      if (!orderResult.success) {
        console.log(`   Order building failed: ${orderResult.error}`);
        return res.status(500).json({
          success: false,
          error: 'Order building failed',
          reason: orderResult.error
        });
      }

      console.log(`   AUTHORIZATION SUCCESSFUL`);

      res.json({
        success: true,
        orderWithExtension: orderResult.orderWithExtension,
        signature: orderResult.signature,
        message: 'Order ready for execution with ZK proof extension'
      });

    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private setupMiddleware() {
    this.app?.use(express.json());
    this.app?.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes() {
    // Main authorization endpoint
    this.app?.post('/authorize-fill', this.authorizeFill.bind(this));
    
    // Order status endpoint
    this.app?.get('/order-status/:commitment', this.getOrderStatus.bind(this));
    
    // Health check
    this.app?.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Debug endpoint for demo
    this.app?.get('/debug/secrets', this.getSecretsDebug.bind(this));
  }

  /**
   * Get order status endpoint
   */
  private async getOrderStatus(req: Request, res: Response) {
    const commitment = req.params.commitment;
    const secrets = this.secretsDatabase.get(commitment);
    
    if (!secrets) {
      return res.status(404).json({
        found: false,
        message: 'Order not found'
      });
    }

    res.json({
      found: true,
      maker: secrets.maker,
      hasSecrets: true,
      commitment: commitment
    });
  }

  /**
   * Debug endpoint to show registered secrets (for demo)
   */
  private async getSecretsDebug(req: Request, res: Response) {
    const secrets = Array.from(this.secretsDatabase.entries()).map(([commitment, data]) => ({
      commitment,
      maker: data.maker,
      secretPrice: data.secretPrice.toString(),
      secretAmount: data.secretAmount.toString(),
      nonce: data.nonce.toString()
    }));

    res.json({
      registered_orders: secrets.length,
      orders: secrets
    });
  }

  /**
   * Start the service
   */
  public start(port: number = 3000): void {
    this.app?.listen(port, () => {
      console.log(`\nMaker Authorization Service running on port ${port}`);
      console.log(`Endpoints:`);
      console.log(`   POST /authorize-fill - Request fill authorization`);
      console.log(`   GET /order-status/:commitment - Check order status`);
      console.log(`   GET /health - Health check`);
      console.log(`   GET /debug/secrets - Debug registered orders`);
      console.log(`\nReady to authorize ZK-protected fills!`);
    });
  }

  /**
   * Stop the service
   */
  public stop(): void {
    // Implementation for graceful shutdown
  }
}

export default MakerService; 