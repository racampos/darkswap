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

// Circomlib-based implementations adapted for circom 0.5.46
// Based on circomlib/circuits/bitify.circom and circomlib/circuits/comparators.circom

template Num2Bits(n) {
    signal input in;
    signal output out[n];
    var lc1=0;

    var e2=1;
    for (var i = 0; i<n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] -1 ) === 0;
        lc1 += out[i] * e2;
        e2 = e2+e2;
    }

    lc1 === in;
}

template LessThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;

    component n2b = Num2Bits(n+1);

    n2b.in <== in[0]+ (1<<n) - in[1];

    out <== 1-n2b.out[n];
}

template GreaterEqThan(n) {
    signal input in[2];
    signal output out;

    component lt = LessThan(n);

    lt.in[0] <== in[1];
    lt.in[1] <== in[0]+1;
    lt.out ==> out;
}

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

// Main component
component main = HiddenParams(); 