# DarkSwap Frontend

Modern React frontend for DarkSwap - the privacy-preserving DEX with hidden order constraints.

## Features

- 🔐 **Privacy-First**: Zero-knowledge proof integration
- 💼 **Wallet Integration**: RainbowKit + wagmi for seamless Web3 UX
- 🎨 **Modern UI**: TailwindCSS + shadcn/ui components
- 📱 **Responsive**: Mobile-first design
- 🌙 **Theme Support**: Dark/light mode switching
- ⚡ **Performance**: Next.js 14 with App Router
- 🔄 **Real-time**: Live order updates and status tracking

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS + shadcn/ui
- **Web3**: wagmi + viem + RainbowKit
- **State**: Zustand + TanStack Query
- **Forms**: React Hook Form + zod
- **Icons**: Lucide React

## Quick Start

### Prerequisites

1. Node.js 18+ installed
2. Backend services running:

   ```bash
   # Terminal 1: Start local hardhat network
   npx hardhat node

   # Terminal 2: Deploy contracts
   npx hardhat run scripts/deploy.ts --network localhost

   # Terminal 3: Start API service
   npx hardhat run scripts/runMakerService.ts --network localhost
   ```

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

## Project Structure

```
frontend/
├── app/                 # Next.js App Router pages
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   ├── layout/         # Layout components
│   ├── providers/      # Context providers
│   ├── maker/          # Maker-specific components
│   └── taker/          # Taker-specific components
├── lib/                # Utilities and configuration
│   ├── config/         # Web3 and chain configuration
│   ├── hooks/          # Custom React hooks
│   └── utils/          # Helper functions
└── types/              # TypeScript type definitions
```

## Development

```bash
# Development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

Create `.env.local` with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=optional-project-id
```

## User Flows

### Maker Flow

1. Connect wallet
2. Navigate to `/maker`
3. Create order with public limits and hidden constraints
4. Sign order with Metamask
5. Publish to storage
6. Monitor order status

### Taker Flow

1. Connect wallet
2. Navigate to `/taker`
3. Browse available orders
4. Select order and specify fill amount
5. Request authorization from maker's API
6. Execute order on-chain if approved

## Contributing

This is a hackathon project demonstrating privacy-preserving DeFi concepts.

## License

MIT
