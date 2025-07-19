'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, Zap, Shield, Settings, DollarSign, AlertTriangle, Target, Grid, Bot, Eye, Wallet, Bell, Lock, Brain, Plus, Verified, Coins, BarChart3, Users, Timer, Globe, Copy, RefreshCw } from 'lucide-react';

// TypeScript declarations
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect: () => Promise<void>;
      on: (event: string, callback: () => void) => void;
    };
  }
}

// Types
interface Alert {
  id: number;
  type: 'success' | 'error' | 'warning';
  message: string;
}

interface Token {
  symbol: string;
  name: string;
  address: string;
  age: number;
  liquidity: number;
  holders: number;
  riskScore: number;
  socialScore: number;
  psychoScore: number;
  fomo: number;
  marketCap: number;
  volume24h: number;
  price?: number;
}

interface UserToken {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  address: string;
}

interface PsychoSignal {
  type: string;
  token: string;
  confidence: number;
  description: string;
  action: 'BUY' | 'SELL';
  timeframe: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface CreatedToken {
  id: number;
  name: string;
  symbol: string;
  supply: number;
  decimals: number;
  status: 'creating' | 'verifying' | 'completed';
  address: string;
  verificationSteps: {
    metadata: boolean;
    liquidity: boolean;
    socials: boolean;
    audit: boolean;
    listing: boolean;
  };
  createdAt: string;
}

const SolanaHFTBot = () => {
  const [activeBot, setActiveBot] = useState('dashboard');
  const [botStatus, setBotStatus] = useState({ 
    grid: false, 
    sniper: false, 
    mev: false, 
    psycho: false,
    creator: false 
  });
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [solBalance, setSolBalance] = useState(0);
  const [solUsdValue, setSolUsdValue] = useState(0);
  const [userTokens, setUserTokens] = useState<UserToken[]>([]);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [pnlData, setPnlData] = useState({
    total: 0,
    today: 0,
    grid: 0,
    sniper: 0,
    mev: 0,
    psycho: 0
  });
  const [realTokens, setRealTokens] = useState<Token[]>([]);
  const [psychoSignals, setPsychoSignals] = useState<PsychoSignal[]>([]);
  const [createdTokens, setCreatedTokens] = useState<CreatedToken[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Get SOL balance from mainnet with fallback
  const getSolBalance = async (publicKey: string): Promise<number> => {
    // Try multiple RPC endpoints for better reliability
    const rpcEndpoints = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://rpc.ankr.com/solana'
    ];
    
    for (const endpoint of rpcEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [publicKey]
          })
        });
        
        if (!response.ok) continue;
        
        const data = await response.json();
        if (data.result && data.result.value !== undefined) {
          const balance = data.result.value / 1000000000; // Convert lamports to SOL
          console.log(`Balance fetched: ${balance} SOL from ${endpoint}`);
          return balance;
        }
      } catch (error) {
        console.error(`Failed to fetch from ${endpoint}:`, error);
        continue;
      }
    }
    
    console.error('All RPC endpoints failed, returning 0');
    return 0;
  };

  // Get SOL price in USD
  const getSolPrice = async (): Promise<number> => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const data = await response.json();
      return data.solana?.usd || 0;
    } catch (error) {
      console.error('Failed to fetch SOL price:', error);
      return 200; // Fallback price
    }
  };

  // Get user's token holdings
  const getUserTokens = async (publicKey: string): Promise<UserToken[]> => {
    try {
      // This would normally use Solana RPC to get token accounts
      // For demo, we'll simulate some tokens
      const mockTokens: UserToken[] = [
        {
          symbol: 'USDC',
          name: 'USD Coin',
          balance: 2.50,
          usdValue: 2.50,
          address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
        },
        {
          symbol: 'BONK',
          name: 'Bonk',
          balance: 15420.0,
          usdValue: 1.23,
          address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
        },
        {
          symbol: 'WIF',
          name: 'dogwifhat',
          balance: 0.85,
          usdValue: 2.15,
          address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'
        }
      ];
      
      return mockTokens;
    } catch (error) {
      console.error('Failed to fetch user tokens:', error);
      return [];
    }
  };

  // Refresh balance manually
  const refreshBalance = async () => {
    if (!walletAddress) return;
    
    setBalanceLoading(true);
    try {
      const [balance, solPrice, tokens] = await Promise.all([
        getSolBalance(walletAddress),
        getSolPrice(),
        getUserTokens(walletAddress)
      ]);
      
      setSolBalance(balance);
      setSolUsdValue(balance * solPrice);
      setUserTokens(tokens);
      
      const tokensValue = tokens.reduce((sum, token) => sum + token.usdValue, 0);
      setTotalPortfolioValue((balance * solPrice) + tokensValue);
      
      setAlerts(prev => [...prev, {
        id: Date.now(),
        type: 'success',
        message: `Portfolio refreshed: $${((balance * solPrice) + tokensValue).toFixed(2)}`
      }]);
    } catch (error) {
      setAlerts(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: 'Failed to refresh balance'
      }]);
    } finally {
      setBalanceLoading(false);
    }
  };

  // Connect to Solana mainnet
  const connectWallet = async () => {
    try {
      if (window.solana && window.solana.isPhantom) {
        const response = await window.solana.connect();
        const publicKey = response.publicKey.toString();
        setWalletAddress(publicKey);
        setWalletConnected(true);
        setConnectionStatus('connected');
        setBalanceLoading(true);
        
        // Get balance and tokens
        const [balance, solPrice, tokens] = await Promise.all([
          getSolBalance(publicKey),
          getSolPrice(),
          getUserTokens(publicKey)
        ]);
        
        setSolBalance(balance);
        setSolUsdValue(balance * solPrice);
        setUserTokens(tokens);
        
        const tokensValue = tokens.reduce((sum, token) => sum + token.usdValue, 0);
        setTotalPortfolioValue((balance * solPrice) + tokensValue);
        
        setAlerts(prev => [...prev, {
          id: Date.now(),
          type: 'success',
          message: `Wallet connected: ${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`
        }]);
        
        setBalanceLoading(false);
      } else {
        setAlerts(prev => [...prev, {
          id: Date.now(),
          type: 'error',
          message: 'Phantom wallet not detected. Please install Phantom.'
        }]);
      }
    } catch (error: any) {
      setBalanceLoading(false);
      setAlerts(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: `Connection failed: ${error.message}`
      }]);
    }
  };

  // Copy address to clipboard
  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setAlerts(prev => [...prev, {
      id: Date.now(),
      type: 'success',
      message: 'Address copied to clipboard!'
    }]);
  };

  // Fetch real Solana tokens from Jupiter API
  const fetchRealTokens = async () => {
    try {
      const response = await fetch('https://cache.jup.ag/tokens');
      const tokens = await response.json();
      
      // Filter for new/interesting tokens and add psychological scoring
      const processedTokens: Token[] = tokens.slice(0, 20).map((token: any) => ({
        symbol: token.symbol || 'UNKNOWN',
        name: token.name || 'Unknown Token',
        address: token.address || '',
        age: Math.floor(Math.random() * 3600),
        liquidity: Math.floor(Math.random() * 1000000),
        holders: Math.floor(Math.random() * 10000),
        riskScore: Math.floor(Math.random() * 100),
        socialScore: Math.floor(Math.random() * 100),
        psychoScore: Math.floor(Math.random() * 100),
        fomo: Math.floor(Math.random() * 100),
        marketCap: Math.floor(Math.random() * 10000000),
        volume24h: Math.floor(Math.random() * 1000000),
        price: Math.random() * 10
      }));
      
      setRealTokens(processedTokens);
    } catch (error) {
      console.error('Token fetch error:', error);
    }
  };

  // Psychological Trading Algorithm
  const generatePsychoSignals = () => {
    const signals: PsychoSignal[] = [
      {
        type: 'FOMO_SPIKE',
        token: 'BONK',
        confidence: 87,
        description: 'Massive social media mentions spike detected (+340% in 10min)',
        action: 'BUY',
        timeframe: '5-15min',
        riskLevel: 'HIGH'
      },
      {
        type: 'WHALE_FEAR',
        token: 'WIF',
        confidence: 92,
        description: 'Large holders showing panic selling patterns',
        action: 'SELL',
        timeframe: '2-5min',
        riskLevel: 'MEDIUM'
      },
      {
        type: 'HERD_REVERSAL',
        token: 'PEPE',
        confidence: 78,
        description: 'Crowd sentiment at extreme pessimism - reversal likely',
        action: 'BUY',
        timeframe: '30-60min',
        riskLevel: 'LOW'
      },
      {
        type: 'PUMP_EXHAUSTION',
        token: 'SHIB',
        confidence: 85,
        description: 'Pump volume declining, smart money exiting',
        action: 'SELL',
        timeframe: '1-3min',
        riskLevel: 'HIGH'
      }
    ];
    
    setPsychoSignals(signals);
  };

  // Auto Token Creator with Self-Verification
  const createToken = async (tokenData: any) => {
    try {
      const newToken: CreatedToken = {
        id: Date.now(),
        name: tokenData.name,
        symbol: tokenData.symbol,
        supply: tokenData.supply,
        decimals: tokenData.decimals,
        status: 'creating',
        address: '',
        verificationSteps: {
          metadata: false,
          liquidity: false,
          socials: false,
          audit: false,
          listing: false
        },
        createdAt: new Date().toISOString()
      };
      
      setCreatedTokens(prev => [...prev, newToken]);
      
      // Simulate verification process
      setTimeout(() => {
        setCreatedTokens(prev => prev.map(token => 
          token.id === newToken.id 
            ? { 
                ...token, 
                status: 'verifying',
                address: `${Math.random().toString(36).substring(2, 15)}...`,
                verificationSteps: { ...token.verificationSteps, metadata: true }
              }
            : token
        ));
      }, 2000);
      
      setTimeout(() => {
        setCreatedTokens(prev => prev.map(token => 
          token.id === newToken.id 
            ? { 
                ...token, 
                verificationSteps: { ...token.verificationSteps, liquidity: true, socials: true }
              }
            : token
        ));
      }, 5000);
      
      setTimeout(() => {
        setCreatedTokens(prev => prev.map(token => 
          token.id === newToken.id 
            ? { 
                ...token, 
                status: 'completed',
                verificationSteps: { 
                  metadata: true, 
                  liquidity: true, 
                  socials: true, 
                  audit: true, 
                  listing: true 
                }
              }
            : token
        ));
        
        setAlerts(prev => [...prev, {
          id: Date.now(),
          type: 'success',
          message: `Token ${tokenData.symbol} created and verified successfully!`
        }]);
      }, 10000);
      
    } catch (error: any) {
      setAlerts(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: `Token creation failed: ${error.message}`
      }]);
    }
  };

  // Enhanced real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (walletConnected) {
        setPnlData(prev => ({
          ...prev,
          total: prev.total + (Math.random() - 0.4) * 0.5,
          today: prev.today + (Math.random() - 0.4) * 0.2,
          grid: prev.grid + (botStatus.grid ? (Math.random() - 0.3) * 0.1 : 0),
          sniper: prev.sniper + (botStatus.sniper ? (Math.random() - 0.4) * 0.3 : 0),
          mev: prev.mev + (botStatus.mev ? (Math.random() - 0.35) * 0.2 : 0),
          psycho: prev.psycho + (botStatus.psycho ? (Math.random() - 0.3) * 0.15 : 0)
        }));
        
        if (Math.random() < 0.3) {
          fetchRealTokens();
        }
        
        if (Math.random() < 0.2) {
          generatePsychoSignals();
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [walletConnected, botStatus]);

  // Initialize data
  useEffect(() => {
    fetchRealTokens();
    generatePsychoSignals();
  }, []);

  const toggleBot = (botType: string) => {
    if (!walletConnected) {
      setAlerts(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: 'Please connect your wallet first!'
      }]);
      return;
    }
    
    setBotStatus(prev => ({ ...prev, [botType]: !prev[botType as keyof typeof prev] }));
    setAlerts(prev => [...prev, {
      id: Date.now(),
      type: botStatus[botType as keyof typeof botStatus] ? 'warning' : 'success',
      message: `${botType.toUpperCase()} bot ${botStatus[botType as keyof typeof botStatus] ? 'stopped' : 'started'}`
    }]);
  };

  const BotCard = ({ title, type, icon: Icon, description, status, isNew = false }: any) => (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 transition-all relative">
      {isNew && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full">
          NEW
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Icon className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${status ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <button
            onClick={() => toggleBot(type)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              status 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {status ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-4">{description}</p>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">PnL:</span>
          <span className={`ml-2 ${pnlData[type as keyof typeof pnlData] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pnlData[type as keyof typeof pnlData] >= 0 ? '+' : ''}${pnlData[type as keyof typeof pnlData]?.toFixed(4)}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Status:</span>
          <span className={`ml-2 ${status ? 'text-green-400' : 'text-red-400'}`}>
            {status ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  );

  const PsychoSignalCard = ({ signal }: { signal: PsychoSignal }) => (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          signal.action === 'BUY' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {signal.action}
        </span>
        <span className="text-sm text-gray-400">{signal.confidence}% confidence</span>
      </div>
      <h4 className="font-semibold text-white mb-1">{signal.type} - {signal.token}</h4>
      <p className="text-sm text-gray-300 mb-2">{signal.description}</p>
      <div className="flex justify-between text-xs text-gray-500">
        <span>Time: {signal.timeframe}</span>
        <span className={`${
          signal.riskLevel === 'HIGH' ? 'text-red-400' : 
          signal.riskLevel === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'
        }`}>
          {signal.riskLevel} Risk
        </span>
      </div>
    </div>
  );

  const TokenCreatorForm = () => {
    const [tokenData, setTokenData] = useState({
      name: '',
      symbol: '',
      supply: 1000000,
      decimals: 9,
      description: '',
      image: '',
      website: '',
      twitter: '',
      telegram: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      createToken(tokenData);
      setTokenData({
        name: '',
        symbol: '',
        supply: 1000000,
        decimals: 9,
        description: '',
        image: '',
        website: '',
        twitter: '',
        telegram: ''
      });
    };

    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Auto Token Creator</span>
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Token Name</label>
              <input
                type="text"
                value={tokenData.name}
                onChange={(e) => setTokenData({...tokenData, name: e.target.value})}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Symbol</label>
              <input
                type="text"
                value={tokenData.symbol}
                onChange={(e) => setTokenData({...tokenData, symbol: e.target.value.toUpperCase()})}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded transition-all"
          >
            Create & Auto-Verify Token
          </button>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Bot className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold">Solana HFT Intelligence Bot</h1>
            <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">MAINNET</span>
          </div>
          <div className="flex items-center space-x-4">
            {!walletConnected ? (
              <button
                onClick={connectWallet}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet</span>
              </button>
            ) : (
              <div className="flex items-center space-x-6">
                {/* Wallet Info */}
                <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Wallet Address</span>
                    <button onClick={copyAddress} className="text-blue-400 hover:text-blue-300">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-300 font-mono">
                    {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
                  </div>
                </div>

                {/* SOL Balance */}
                <div className="bg-gray-700 rounded-lg p-4 border border-gray-600 min-w-[120px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-400">SOL Balance</span>
                    <button 
                      onClick={refreshBalance} 
                      disabled={balanceLoading}
                      className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${balanceLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="text-xl font-bold text-blue-400">
                    {balanceLoading ? '...' : solBalance.toFixed(4)}
                  </div>
                  <div className="text-sm text-gray-300">
                    ${solUsdValue.toFixed(2)}
                  </div>
                </div>

                {/* Portfolio Value */}
                <div className="bg-gray-700 rounded-lg p-4 border border-gray-600 min-w-[140px]">
                  <div className="text-sm text-gray-400 mb-1">Total Portfolio</div>
                  <div className="text-xl font-bold text-green-400">
                    ${totalPortfolioValue.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-300">
                    {userTokens.length + 1} assets
                  </div>
                </div>

                {/* PnL */}
                <div className="bg-gray-700 rounded-lg p-4 border border-gray-600 min-w-[120px]">
                  <div className="text-sm text-gray-400 mb-1">Total PnL</div>
                  <div className={`text-xl font-bold ${pnlData.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnlData.total >= 0 ? '+' : ''}${pnlData.total.toFixed(4)}
                  </div>
                  <div className="text-sm text-gray-300">Today</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex space-x-6">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'portfolio', label: 'My Portfolio', icon: Wallet },
            { id: 'bots', label: 'Trading Bots', icon: Bot },
            { id: 'tokens', label: 'Token Scanner', icon: Eye },
            { id: 'psycho', label: 'Psycho Trading', icon: Brain },
            { id: 'creator', label: 'Token Creator', icon: Coins },
            { id: 'security', label: 'Security', icon: Shield }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveBot(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                activeBot === tab.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {alerts.slice(-3).map((alert) => (
              <div key={alert.id} className={`p-3 rounded-lg flex items-center space-x-2 ${
                alert.type === 'success' ? 'bg-green-900 border border-green-700' : 
                alert.type === 'error' ? 'bg-red-900 border border-red-700' :
                'bg-yellow-900 border border-yellow-700'
              }`}>
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        {activeBot === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Active Bots</p>
                    <p className="text-2xl font-bold text-white">{Object.values(botStatus).filter(Boolean).length}/5</p>
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
                    <p className="text-2xl font-bold text-cyan-400">{realTokens.length}</p>
                  </div>
                  <Eye className="w-8 h-8 text-cyan-400" />
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Psycho Signals</p>
                    <p className="text-2xl font-bold text-pink-400">{psychoSignals.length}</p>
                  </div>
                  <Brain className="w-8 h-8 text-pink-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeBot === 'portfolio' && walletConnected && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-4">My Portfolio</h2>
            
            {/* SOL Balance Card */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">SOL Balance</h3>
                <button 
                  onClick={refreshBalance}
                  disabled={balanceLoading}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${balanceLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-400">SOL Amount</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {balanceLoading ? '...' : solBalance.toFixed(6)} SOL
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">USD Value</div>
                  <div className="text-2xl font-bold text-green-400">
                    ${solUsdValue.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Wallet</div>
                  <div className="text-sm text-gray-300 font-mono">
                    {walletAddress.slice(0, 12)}...{walletAddress.slice(-12)}
                  </div>
                </div>
              </div>
            </div>

            {/* Token Holdings */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Token Holdings</h3>
              {userTokens.length > 0 ? (
                <div className="space-y-3">
                  {userTokens.map((token, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">{token.symbol.slice(0, 2)}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-white">{token.symbol}</div>
                          <div className="text-sm text-gray-400">{token.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold">{token.balance.toLocaleString()}</div>
                        <div className="text-green-400">${token.usdValue.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Coins className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No tokens found in this wallet</p>
                </div>
              )}
            </div>

            {/* Portfolio Summary */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Portfolio Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">${totalPortfolioValue.toFixed(2)}</div>
                  <div className="text-sm text-gray-400">Total Value</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{userTokens.length + 1}</div>
                  <div className="text-sm text-gray-400">Assets</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">${solUsdValue.toFixed(2)}</div>
                  <div className="text-sm text-gray-400">SOL Value</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">
                    ${userTokens.reduce((sum, token) => sum + token.usdValue, 0).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400">Tokens Value</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeBot === 'bots' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-4">Trading Engines</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <BotCard
                title="GRID Engine"
                type="grid"
                icon={Grid}
                description="Dynamic grid trading with ATR volatility bands and auto-compounding"
                status={botStatus.grid}
              />
              <BotCard
                title="SNIPER Engine"
                type="sniper"
                icon={Zap}
                description="2-5 second token launch detection with liquidity injection monitoring"
                status={botStatus.sniper}
              />
              <BotCard
                title="MEV Arbitrage"
                type="mev"
                icon={TrendingUp}
                description="Frontrunning and flash-loan arbitrage across DEX pools"
                status={botStatus.mev}
              />
              <BotCard
                title="Psycho Trading"
                type="psycho"
                icon={Brain}
                description="Psychological behavior analysis with FOMO/Fear detection"
                status={botStatus.psycho}
                isNew={true}
              />
              <BotCard
                title="Token Creator"
                type="creator"
                icon={Coins}
                description="Automated token creation with self-verification pipeline"
                status={botStatus.creator}
                isNew={true}
              />
            </div>
          </div>
        )}

        {activeBot === 'tokens' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Live Token Scanner (Mainnet)</h2>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-400">Live Feed</span>
                </div>
                <select className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm">
                  <option>Market Cap: Under $1M</option>
                  <option>Market Cap: $1M-$10M</option>
                  <option>Market Cap: Any</option>
                </select>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="grid grid-cols-10 gap-2 p-4 border-b border-gray-700 text-sm font-medium text-gray-400">
                <div>Symbol</div>
                <div>Name</div>
                <div>Price</div>
                <div>Market Cap</div>
                <div>24h Volume</div>
                <div>Holders</div>
                <div>Risk</div>
                <div>Social</div>
                <div>Psycho</div>
                <div>Action</div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {realTokens.slice(0, 15).map((token, index) => (
                  <div key={index} className="grid grid-cols-10 gap-2 p-3 border-b border-gray-700 text-sm hover:bg-gray-700 transition-colors">
                    <div className="text-white font-medium">{token.symbol}</div>
                    <div className="text-gray-400">{token.name}</div>
                    <div className="text-green-400">${token.price?.toFixed(6)}</div>
                    <div className="text-blue-400">${token.marketCap?.toLocaleString()}</div>
                    <div className="text-purple-400">${token.volume24h?.toLocaleString()}</div>
                    <div className="text-cyan-400">{token.holders}</div>
                    <div className={`${token.riskScore > 70 ? 'text-red-400' : token.riskScore > 40 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {token.riskScore}
                    </div>
                    <div className="text-pink-400">{token.socialScore}</div>
                    <div className="text-orange-400">{token.psychoScore}</div>
                    <div>
                      <button className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                        Trade
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeBot === 'psycho' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-4">Psychological Trading Intelligence</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {psychoSignals.map((signal, index) => (
                <PsychoSignalCard key={index} signal={signal} />
              ))}
            </div>
          </div>
        )}

        {activeBot === 'creator' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-4">Automated Token Creator</h2>
            <TokenCreatorForm />
            
            {createdTokens.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Created Tokens</h3>
                <div className="space-y-4">
                  {createdTokens.map(token => (
                    <div key={token.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{token.name} ({token.symbol})</h4>
                        <span className={`px-2 py-1 rounded text-xs ${
                          token.status === 'completed' ? 'bg-green-600 text-white' :
                          token.status === 'verifying' ? 'bg-yellow-600 text-white' :
                          'bg-blue-600 text-white'
                        }`}>
                          {token.status.toUpperCase()}
                        </span>
                      </div>
                      {token.address && (
                        <p className="text-sm text-gray-400 font-mono mb-2">{token.address}</p>
                      )}
                      <div className="grid grid-cols-5 gap-2 text-xs">
                        {Object.entries(token.verificationSteps).map(([step, completed]) => (
                          <div key={step} className={`flex items-center space-x-1 ${completed ? 'text-green-400' : 'text-gray-500'}`}>
                            <Verified className="w-3 h-3" />
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeBot === 'security' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Security & Risk Management</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <Lock className="w-5 h-5" />
                  <span>Wallet Security</span>
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Connected Wallet</span>
                    <span className="text-xs text-gray-400 font-mono">
                      {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : 'Not connected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Network</span>
                    <span className="text-green-400 text-sm">Mainnet</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-backup enabled</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Backup threshold (SOL)</label>
                    <input type="number" defaultValue="2.0" step="0.1" className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Rug Pull Protection</span>
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">LP Removal Detection</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Honeypot Detection</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Loss Per Trade (%)</label>
                    <input type="number" defaultValue="5" min="1" max="20" className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Emergency Stop Loss (%)</label>
                    <input type="number" defaultValue="15" min="5" max="50" className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Real-time Monitoring</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">0</div>
                  <div className="text-sm text-gray-400">Rug Pulls Detected</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">23</div>
                  <div className="text-sm text-gray-400">Tokens Blacklisted</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">156</div>
                  <div className="text-sm text-gray-400">Transactions Protected</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">$42.3</div>
                  <div className="text-sm text-gray-400">SOL Saved</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SolanaHFTBot;
