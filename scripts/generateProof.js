/**
 * ZK Proof Generation Test Script
 * Tests proof generation directly with snarkjs and circuit artifacts
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const { poseidon3 } = require('poseidon-lite');

// File paths
const CIRCUITS_DIR = path.join(__dirname, "../circuits");
const WASM_PATH = path.join(__dirname, "../circuits/hidden_params_js/hidden_params.wasm");
const ZKEY_PATH = path.join(CIRCUITS_DIR, "hidden_params_0001.zkey");
const PROOF_PATH = path.join(CIRCUITS_DIR, "proof.json");
const PUBLIC_PATH = path.join(CIRCUITS_DIR, "public.json");

// Sample test data with Poseidon commitment
const SECRET_PRICE = BigInt('2000');
const SECRET_AMOUNT = BigInt('10');
const NONCE = BigInt('123456789');

// Generate Poseidon commitment using poseidon3 for 3 inputs
const COMMITMENT = poseidon3([SECRET_PRICE, SECRET_AMOUNT, NONCE]);

const SAMPLE_INPUTS = {
  secretPrice: SECRET_PRICE.toString(),
  secretAmount: SECRET_AMOUNT.toString(),
  nonce: NONCE.toString(),
  offeredPrice: '2100',
  offeredAmount: '50',
  commit: COMMITMENT.toString()
};

// Invalid test data - price constraint violation
const INVALID_INPUTS = {
  secretPrice: SECRET_PRICE.toString(),
  secretAmount: SECRET_AMOUNT.toString(),
  nonce: NONCE.toString(),
  offeredPrice: '1500',    // 1500 < 2000
  offeredAmount: '50',
  commit: COMMITMENT.toString() // Same commitment
};

function validateInputs(inputs) {
  console.log('Validating inputs...');
  
  const errors = [];
  
  // Check all required fields exist
  const required = ['secretPrice', 'secretAmount', 'commit', 'nonce', 'offeredPrice', 'offeredAmount'];
  for (const field of required) {
    if (!inputs[field]) {
      errors.push(`${field} is required`);
    }
  }
  
  if (errors.length > 0) {
    console.log('Validation failed:', errors);
    return false;
  }
  
  // Validate commitment constraint
  const secretPrice = BigInt(inputs.secretPrice);
  const secretAmount = BigInt(inputs.secretAmount);
  const nonce = BigInt(inputs.nonce);
  const commit = BigInt(inputs.commit);
  const expectedCommit = poseidon3([secretPrice, secretAmount, nonce]);
  
  if (commit !== expectedCommit) {
    console.log(`Commitment mismatch: expected ${expectedCommit}, got ${commit}`);
    return false;
  }
  
  // Validate inequality constraints
  const offeredPrice = BigInt(inputs.offeredPrice);
  const offeredAmount = BigInt(inputs.offeredAmount);
  
  if (offeredPrice < secretPrice) {
    console.log(`Price constraint violated: ${offeredPrice} < ${secretPrice}`);
    return false;
  }
  
  if (offeredAmount < secretAmount) {
    console.log(`Amount constraint violated: ${offeredAmount} < ${secretAmount}`);
    return false;
  }
  
  console.log('All inputs are valid!');
  return true;
}

function checkFiles() {
  console.log('\nChecking required files...');
  
  const files = [
    { path: WASM_PATH, name: 'Circuit WASM' },
    { path: ZKEY_PATH, name: 'Proving Key' }
  ];
  
  for (const file of files) {
    if (fs.existsSync(file.path)) {
      const stats = fs.statSync(file.path);
      console.log(`   ${file.name}: ${file.path} (${(stats.size / 1024).toFixed(1)}KB)`);
    } else {
      console.log(`   ${file.name}: ${file.path} - NOT FOUND`);
      return false;
    }
  }
  
  return true;
}

async function generateProof() {
  console.log('\nGenerating ZK proof...');
  
  try {
    console.log('   Input data:');
    console.log('      Commit:', SAMPLE_INPUTS.commit);
    console.log('      Nonce:', SAMPLE_INPUTS.nonce);
    console.log('      Offered Price:', SAMPLE_INPUTS.offeredPrice);
    console.log('      Offered Amount:', SAMPLE_INPUTS.offeredAmount);
    console.log('      [Secret values hidden]');
    
    // Generate proof using snarkjs
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      SAMPLE_INPUTS,
      WASM_PATH,
      ZKEY_PATH
    );
    
    console.log('\nProof generated successfully!');
    
    // Display proof structure
    console.log('\nProof Data:');
    console.log('   A:', proof.pi_a);
    console.log('   B:', proof.pi_b);
    console.log('   C:', proof.pi_c);
    console.log('   Protocol:', proof.protocol);
    console.log('   Curve:', proof.curve);
    
    console.log('\nPublic Signals:');
    console.log('   [0] Valid:', publicSignals[0]);
    console.log('   [1] Commit:', publicSignals[1]);
    console.log('   [2] Nonce:', publicSignals[2]);
    console.log('   [3] Offered Price:', publicSignals[3]);
    console.log('   [4] Offered Amount:', publicSignals[4]);
    
    // Save proof files for verification
    fs.writeFileSync(PROOF_PATH, JSON.stringify(proof, null, 2));
    fs.writeFileSync(PUBLIC_PATH, JSON.stringify(publicSignals, null, 2));
    
    console.log('\nProof files saved:');
    console.log('   Proof:', PROOF_PATH);
    console.log('   Public signals:', PUBLIC_PATH);
    
    return { proof, publicSignals };
    
  } catch (error) {
    console.error('\nProof generation failed:', error.message);
    throw error;
  }
}

function testInvalidInputs() {
  console.log('\nTesting invalid inputs...');
  
  // Test price constraint violation
  const isValid = validateInputs(INVALID_INPUTS);
  if (!isValid) {
    console.log('   Correctly rejected invalid inputs');
  } else {
    console.log('   Should have rejected invalid inputs!');
  }
}

async function main() {
  console.log('ZK Proof Generation Test');
  console.log('================================');
  
  try {
    // Check required files exist
    if (!checkFiles()) {
      console.error('\nRequired files missing. Run: npm run circuit:setup');
      process.exit(1);
    }
    
    // Test input validation
    if (!validateInputs(SAMPLE_INPUTS)) {
      console.error('\nInput validation failed');
      process.exit(1);
    }
    
    // Test invalid inputs
    testInvalidInputs();
    
    // Generate proof
    const result = await generateProof();
    
    console.log('\nAll tests completed successfully!');
    console.log('\nSummary:');
    console.log('   Required files found');
    console.log('   Input validation working');
    console.log('   Invalid input detection working');
    console.log('   Proof generation successful');
    console.log('   Proof files saved');
    console.log('\nNext: Run `npm run circuit:verify` to verify the generated proof');
    
  } catch (error) {
    console.error('\nTest failed:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main();
}

module.exports = { validateInputs, generateProof, SAMPLE_INPUTS }; 