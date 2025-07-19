'use client';

import React, { useEffect, useState } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Wallet, Bot, Activity, Eye, Zap, TrendingUp, Target, BarChart3 } from 'lucide-react';

// Polyfill for Buffer
import { Buffer } from 'buffer';
if (typeof window !== 'undefined') (window as any).Buffer = Buffer;

// Use environment variable for Helius key
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;
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

  // For dashboard UI
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pnlData, setPnlData] = useState({
    total: 0,
    today: 0,
    grid: 0,
    sniper: 0,
    mev: 0,
  });
  const [botStatus, setBotStatus] = useState({
    grid: false,
    sniper: false,
    mev: false
  });

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
    try {
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
    } catch (err: any) {
      setAlerts(a => [...a, { type: 'error', message: 'Failed to fetch balances: ' + err.message }]);
    }
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

  // PnL and fake bot data for dashboard display
  useEffect(() => {
    const interval = setInterval(() => {
      setPnlData(prev => ({
        ...prev,
        total: prev.total + (Math.random() - 0.4) * 0.5,
        today: prev.today + (Math.random() - 0.4) * 0.2,
        grid: prev.grid + (botStatus.grid ? (Math.random() - 0.3) * 0.1 : 0),
        sniper: prev.sniper + (botStatus.sniper ? (Math.random() - 0.4) * 0.3 : 0),
        mev: prev.mev + (botStatus.mev ? (Math.random() - 0.35) * 0.2 : 0)
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [botStatus]);

  const toggleBot = (type: string) => {
    setBotStatus(prev => ({ ...prev, [type]: !prev[type as keyof typeof botStatus] }));
    setAlerts(a => [...a, {
      type: botStatus[type as keyof typeof botStatus] ? 'warning' : 'success',
      message: `${type.toUpperCase()} bot ${botStatus[type as keyof typeof botStatus] ? 'stopped' : 'started'}`
    }]);
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

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex space-x-6">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'bots', label: 'Trading Bots', icon: Bot },
            { id: 'tokens', label: 'Token Scanner', icon: Eye }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
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

      {/* Main Content */}
      <div className="p-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Active Bots</p>
                    <p className="text-2xl font-bold text-white">{Object.values(botStatus).filter(Boolean).length}/3</p>
                  </div>
                  <Bot className="w-8 h-8 text-purple-400" />
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Success Rate</p>
                    <p className="text-2xl font-bold text-green-400">89.7%</p>
                  </div>
                  <Target className="w-8 h-8 text-green-400" />
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">24h Volume</p>
                    <p className="text-2xl font-bold text-blue-400">$2.8K</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-blue-400" />
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Tokens Tracked</p>
                    <p className="text-2xl font-bold text-cyan-400">{tokens.length}</p>
                  </div>
                  <Eye className="w-8 h-8 text-cyan-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bots' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-4">Trading Engines</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  type: 'grid',
                  icon: TrendingUp,
                  desc: 'Dynamic grid trading with ATR volatility bands and auto-compounding',
                  label: 'GRID Engine'
                },
                {
                  type: 'sniper',
                  icon: Zap,
                  desc: '2-5 second token launch detection with liquidity injection monitoring',
                  label: 'SNIPER Engine'
                },
                {
                  type: 'mev',
                  icon: Activity,
                  desc: 'Frontrunning and flash-loan arbitrage across DEX pools',
                  label: 'MEV Arbitrage'
                }
              ].map(bot => (
                <div key={bot.type} className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 transition-all relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <bot.icon className="w-6 h-6 text-blue-400" />
                      <h3 className="text-lg font-semibold text-white">{bot.label}</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${botStatus[bot.type as keyof typeof botStatus] ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <button
                        onClick={() => toggleBot(bot.type)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${botStatus[bot.type as keyof typeof botStatus] ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                      >
                        {botStatus[bot.type as keyof typeof botStatus] ? 'Stop' : 'Start'}
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">{bot.desc}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">PnL:</span>
                      <span className={`ml-2 ${pnlData[bot.type as keyof typeof pnlData] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pnlData[bot.type as keyof typeof pnlData] >= 0 ? '+' : ''}
                        ${pnlData[bot.type as keyof typeof pnlData]?.toFixed(4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className={`ml-2 ${botStatus[bot.type as keyof typeof botStatus] ? 'text-green-400' : 'text-red-400'}`}>
                        {botStatus[bot.type as keyof typeof botStatus] ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tokens' && (
          <div className=
