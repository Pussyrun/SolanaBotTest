'use client';

import React, { useEffect, useState } from 'react';
import { Connection } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';

const connection = new Connection(
  'https://solana-mainnet.g.alchemy.com/v2/JVHlfnuzTGEkfHKOYP1W-SEgjCv1IzEt',
  'confirmed'
);

const SolanaHFTBot = () => {
  const { publicKey } = useWallet();
  const [solBalance, setSolBalance] = useState<number | null>(null);

  useEffect(() => {
    const getBalance = async () => {
      if (!publicKey) return;
      try {
        const balance = await connection.getBalance(publicKey);
        const sol = balance / 1e9;
        console.log('💰 SOL Balance:', sol);
        setSolBalance(sol);
      } catch (err) {
        console.error('❌ Error getting balance:', err);
      }
    };

    getBalance();
  }, [publicKey]);

  return (
    <div className="p-4 bg-zinc-900 text-white rounded">
      <h2 className="text-xl font-bold mb-2">Phantom Wallet</h2>
      {publicKey ? (
        <>
          <p className="mb-2">🔗 Connected: {publicKey.toBase58()}</p>
          <p>💰 Balance: {solBalance !== null ? `${solBalance} SOL` : 'Loading...'}</p>
        </>
      ) : (
        <p>🔌 Wallet not connected</p>
      )}
    </div>
  );
};

export default SolanaHFTBot;