'use client';

import React, { useEffect, useState } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const ALCHEMY_RPC = 'https://solana-mainnet.g.alchemy.com/v2/JVHlfnuzTGEkfHKOYP1W-SEgjCv1IzEt';

const SolanaHFTBot = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Connect to Phantom Wallet
  const connectWallet = async () => {
    if (window?.solana?.isPhantom) {
      try {
        const resp = await window.solana.connect();
        setWalletAddress(resp.publicKey.toString());
      } catch (err) {
        console.error('User rejected connection', err);
      }
    } else {
      alert('Phantom Wallet not detected. Install Phantom to use this bot.');
    }
  };

  // Auto-detect wallet if already connected
  useEffect(() => {
    const checkIfWalletConnected = async () => {
      try {
        if (window?.solana?.isPhantom) {
          const response = await window.solana.connect({ onlyIfTrusted: true });
          setWalletAddress(response.publicKey.toString());
        }
      } catch (err) {
        console.warn('Phantom not connected');
      }
    };
    checkIfWalletConnected();
  }, []);

  // Get balance when wallet is connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (!walletAddress) return;
      setLoading(true);
      try {
        const connection = new Connection(ALCHEMY_RPC, 'confirmed');
        const publicKey = new PublicKey(walletAddress);
        const lamports = await connection.getBalance(publicKey);
        setBalance(lamports / LAMPORTS_PER_SOL);
      } catch (err) {
        console.error('Failed to fetch balance', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBalance();
  }, [walletAddress]);

  return (
    <div style={{ padding: 20, fontFamily: 'Arial', background: '#0b0b0b', color: '#fff', minHeight: '100vh' }}>
      <h1>🚀 Solana HFT Bot</h1>

      {!walletAddress ? (
        <button onClick={connectWallet} style={{ padding: '12px 24px', fontSize: 16, cursor: 'pointer' }}>
          Connect Phantom Wallet
        </button>
      ) : (
        <div>
          <p><strong>Wallet:</strong> {walletAddress}</p>
          {loading ? (
            <p>Fetching balance...</p>
          ) : (
            <p><strong>SOL Balance:</strong> {balance ?? '0'} SOL</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SolanaHFTBot;