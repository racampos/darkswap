pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";

/*
 * Hidden Parameter Orders Circuit (Production Version)
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
    // Private inputs (witness) - all template signals are private by default
    signal input secretPrice;
    signal input secretAmount;
    
    // Public inputs  
    signal input commit;
    signal input nonce;
    signal input offeredPrice;
    signal input offeredAmount;
    
    // Output signal
    signal output valid;
    
    // Intermediate signals for constraint enforcement
    signal commitmentCheck;
    signal priceValid;
    signal amountValid;
    signal allConstraintsSatisfied;
    
    // Constraint 1: Verify commitment binding
    // commit must equal secretPrice + secretAmount + nonce
    commitmentCheck <== commit - (secretPrice + secretAmount + nonce);
    commitmentCheck === 0;
    
    // Constraint 2: Price constraint (offeredPrice >= secretPrice)
    component priceConstraint = GreaterEqThan(64); // 64-bit numbers
    priceConstraint.in[0] <== offeredPrice;
    priceConstraint.in[1] <== secretPrice;
    priceValid <== priceConstraint.out;
    
    // Constraint 3: Amount constraint (offeredAmount >= secretAmount)  
    component amountConstraint = GreaterEqThan(64); // 64-bit numbers
    amountConstraint.in[0] <== offeredAmount;
    amountConstraint.in[1] <== secretAmount;
    amountValid <== amountConstraint.out;
    
    // All constraints must be satisfied for valid output
    // valid = 1 if priceValid AND amountValid both equal 1
    allConstraintsSatisfied <== priceValid * amountValid;
    valid <== allConstraintsSatisfied;
    
    // Ensure valid is boolean (0 or 1)
    valid * (valid - 1) === 0;
}

// Main component with public signal specification
component main {public [commit, nonce, offeredPrice, offeredAmount]} = HiddenParams(); 