# VEIL Project Status

> Last updated: January 2026
> This file helps new Claude sessions understand the current state of the project.

## What is VEIL?

VEIL is a **private parimutuel prediction market** on Solana using Arcium MPC (Multi-Party Computation). Users place encrypted bets that remain hidden until market resolution - preventing whale watching, front-running, and herding behavior.

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VEIL STACK                              │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (app/)         │  Next.js 14, Tailwind, Wallet Adapter│
│  SDK (sdk/)              │  TypeScript, RescueCipher encryption │
│  Program (programs/veil/)│  Anchor 0.30.1, Rust                 │
│  MPC Circuits            │  Arcium Arcis (encrypted-ixs/)       │
│  Network                 │  Solana Devnet + Arcium MPC          │
└─────────────────────────────────────────────────────────────────┘
```

## Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| Solana Program | 95% | Oracle verification stubbed for Switchboard/Jury |
| MPC Circuits | 100% | init_market_state, place_bet, calculate_payout_pools |
| SDK | 95% | RescueCipher encryption working, MXE key fetching ready |
| Frontend | 85% | All pages built, hooks connected, mock data fallback |
| Tests | 10% | Basic structure, needs expansion |

## Key Files to Understand

### Program (Rust)
- `programs/veil/src/lib.rs` - Main Anchor program with MPC integration
- `encrypted-ixs/src/lib.rs` - Arcis MPC circuits

### SDK (TypeScript)
- `sdk/client.ts` - VeilClient class with all market operations
- `sdk/encryption.ts` - RescueCipher encryption (NOT XOR placeholder)
- `sdk/pdas.ts` - PDA derivation helpers
- `sdk/types.ts` - TypeScript types matching on-chain structures

### Frontend (Next.js)
- `app/src/hooks/useVeil.ts` - React hooks for SDK integration
- `app/src/lib/veil-types.ts` - UI types and transformations
- `app/src/app/markets/[id]/page.tsx` - Market detail + betting UI
- `app/src/app/portfolio/page.tsx` - User bets and claims

## Encryption Flow

```
User Input → X25519 Key Exchange → RescueCipher Encrypt → On-Chain
     │              │                      │
     │       getMxePublicKey()      cipher.encrypt()
     │              │                      │
     └──────────────┴──────────────────────┘
                    │
        encryptBet(outcome, amount, mxePublicKey)
                    │
                    ▼
        { encryptedOutcome, encryptedAmount, userPubkey, nonce }
```

## Important Implementation Details

### 1. Encryption Uses Real RescueCipher
```typescript
// sdk/encryption.ts - This is the CORRECT implementation
import { RescueCipher, deserializeLE } from "@arcium-hq/client";

const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
const cipher = new RescueCipher(sharedSecret);
const ciphertexts = cipher.encrypt(plaintext, nonceBytes);
```

### 2. MXE Public Key is Fetched, Not Hardcoded
```typescript
// sdk/client.ts
async getMxePublicKey(): Promise<Uint8Array> {
  const mxePublicKey = await getMXEPublicKey(this.provider, this.programId);
  // Validates it's not all zeros
  return mxePublicKey;
}
```

### 3. Frontend Uses Dynamic SDK Imports (SSR Safe)
```typescript
// app/src/hooks/useVeil.ts
async function initializeSdk() {
  if (typeof window === "undefined") return null;
  const sdk = await import("../../../sdk");
  // ...
}
```

### 4. Type Transformations (BN ↔ number)
```typescript
// app/src/lib/veil-types.ts
export function transformMarket(sdkMarket: Market): UIMarket {
  return {
    yesPool: sdkMarket.revealedYesPool.toNumber() / LAMPORTS_PER_SOL,
    // ... BN to number conversions
  };
}
```

## What's NOT Done Yet

1. **Oracle Integration** - Switchboard and Jury oracle types are stubbed
2. **Test Coverage** - Tests exist but are mostly empty
3. **Real Market Testing** - Need to test full flow on devnet with real MPC
4. **Error Handling** - Could be more robust in frontend
5. **Mobile Optimization** - Basic responsive, needs polish

## Commands Reference

```bash
# Development
cd app && npm run dev          # Start frontend (http://localhost:3000)
npx tsc --project tsconfig.sdk.json --noEmit  # Check SDK types

# Build & Deploy
arcium build                   # Build program + circuits
arcium deploy --cluster devnet # Deploy to devnet

# Testing
arcium test                    # Run with local Arcium network
arcium localnet                # Start local network (requires Docker)
```

## Program Deployed

- **Program ID**: `FLPWpbDR64Ehb8Vo27YbDJQtPqGf488JwJmY3vH5uMxy`
- **Network**: Solana Devnet
- **Cluster Offset**: 456 (for Arcium MPC)

## Recent Changes (January 2026)

1. **Fixed encryption** - Replaced XOR placeholder with real RescueCipher
2. **Added MXE key fetching** - Client fetches from on-chain account
3. **Built complete frontend** - All pages with dark theme
4. **SDK browser compatibility** - Works in Node.js and browsers
5. **Type transformations** - BN ↔ number for frontend

## For New Claude Sessions

When starting a new Claude session on this project:

1. Read `CLAUDE.md` for full technical documentation
2. Read this file (`PROJECT_STATUS.md`) for current state
3. Key directories: `sdk/`, `app/`, `programs/veil/`
4. The encryption is REAL (RescueCipher), not a placeholder
5. Frontend uses mock data fallback when wallet not connected

## GitHub

Repository: https://github.com/sbarrientos2/VEIL
