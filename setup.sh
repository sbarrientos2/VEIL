#!/bin/bash
# VEIL Project Setup Script for Ubuntu
# Run: chmod +x setup.sh && ./setup.sh

set -e

echo "🔐 VEIL Project Setup"
echo "====================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on Ubuntu/Debian
if ! command -v apt &> /dev/null; then
    echo -e "${RED}This script is designed for Ubuntu/Debian. Please adapt for your OS.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 1: Installing system dependencies...${NC}"
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev libudev-dev curl git

echo -e "\n${YELLOW}Step 2: Installing Rust...${NC}"
if ! command -v rustc &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo -e "${GREEN}Rust already installed: $(rustc --version)${NC}"
fi

echo -e "\n${YELLOW}Step 3: Installing Solana CLI...${NC}"
if ! command -v solana &> /dev/null; then
    sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
    echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
else
    echo -e "${GREEN}Solana already installed: $(solana --version)${NC}"
fi

echo -e "\n${YELLOW}Step 4: Installing Anchor...${NC}"
if ! command -v anchor &> /dev/null; then
    cargo install --git https://github.com/coral-xyz/anchor avm --locked
    avm install 0.30.1
    avm use 0.30.1
else
    echo -e "${GREEN}Anchor already installed: $(anchor --version)${NC}"
fi

echo -e "\n${YELLOW}Step 5: Installing Node.js (v20+)...${NC}"
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo -e "${GREEN}Node.js already installed: $(node --version)${NC}"
fi

echo -e "\n${YELLOW}Step 6: Installing Arcium CLI...${NC}"
if ! command -v arcium &> /dev/null; then
    curl -sSfL https://cli.arcium.com/install.sh | bash
    export PATH="$HOME/.arcium/bin:$PATH"
    echo 'export PATH="$HOME/.arcium/bin:$PATH"' >> ~/.bashrc
else
    echo -e "${GREEN}Arcium already installed: $(arcium --version)${NC}"
fi

echo -e "\n${YELLOW}Step 7: Setting up Solana for devnet...${NC}"
solana config set --url devnet
if [ ! -f ~/.config/solana/id.json ]; then
    echo "Generating new Solana keypair..."
    solana-keygen new --no-bip39-passphrase
fi
echo -e "${GREEN}Solana configured for devnet${NC}"
echo "Your address: $(solana address)"

echo -e "\n${YELLOW}Step 8: Installing project dependencies...${NC}"
npm install

echo -e "\n${YELLOW}Step 9: Installing frontend dependencies...${NC}"
cd app && npm install && cd ..

echo -e "\n${YELLOW}Step 10: Building the SDK...${NC}"
npx tsc --project tsconfig.sdk.json --noEmit && echo -e "${GREEN}SDK compiles successfully${NC}"

echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Get devnet SOL: solana airdrop 2"
echo "  2. Build program: arcium build"
echo "  3. Run frontend: cd app && npm run dev"
echo "  4. Open http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  arcium build          - Build Solana program + MPC circuits"
echo "  arcium test           - Run tests with local Arcium network"
echo "  arcium deploy         - Deploy to devnet"
echo "  cd app && npm run dev - Start frontend dev server"
echo ""
echo "Read CLAUDE.md for full project documentation."
