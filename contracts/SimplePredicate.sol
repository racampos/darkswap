// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SimplePredicate
 * @dev A simple predicate contract for testing 1inch limit order predicates
 * @notice This contract stores a gate value that can be used to control order execution
 */
contract SimplePredicate {
    uint256 public gateValue;

    /**
     * @dev Sets the gate value that controls predicate evaluation
     * @param _value The new gate value
     */
    function setGateValue(uint256 _value) external {
        gateValue = _value;
    }

    /**
     * @dev Returns the current gate value
     * @return The current gate value
     */
    function getGateValue() external view returns (uint256) {
        return gateValue;
    }
}
