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
      chainId: 1, // Ensure forked network reports mainnet chain ID
      // Set higher gas limits and prices for mainnet fork
      gasPrice: 20000000000, // 20 gwei
      gas: 30000000,
      allowUnlimitedContractSize: true
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1, // Matches forked mainnet
      accounts: "remote", // Use accounts from the running node
      gas: 30000000,
      gasPrice: 20000000000,
      allowUnlimitedContractSize: true
    }
  }
};

export default config;
