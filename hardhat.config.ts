import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_MAINNET_URL!,
      },
      chainId: 31337, // Custom chain ID for local development
      // Set higher gas limits and prices for mainnet fork
      gasPrice: 20000000000, // 20 gwei
      gas: 30000000,
      allowUnlimitedContractSize: true
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337, // Custom chain ID for local development
      accounts: "remote", // Use accounts from the running node
      gas: 30000000,
      gasPrice: 20000000000,
      allowUnlimitedContractSize: true
    }
  }
};

export default config;
