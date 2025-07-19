'use client';

import React, { useEffect, useState } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Wallet, WalletIcon, Bot, Activity, Eye, Zap, TrendingUp } from 'lucide-react';

// Mainnet RPC (Alchemy)
const RPC_URL = 'https://solana-mainnet.g.alchemy.com/v2/JVHlfnuzTGEkfHKOYP1IzEt';
const connection = new Connection(RPC_URL, 'confirmed');

interface TokenInfo {
  address: string;
  chainId: number;
  decimals: number;
  logoURI: string;
  name: string;
  symbol: string;
  tags?: string[];
  price?: number;
}

export default function SolanaHFTBot() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [solBalance, setSolBalance] = useState(0);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [userTokens, setUserTokens] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<{ type: string; message: string }[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [tradeAmount, setTradeAmount] = useState('');
  const [swapTx, setSwapTx] = useState<string | null>(null);
  const [isTrading, setIsTrading] = useState(false);
  const [solPrice, setSolPrice] = useState(0);

  // Connect Phantom wallet
  const connectWallet = async () => {
    if ((window as any).solana && (window as any).solana.isPhantom) {
      try {
        const resp = await (window as any).solana.connect();
        const pubkey = resp.publicKey.toString();
        setWalletAddress(pubkey);
        setWalletConnected(true);
        fetchBalances(pubkey);
        setAlerts(a => [...a, { type: 'success', message: 'Wallet connected!' }]);
      } catch (err: any) {
        setAlerts(a => [...a, { type: 'error', message: err.message }]);
      }
    } else {
      setAlerts(a => [...a, { type: 'error', message: 'Please install Phantom wallet.' }]);
    }
  };

  // Fetch balances and tokens
  const fetchBalances = async (pubkey: string) => {
    // SOL balance
    const sol = await connection.getBalance(new PublicKey(pubkey));
    setSolBalance(sol / 1e9);

    // Token meta/prices
    const jupTokens: TokenInfo[] = await fetch('https://cache.jup.ag/tokens').then(r => r.json());
    setTokens(jupTokens);

    // Fetch user SPL tokens
    const accounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(pubkey),
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    const userSplTokens = accounts.value
      .map((acc: any) => {
        const mint = acc.account.data.parsed.info.mint;
        const balance = Number(acc.account.data.parsed.info.tokenAmount.uiAmount);
        const meta = jupTokens.find(t => t.address === mint);
        return meta && balance > 0
          ? { ...meta, balance }
          : null;
      })
      .filter(Boolean);
    setUserTokens(userSplTokens as any[]);
  };

  // Get live SOL price for USD calc
  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
      .then(r => r.json())
      .then(j => setSolPrice(j.solana.usd || 0));
  }, []);

  // On wallet connect, fetch balances
  useEffect(() => {
    if (walletConnected && walletAddress) {
      fetchBalances(walletAddress);
    }
    // eslint-disable-next-line
  }, [walletConnected, walletAddress]);

  // Jupiter swap/trade function
  const tradeToken = async () => {
    if (!walletConnected || !selectedToken || !tradeAmount) return;
    setIsTrading(true);

    try {
      // Get route from Jupiter API
      const inputAmount = Math.floor(Number(tradeAmount) * 1e9); // SOL in lamports
      const params = new URLSearchParams({
        inputMint: 'So11111111111111111111111111111111111111112', // SOL
        outputMint: selectedToken.address,
        amount: inputAmount.toString(),
        slippageBps: '100', // 1%
        userPublicKey: walletAddress,
        onlyDirectRoutes: 'false',
      });
      const quoteUrl = `https://quote-api.jup.ag/v6/quote?${params}`;
      const quote = await fetch(quoteUrl).then(r => r.json());

      if (!quote.routes || !quote.routes[0]) {
        setAlerts(a => [...a, { type: 'error', message: 'No route found for this swap.' }]);
        setIsTrading(false);
        return;
      }

      // Prepare swap transaction
      const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route: quote.routes[0],
          userPublicKey: walletAddress,
          wrapUnwrapSOL: true,
        }),
      }).then(r => r.json());

      if (!swapRes.swapTransaction) {
        setAlerts(a => [...a, { type: 'error', message: 'Swap TX could not be built.' }]);
        setIsTrading(false);
        return;
      }

      // Sign/send TX with Phantom
      const swapTxBuf = Buffer.from(swapRes.swapTransaction, 'base64');
      const tx = Transaction.from(swapTxBuf);

      const signed = await (window as any).solana.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true,
      });
      setSwapTx(sig);
      setAlerts(a => [...a, { type: 'success', message: 'Trade sent! Tx: ' + sig }]);
      setIsTrading(false);
      // Refetch balances after a short wait
      setTimeout(() => fetchBalances(walletAddress), 7000);
    } catch (err: any) {
      setAlerts(a => [...a, { type: 'error', message: err.message }]);
      setIsTrading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Bot className="w-8 h-8 text-blue-400" />
          <h1 className="text-2xl font-bold">Solana HFT Intelligence Bot</h1>
          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">MAINNET</span>
        </div>
        <div>
          {!walletConnected ? (
            <button
              onClick={connectWallet}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </button>
          ) : (
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-gray-400">SOL Balance</div>
                <div className="text-lg font-bold text-blue-400">
                  {solBalance.toFixed(4)}
                </div>
                <div className="text-xs text-gray-400">
                  ≈ ${ (solBalance * solPrice).toLocaleString(undefined, {maximumFractionDigits:2}) }
                </div>
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {walletAddress.slice(0, 6)}…{walletAddress.slice(-6)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      <div className="px-6 py-2">
        {alerts.slice(-3).map((a, i) => (
          <div key={i}
            className={`mb-2 p-2 rounded ${a.type === 'success' ? 'bg-green-900' : a.type === 'error' ? 'bg-red-900' : 'bg-yellow-900'} border`}>
            {a.message}
          </div>
        ))}
      </div>

      <div className="p-6">
        {/* Token list & trade */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* User tokens */}
          <div>
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2"><Eye className="w-4 h-4" />Your Tokens</h2>
            <div className="space-y-2">
              <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex flex-col gap-1">
                <div className="flex justify-between items-center text-sm text-gray-400">
                  <span>SOL</span>
                  <span>{solBalance.toFixed(4)} (≈${(solBalance * solPrice).toLocaleString(undefined, {maximumFractionDigits:2})})</span>
                </div>
              </div>
              {userTokens.length === 0 && (
                <div className="text-xs text-gray-500">No SPL tokens found.</div>
              )}
              {userTokens.map(t => (
                <div key={t.address} className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <img src={t.logoURI} alt={t.symbol} className="w-5 h-5 rounded" />
                    <span className="font-bold">{t.symbol}</span>
                    <span className="text-xs text-gray-400">{t.name}</span>
                  </div>
                  <div>
                    {t.balance.toLocaleString(undefined, {maximumFractionDigits:6})}
                    {t.price && (
                      <span className="text-xs text-gray-400 ml-1">
                        (≈${(t.balance * t.price).toLocaleString(undefined, {maximumFractionDigits:2})})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live tokens and trade form */}
          <div>
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2"><Zap className="w-4 h-4" />Trade SOL for Token (Jupiter)</h2>
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <label className="block mb-2 text-sm">Select Token to Buy:</label>
              <select
                value={selectedToken?.address || ''}
                onChange={e => setSelectedToken(tokens.find(t => t.address === e.target.value) || null)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full mb-4"
              >
                <option value="">-- Choose --</option>
                {tokens
                  .filter(t => t.symbol !== 'SOL' && t.price)
                  .slice(0, 50)
                  .map(t => (
                    <option value={t.address} key={t.address}>
                      {t.symbol} ({t.name})
                    </option>
                  ))}
              </select>
              <label className="block mb-2 text-sm">Amount SOL to Swap:</label>
              <input
                type="number"
                min="0.001"
                step="0.0001"
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full mb-4"
                value={tradeAmount}
                onChange={e => setTradeAmount(e.target.value)}
                disabled={!walletConnected}
              />
              <button
                onClick={tradeToken}
                className={`w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold transition-all ${isTrading ? 'opacity-50 cursor-wait' : ''}`}
                disabled={!walletConnected || !selectedToken || !tradeAmount || isTrading}
              >
                {isTrading ? 'Trading...' : 'Trade'}
              </button>
              {swapTx && (
                <div className="mt-2 text-xs">
                  View TX: <a href={`https://solscan.io/tx/${swapTx}`} className="text-blue-400 underline" target="_blank" rel="noopener noreferrer">{swapTx}</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}