'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, Zap, Shield, Settings, DollarSign, AlertTriangle, Target, Grid, Bot, Eye, Wallet, Bell, Lock, Brain, Plus, Verified, Coins, BarChart3, Users, Timer, Globe } from 'lucide-react';

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
  const [pnlData, setPnlData] = useState({
    total: 0,
    today: 0,
    grid: 0,
    sniper: 0,
    mev: 0,
    psycho: 0
  });
  const [realTokens, setRealTokens] = useState([]);
  const [psychoSignals, setPsychoSignals] = useState([]);
  const [createdTokens, setCreatedTokens] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Mainnet RPC endpoint
  const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
  
  // Connect to Solana mainnet
  const connectWallet = async () => {
    try {
      if (window.solana && window.solana.isPhantom) {
        const response = await window.solana.connect();
        const publicKey = response.publicKey.toString();
        setWalletAddress(publicKey);
        setWalletConnected(true);
        setConnectionStatus('connected');
        
        // Get SOL balance
        const balance = await getSolBalance(publicKey);
        setSolBalance(balance);
        
        setAlerts(prev => [...prev, {
          id: Date.now(),
          type: 'success',
          message: `Wallet connected: ${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`
        }]);
      } else {
        setAlerts(prev => [...prev, {
          id: Date.now(),
          type: 'error',
          message: 'Phantom wallet not detected. Please install Phantom.'
        }]);
      }
    } catch (error) {
      setAlerts(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: `Connection failed: ${error.message}`
      }]);
    }
  };

  // Get SOL balance from mainnet
  const getSolBalance = async (publicKey) => {
    try {
      const response = await fetch(MAINNET_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [publicKey]
        })
      });
      const data = await response.json();
      return data.result.value / 1000000000; // Convert lamports to SOL
    } catch (error) {
      console.error('Balance fetch error:', error);
      return 0;
    }
  };

  // Fetch real Solana tokens from Jupiter API
  const fetchRealTokens = async () => {
    try {
      const response = await fetch('https://cache.jup.ag/tokens');
      const tokens = await response.json();
      
      // Filter for new/interesting tokens and add psychological scoring
      const processedTokens = tokens.slice(0, 20).map(token => ({
        ...token,
        age: Math.floor(Math.random() * 3600), // Simulated age in seconds
        liquidity: Math.floor(Math.random() * 1000000),
        holders: Math.floor(Math.random() * 10000),
        riskScore: Math.floor(Math.random() * 100),
        socialScore: Math.floor(Math.random() * 100),
        psychoScore: Math.floor(Math.random() * 100),
        fomo: Math.floor(Math.random() * 100),
        marketCap: Math.floor(Math.random() * 10000000),
        volume24h: Math.floor(Math.random() * 1000000)
      }));
      
      setRealTokens(processedTokens);
    } catch (error) {
      console.error('Token fetch error:', error);
    }
  };

  // Initialize data
  useEffect(() => {
    fetchRealTokens();
  }, []);

  const toggleBot = (botType) => {
    if (!walletConnected) {
      setAlerts(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: 'Please connect your wallet first!'
      }]);
      return;
    }
    
    setBotStatus(prev => ({ ...prev, [botType]: !prev[botType] }));
    setAlerts(prev => [...prev, {
      id: Date.now(),
      type: botStatus[botType] ? 'warning' : 'success',
      message: `${botType.toUpperCase()} bot ${botStatus[botType] ? 'stopped' : 'started'}`
    }]);
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
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm text-gray-400">SOL Balance</div>
                  <div className="text-lg font-bold text-blue-400">{solBalance.toFixed(4)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Total PnL</div>
                  <div className={`text-2xl font-bold ${pnlData.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnlData.total >= 0 ? '+' : ''}${pnlData.total.toFixed(4)}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Welcome to Solana HFT Bot</h3>
            <p className="text-gray-400">Connect your wallet to start trading on Solana mainnet.</p>
            <div className="mt-4">
              <div className="text-sm text-gray-500">Tokens Tracked: {realTokens.length}</div>
              <div className="text-sm text-gray-500">Network: Mainnet</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolanaHFTBot;
