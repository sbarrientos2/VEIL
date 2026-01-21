# VEIL - Private Parimutuel Prediction Market

> *"The truth emerges from encrypted consensus, not whale manipulation."*

VEIL is a decentralized prediction market on Solana where **bets are encrypted until resolution**. Using Arcium's Multi-Party Computation (MPC), individual bet positions remain completely private - no one can see who bet what until the market resolves.

## The Problem

Traditional prediction markets like Polymarket suffer from:
- **Whale manipulation** - Large bettors visibly move markets
- **Herding behavior** - Users follow "smart money" instead of thinking independently
- **Front-running** - Bots exploit visible pending transactions
- **Doxxing risk** - High-profile bettors face harassment

## The Solution

VEIL uses a **sealed envelope** approach:
1. Users place encrypted bets (amount + direction hidden)
2. Bets aggregate in MPC without revealing individual positions
3. At resolution, all bets are revealed simultaneously
4. Winners share the losing pool (parimutuel payout)

**Result**: True collective intelligence, not whale-following contests.

## How It Works

```
User → Encrypt Bet → MPC Aggregation → Resolution → Reveal All → Payouts
         (private)      (private)        (oracle)    (public)    (claim)
```

### Parimutuel Model

- All bets go into YES/NO pools
- Winners split the losing pool (minus small fee)
- No fixed odds - final payout determined by pool ratios

### Privacy Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Bet Privacy | Arcium MPC | Encrypt bet positions |
| Fund Privacy | Privacy Cash | Private deposits/withdrawals |
| Cost Optimization | Light Protocol | ZK compression (optional) |

## Tech Stack

- **Blockchain**: Solana
- **Smart Contracts**: Anchor Framework (Rust)
- **MPC**: Arcium Network
- **Frontend**: Next.js + React
- **Oracle**: Switchboard

## Project Structure

```
VEIL/
├── encrypted-ixs/          # Arcis MPC circuits
│   └── src/lib.rs          # Encrypted instructions
├── programs/veil/          # Solana program
│   └── src/
│       ├── lib.rs          # Entry point
│       ├── state/          # Account structures
│       ├── instructions/   # Instruction handlers
│       └── arcium/         # MPC integration
├── app/                    # Frontend (Next.js)
└── tests/                  # TypeScript tests
```

## Getting Started

### Prerequisites

- Rust (latest stable)
- Solana CLI (2.3.0+)
- Anchor (0.32.1)
- Node.js (18+)
- Arcium CLI

### Installation

```bash
# Install Arcium
curl --proto '=https' --tlsv1.2 -sSfL https://install.arcium.com/ | bash

# Clone and setup
cd VEIL
yarn install

# Build
arcium build
# or
anchor build

# Test
arcium test
# or
anchor test
```

### Deploy to Devnet

```bash
arcium deploy --cluster-offset 123 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url https://devnet.helius-rpc.com/?api-key=YOUR_KEY
```

## MPC Instructions

### Encrypted Circuits

1. **`init_market_state`** - Initialize zero pools
2. **`place_bet`** - Aggregate encrypted bet into pools
3. **`reveal_market_totals`** - Reveal pool sizes at resolution
4. **`calculate_payout_pools`** - Calculate winner/loser pools

### Privacy Guarantees

- Individual bets never revealed (only aggregates)
- User can verify their own bet (they have the keys)
- No single MPC node sees any data
- Threshold decryption at resolution

## API

### Create Market

```typescript
await program.methods
  .createMarket(
    marketId,
    "Will BTC hit $100k by Dec 2026?",
    resolutionTime,
    0, // Manual oracle
    300 // 3% fee
  )
  .accounts({ market, vault, authority })
  .rpc();
```

### Place Bet

```typescript
// Encrypt bet client-side
const encrypted = await encryptBet(outcome, amount, mxePublicKey);

await program.methods
  .placeBet(
    computationOffset,
    encrypted.outcome,
    encrypted.amount,
    encrypted.publicKey,
    encrypted.nonce,
    betLamports
  )
  .accounts({ market, vault, betRecord, bettor })
  .rpc();
```

### Claim Payout

```typescript
await program.methods
  .claimPayout(myOutcome, myAmount)
  .accounts({ market, vault, betRecord, bettor })
  .rpc();
```

## Hackathon

**Solana Privacy Hack** (January 12-30, 2026)

### Prize Tracks

- Arcium: $10,000
- Privacy Cash: $15,000
- Open Track: $18,000

**Total potential: $43,000+**

## Roadmap

- [x] Architecture design
- [x] MPC circuit implementation
- [x] Solana program structure
- [ ] Full Arcium integration
- [ ] Privacy Cash integration
- [ ] Frontend development
- [ ] Devnet deployment
- [ ] Demo video

## License

MIT

## Team

Built for Solana Privacy Hack 2026

---

*VEIL: Where your bets stay hidden until the truth is revealed.*
