/**
 * ZK Proof Generation Test Script
 * Tests proof generation directly with snarkjs and circuit artifacts
 */

const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

// Sample test data for proof generation
const SAMPLE_INPUTS = {
  // Private inputs (maker's secret thresholds)
  secretPrice: "2000",      // Maker wants at least 2000 USDC per WETH
  secretAmount: "10",       // Maker wants to sell at least 10 WETH
  
  // Public inputs
  nonce: "123456789",       // Random nonce for commitment uniqueness
  offeredPrice: "2100",     // Taker offers 2100 USDC per WETH (satisfies constraint)
  offeredAmount: "50",      // Taker wants 50 WETH (satisfies constraint)
  
  // Commitment (secretPrice + secretAmount + nonce)
  commit: (BigInt("2000") + BigInt("10") + BigInt("123456789")).toString()
};

// File paths
const CIRCUITS_DIR = path.join(__dirname, "../circuits");
const WASM_PATH = path.join(__dirname, "../circuits/hidden_params_js/hidden_params.wasm");
const ZKEY_PATH = path.join(CIRCUITS_DIR, "hidden_params_0001.zkey");
const PROOF_PATH = path.join(CIRCUITS_DIR, "proof.json");
const PUBLIC_PATH = path.join(CIRCUITS_DIR, "public.json");

function validateInputs(inputs) {
  console.log('🔍 Validating inputs...');
  
  const errors = [];
  
  // Check all required fields exist
  const required = ['secretPrice', 'secretAmount', 'commit', 'nonce', 'offeredPrice', 'offeredAmount'];
  for (const field of required) {
    if (!inputs[field]) {
      errors.push(`${field} is required`);
    }
  }
  
  if (errors.length > 0) {
    console.log('❌ Validation failed:', errors);
    return false;
  }
  
  // Validate commitment constraint
  const secretPrice = BigInt(inputs.secretPrice);
  const secretAmount = BigInt(inputs.secretAmount);
  const nonce = BigInt(inputs.nonce);
  const commit = BigInt(inputs.commit);
  const expectedCommit = secretPrice + secretAmount + nonce;
  
  if (commit !== expectedCommit) {
    console.log(`❌ Commitment mismatch: expected ${expectedCommit}, got ${commit}`);
    return false;
  }
  
  // Validate inequality constraints
  const offeredPrice = BigInt(inputs.offeredPrice);
  const offeredAmount = BigInt(inputs.offeredAmount);
  
  if (offeredPrice < secretPrice) {
    console.log(`❌ Price constraint violated: ${offeredPrice} < ${secretPrice}`);
    return false;
  }
  
  if (offeredAmount < secretAmount) {
    console.log(`❌ Amount constraint violated: ${offeredAmount} < ${secretAmount}`);
    return false;
  }
  
  console.log('✅ All inputs are valid!');
  return true;
}

function checkFiles() {
  console.log('\n📁 Checking required files...');
  
  const files = [
    { path: WASM_PATH, name: 'Circuit WASM' },
    { path: ZKEY_PATH, name: 'Proving Key' }
  ];
  
  for (const file of files) {
    if (fs.existsSync(file.path)) {
      const stats = fs.statSync(file.path);
      console.log(`   ✅ ${file.name}: ${file.path} (${(stats.size / 1024).toFixed(1)}KB)`);
    } else {
      console.log(`   ❌ ${file.name}: ${file.path} - NOT FOUND`);
      return false;
    }
  }
  
  return true;
}

async function generateProof() {
  console.log('\n🔄 Generating ZK proof...');
  
  try {
    console.log('   📊 Input data:');
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
    
    console.log('\n✅ Proof generated successfully!');
    
    // Display proof structure
    console.log('\n📊 Proof Data:');
    console.log('   A:', proof.pi_a);
    console.log('   B:', proof.pi_b);
    console.log('   C:', proof.pi_c);
    console.log('   Protocol:', proof.protocol);
    console.log('   Curve:', proof.curve);
    
    console.log('\n📈 Public Signals:');
    console.log('   [0] Valid:', publicSignals[0]);
    console.log('   [1] Commit:', publicSignals[1]);
    console.log('   [2] Nonce:', publicSignals[2]);
    console.log('   [3] Offered Price:', publicSignals[3]);
    console.log('   [4] Offered Amount:', publicSignals[4]);
    
    // Save proof files for verification
    fs.writeFileSync(PROOF_PATH, JSON.stringify(proof, null, 2));
    fs.writeFileSync(PUBLIC_PATH, JSON.stringify(publicSignals, null, 2));
    
    console.log('\n💾 Proof files saved:');
    console.log('   📁 Proof:', PROOF_PATH);
    console.log('   📁 Public signals:', PUBLIC_PATH);
    
    return { proof, publicSignals };
    
  } catch (error) {
    console.error('\n❌ Proof generation failed:', error.message);
    throw error;
  }
}

function testInvalidInputs() {
  console.log('\n❌ Testing invalid inputs...');
  
  // Test price constraint violation
  const invalidInputs = {
    ...SAMPLE_INPUTS,
    offeredPrice: "1500" // Below secret price of 2000
  };
  
  console.log('   Testing price constraint violation (offered: 1500, secret: 2000):');
  const isValid = validateInputs(invalidInputs);
  if (!isValid) {
    console.log('   ✅ Correctly rejected invalid inputs');
  } else {
    console.log('   ❌ Should have rejected invalid inputs!');
  }
}

async function main() {
  console.log('🚀 ZK Proof Generation Test');
  console.log('================================');
  
  try {
    // Check required files exist
    if (!checkFiles()) {
      console.error('\n💥 Required files missing. Run: npm run circuit:setup');
      process.exit(1);
    }
    
    // Test input validation
    if (!validateInputs(SAMPLE_INPUTS)) {
      console.error('\n💥 Input validation failed');
      process.exit(1);
    }
    
    // Test invalid inputs
    testInvalidInputs();
    
    // Generate proof
    const result = await generateProof();
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Required files found');
    console.log('   ✅ Input validation working');
    console.log('   ✅ Invalid input detection working');
    console.log('   ✅ Proof generation successful');
    console.log('   ✅ Proof files saved');
    console.log('\n🔄 Next: Run `npm run circuit:verify` to verify the generated proof');
    
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main();
}

module.exports = { validateInputs, generateProof, SAMPLE_INPUTS }; 