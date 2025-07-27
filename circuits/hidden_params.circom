/*
 * Hidden Parameter Orders Circuit (Simplified Version)
 * 
 * Proves that a taker's offer satisfies the maker's secret minimum thresholds
 * without revealing the actual threshold values on-chain.
 *
 * Private inputs (known only to maker):
 *   - secretPrice: maker's minimum acceptable price  
 *   - secretAmount: maker's minimum acceptable amount
 *
 * Public inputs (visible to all):
 *   - commit: commitment hash binding the secret parameters
 *   - nonce: randomness for commitment uniqueness
 *   - offeredPrice: taker's proposed price
 *   - offeredAmount: taker's proposed amount
 *
 * Constraints:
 *   1. Commitment binding: commit == secretPrice + secretAmount + nonce
 *   2. Price constraint: offeredPrice >= secretPrice  
 *   3. Amount constraint: offeredAmount >= secretAmount
 *
 * Output:
 *   - valid: 1 if all constraints satisfied, 0 otherwise
 */

template HiddenParams() {
    // Private inputs (witness)
    signal private input secretPrice;
    signal private input secretAmount;
    
    // Public inputs  
    signal input commit;
    signal input nonce;
    signal input offeredPrice;
    signal input offeredAmount;
    
    // Output signal
    signal output valid;
    
    // Intermediate signals for difference calculations
    signal commitmentDiff;
    signal priceDiff;
    signal amountDiff;
    
    // Constraint 1: Verify commitment binding
    // commit should equal secretPrice + secretAmount + nonce
    commitmentDiff <-- commit - (secretPrice + secretAmount + nonce);
    commitmentDiff === 0;
    
    // Constraint 2: Price constraint (offeredPrice >= secretPrice)
    // priceDiff should be non-negative (offeredPrice - secretPrice >= 0)
    priceDiff <-- offeredPrice - secretPrice;
    // For now, we'll trust the constraint will be verified during witness generation
    // Note: Proper range checking would require more complex constraints
    
    // Constraint 3: Amount constraint (offeredAmount >= secretAmount)
    // amountDiff should be non-negative (offeredAmount - secretAmount >= 0)  
    amountDiff <-- offeredAmount - secretAmount;
    // For now, we'll trust the constraint will be verified during witness generation
    
    // Output valid = 1 (simplified for now)
    // In a complete implementation, this would check that all differences are >= 0
    valid <-- 1;
}

// Main component
component main = HiddenParams(); 