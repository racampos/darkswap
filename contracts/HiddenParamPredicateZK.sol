// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Groth16Verifier.sol";

/**
 * @title HiddenParamPredicateZK
 * @dev Zero-knowledge predicate for 1inch Limit Order Protocol
 * @notice Verifies ZK proofs to enforce hidden parameter constraints in orders
 * @author DarkSwap Team
 */
contract HiddenParamPredicateZK {
    /// @dev The Groth16 verifier contract for ZK proof verification
    Groth16Verifier public immutable verifier;

    /// @dev Expected length of ABI-encoded proof data (13 uint256 values = 416 bytes + encoding overhead)
    uint256 private constant MIN_PROOF_DATA_LENGTH = 416;

    /**
     * @dev Custom errors for gas-efficient error handling
     */
    error InvalidProofDataLength();
    error ProofDecodingFailed();
    error InvalidPublicSignals();

    /**
     * @dev Decoded proof components structure
     */
    struct DecodedProof {
        uint256[2] pi_a;
        uint256[2][2] pi_b;
        uint256[2] pi_c;
        uint256[5] publicSignals;
    }

    /**
     * @dev Constructor sets the Groth16 verifier contract address
     * @param _verifier Address of the deployed Groth16Verifier contract
     */
    constructor(address _verifier) {
        require(
            _verifier != address(0),
            "HiddenParamPredicateZK: verifier cannot be zero address"
        );
        verifier = Groth16Verifier(_verifier);
    }

    /**
     * @dev Standard 1inch LOP predicate interface
     * @param data ABI-encoded proof data containing ZK proof and public signals
     * @return result 1 if proof is valid and constraints satisfied, 0 otherwise
     */
    function predicate(
        bytes calldata data
    ) external view returns (uint256 result) {
        // Basic input validation
        if (data.length == 0) {
            return 0; // Invalid: empty proof data
        }

        if (data.length < MIN_PROOF_DATA_LENGTH) {
            return 0; // Invalid: insufficient data length
        }

        // Decode proof data from bytes
        DecodedProof memory proof;
        bool decodingSuccess = _decodeProofData(data, proof);

        if (!decodingSuccess) {
            return 0; // Invalid: decoding failed
        }

        // Validate public signals
        if (!_validatePublicSignals(proof.publicSignals)) {
            return 0; // Invalid: malformed public signals
        }

        // Verify ZK proof using Groth16 verifier
        bool proofValid = _verifyZKProof(proof);

        if (!proofValid) {
            return 0; // Invalid: proof verification failed
        }

        // Additional constraint validation
        if (!_validateConstraints(proof.publicSignals)) {
            return 0; // Invalid: constraint validation failed
        }

        // All validations passed
        return 1;
    }

    /**
     * @dev Decodes ABI-encoded proof data into components
     * @param data ABI-encoded bytes containing proof components
     * @param proof Output struct to populate with decoded data
     * @return success True if decoding succeeded, false otherwise
     */
    function _decodeProofData(
        bytes calldata data,
        DecodedProof memory proof
    ) internal view returns (bool success) {
        try this._unsafeDecodeProofData(data) returns (
            uint256[2] memory pi_a,
            uint256[2][2] memory pi_b,
            uint256[2] memory pi_c,
            uint256[5] memory publicSignals
        ) {
            proof.pi_a = pi_a;
            proof.pi_b = pi_b;
            proof.pi_c = pi_c;
            proof.publicSignals = publicSignals;
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Unsafe decoding function for use with try/catch
     * @param data ABI-encoded bytes
     * @return pi_a Proof component A
     * @return pi_b Proof component B
     * @return pi_c Proof component C
     * @return publicSignals Public signals array
     */
    function _unsafeDecodeProofData(
        bytes calldata data
    )
        external
        pure
        returns (
            uint256[2] memory pi_a,
            uint256[2][2] memory pi_b,
            uint256[2] memory pi_c,
            uint256[5] memory publicSignals
        )
    {
        // ABI decode the proof data
        // Expected structure: (uint256[2] pi_a, uint256[2][2] pi_b, uint256[2] pi_c, uint256[5] publicSignals)
        (pi_a, pi_b, pi_c, publicSignals) = abi.decode(
            data,
            (uint256[2], uint256[2][2], uint256[2], uint256[5])
        );
    }

    /**
     * @dev Validates public signals for basic sanity checks
     * @param publicSignals Array of 5 public signals
     * @return valid True if signals pass validation
     */
    function _validatePublicSignals(
        uint256[5] memory publicSignals
    ) internal pure returns (bool valid) {
        // Basic validation: valid signal should be 0 or 1
        if (publicSignals[0] > 1) {
            return false;
        }

        // Additional validations can be added here:
        // - Check commit is non-zero
        // - Check nonce is reasonable
        // - Check offered prices/amounts are non-zero
        // For now, we just check the valid flag

        return true;
    }

    /**
     * @dev Verifies ZK proof using the Groth16 verifier contract
     * @param proof Decoded proof components
     * @return valid True if proof verification succeeds
     */
    function _verifyZKProof(
        DecodedProof memory proof
    ) internal view returns (bool valid) {
        try
            verifier.verifyProof(
                proof.pi_a,
                proof.pi_b,
                proof.pi_c,
                proof.publicSignals
            )
        returns (bool result) {
            return result;
        } catch {
            // Verification failed (invalid proof or verifier error)
            return false;
        }
    }

    /**
     * @dev Validates constraint satisfaction from public signals
     * @param publicSignals Array of 5 public signals [valid, commit, nonce, offeredPrice, offeredAmount]
     * @return valid True if constraints are satisfied
     */
    function _validateConstraints(
        uint256[5] memory publicSignals
    ) internal pure returns (bool valid) {
        // Extract public signals
        uint256 validFlag = publicSignals[0];
        uint256 commit = publicSignals[1];
        uint256 nonce = publicSignals[2];
        uint256 offeredPrice = publicSignals[3];
        uint256 offeredAmount = publicSignals[4];

        // Constraint 1: Circuit must output valid = 1
        if (validFlag != 1) {
            return false;
        }

        // Constraint 2: Commitment must be non-zero (meaningful commitment)
        if (commit == 0) {
            return false;
        }

        // Constraint 3: Offered price and amount must be non-zero (meaningful trade)
        if (offeredPrice == 0 || offeredAmount == 0) {
            return false;
        }

        // Constraint 4: Nonce should be reasonable (prevent overflow/underflow attacks)
        // Allow zero nonce but prevent extremely large values that could indicate overflow
        if (nonce > type(uint128).max) {
            return false;
        }

        return true;
    }

    /**
     * @dev Returns the address of the Groth16 verifier contract
     * @return The verifier contract address
     */
    function getVerifier() external view returns (address) {
        return address(verifier);
    }

    /**
     * @dev Returns expected minimum proof data length for validation
     * @return The minimum expected byte length
     */
    function getMinProofDataLength() external pure returns (uint256) {
        return MIN_PROOF_DATA_LENGTH;
    }
}
