//! Arcium MPC Integration Helpers
//!
//! Provides utilities for queuing computations and handling callbacks.

use anchor_lang::prelude::*;

/// MXE account seeds
pub const MXE_SEED: &[u8] = b"mxe";
pub const MEMPOOL_SEED: &[u8] = b"mempool";
pub const CLUSTER_SEED: &[u8] = b"cluster";
pub const COMP_DEF_SEED: &[u8] = b"comp_def";

/// Encrypted data wrapper
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct EncryptedData {
    /// Rescue cipher encrypted data
    pub ciphertext: [u8; 32],
    /// Encryption nonce
    pub nonce: [u8; 16],
    /// Owner public key (for re-encryption)
    pub owner: Option<Pubkey>,
}

impl Default for EncryptedData {
    fn default() -> Self {
        Self {
            ciphertext: [0u8; 32],
            nonce: [0u8; 16],
            owner: None,
        }
    }
}

/// MPC computation status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ComputationStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

/// Arguments builder for MPC computations
/// (Simplified version - full version would use arcium-client)
pub struct ArgBuilder {
    args: Vec<u8>,
}

impl ArgBuilder {
    pub fn new() -> Self {
        Self { args: Vec::new() }
    }

    /// Add X25519 public key
    pub fn x25519_pubkey(mut self, pubkey: [u8; 32]) -> Self {
        self.args.extend_from_slice(&pubkey);
        self
    }

    /// Add plaintext u128
    pub fn plaintext_u128(mut self, value: u128) -> Self {
        self.args.extend_from_slice(&value.to_le_bytes());
        self
    }

    /// Add plaintext bool
    pub fn plaintext_bool(mut self, value: bool) -> Self {
        self.args.push(if value { 1 } else { 0 });
        self
    }

    /// Add encrypted bool
    pub fn encrypted_bool(mut self, ciphertext: [u8; 32]) -> Self {
        self.args.extend_from_slice(&ciphertext);
        self
    }

    /// Add encrypted u64
    pub fn encrypted_u64(mut self, ciphertext: [u8; 32]) -> Self {
        self.args.extend_from_slice(&ciphertext);
        self
    }

    /// Add account reference for reading
    pub fn account(mut self, key: Pubkey, offset: usize, size: usize) -> Self {
        self.args.extend_from_slice(&key.to_bytes());
        self.args.extend_from_slice(&(offset as u32).to_le_bytes());
        self.args.extend_from_slice(&(size as u32).to_le_bytes());
        self
    }

    /// Build final arguments
    pub fn build(self) -> Vec<u8> {
        self.args
    }
}

impl Default for ArgBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Derive MXE PDA
pub fn derive_mxe_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[MXE_SEED], program_id)
}

/// Derive mempool PDA
pub fn derive_mempool_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[MEMPOOL_SEED], program_id)
}

/// Derive cluster PDA
pub fn derive_cluster_pda(program_id: &Pubkey, offset: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[CLUSTER_SEED, &offset.to_le_bytes()],
        program_id,
    )
}

/// Derive computation definition PDA
pub fn derive_comp_def_pda(program_id: &Pubkey, name: &str) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[COMP_DEF_SEED, name.as_bytes()],
        program_id,
    )
}

/// Helper to queue an MPC computation
/// In production, this would CPI to the Arcium program
#[allow(dead_code)]
pub fn queue_computation(
    _computation_offset: u64,
    _instruction_index: u8,
    _args: Vec<u8>,
    _callback_ix: Vec<u8>,
) -> Result<()> {
    // In production:
    // 1. Build instruction data
    // 2. Create account metas for all MXE accounts
    // 3. CPI to Arcium program
    // 4. Return computation ID

    msg!("MPC computation queued (mock mode)");
    Ok(())
}

/// Verify computation output signature
/// In production, this would verify the cluster signature
#[allow(dead_code)]
pub fn verify_computation_output(
    _cluster_account: &AccountInfo,
    _computation_account: &AccountInfo,
    output: &[u8],
) -> Result<Vec<u8>> {
    // In production:
    // 1. Verify cluster signature
    // 2. Verify computation ID matches
    // 3. Extract and return output

    Ok(output.to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_arg_builder() {
        let args = ArgBuilder::new()
            .plaintext_bool(true)
            .plaintext_u128(12345)
            .build();

        assert!(!args.is_empty());
    }
}
