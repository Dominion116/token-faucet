import { useState, useEffect, useCallback } from 'react';
import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { StacksTestnet } from '@stacks/network';
import { 
  callReadOnlyFunction, 
  cvToValue, 
  standardPrincipalCV,
  uintCV,
  makeStandardSTXPostCondition,
  makeContractSTXPostCondition,
  FungibleConditionCode,
  PostConditionMode
} from '@stacks/transactions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Wallet, Clock, ArrowRight, Zap, TrendingUp, Users, ExternalLink, Loader2, Copy, Check } from 'lucide-react';
import Navbar from '@/components/Navbar';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });
const network = new StacksTestnet();
const CONTRACT_ADDRESS = 'ST30VGN68PSGVWGNMD0HH2WQMM5T486EK3WBNTHCY';
const CONTRACT_NAME = 'token-faucet';

export default function App() {
  const [userData, setUserData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [funding, setFunding] = useState(false);
  const [fundAmount, setFundAmount] = useState('100');
  const [claimHistory, setClaimHistory] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [stats, setStats] = useState({
    totalDispensed: 0,
    totalClaims: 0,
    faucetAmount: 10,
    contractBalance: 0,
    isActive: true
  });

  const fetchStats = useCallback(async () => {
    try {
      const result = await callReadOnlyFunction({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-faucet-stats',
        functionArgs: [],
        senderAddress: CONTRACT_ADDRESS,
      });
      
      // cvToValue returns nested structure: { value: { 'total-dispensed': { value: bigint }, ... } }
      const parsed = cvToValue(result, true);
      console.log('Faucet stats raw:', JSON.stringify(parsed, (k, v) => typeof v === 'bigint' ? v.toString() : v));
      
      // The response is (ok { ... }) so parsed.value contains the tuple
      const data = parsed.value || parsed;
      
      // Helper to safely extract numeric value from nested CV structure
      const getNum = (field) => {
        const val = data[field];
        if (val === null || val === undefined) return 0;
        // If it's a nested object with .value, extract it
        const raw = typeof val === 'object' && val.value !== undefined ? val.value : val;
        return Number(raw);
      };
      
      const getBool = (field) => {
        const val = data[field];
        if (val === null || val === undefined) return false;
        return typeof val === 'object' && val.value !== undefined ? Boolean(val.value) : Boolean(val);
      };
      
      setStats({
        totalDispensed: getNum('total-dispensed') / 1000000,
        totalClaims: getNum('total-claims'),
        faucetAmount: getNum('faucet-amount') / 1000000 || 10,
        contractBalance: getNum('contract-balance') / 1000000,
        isActive: getBool('is-active')
      });
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  }, []);

  const updateCooldown = useCallback(async (address) => {
    try {
      const result = await callReadOnlyFunction({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-time-until-next-claim',
        functionArgs: [standardPrincipalCV(address)],
        senderAddress: address,
      });
      const parsed = cvToValue(result, true);
      console.log('Cooldown raw:', JSON.stringify(parsed, (k, v) => typeof v === 'bigint' ? v.toString() : v));
      // Response is (ok uint) - parsed.value contains the uint value
      const val = parsed.value;
      const seconds = typeof val === 'object' && val.value !== undefined ? Number(val.value) : Number(val || 0);
      setTimeRemaining(seconds * 1000);
    } catch (e) {
      console.error("Error fetching cooldown:", e);
    }
  }, []);

  const fetchRecentClaims = useCallback(async () => {
    try {
      const response = await fetch(
        `https://api.testnet.hiro.so/extended/v1/contract/${CONTRACT_ADDRESS}.${CONTRACT_NAME}/transactions?function_name=claim&limit=5`
      );
      const data = await response.json();
      
      const successfulClaims = data.results
        .filter(tx => tx.tx_status === 'success')
        .map(tx => ({
          amount: stats.faucetAmount, // Default to faucet amount as event parsing is complex
          timestamp: tx.burn_block_time * 1000 || Date.now(), // Fallback if pending
          address: `${tx.sender_address.slice(0, 6)}...${tx.sender_address.slice(-4)}`,
          txId: tx.tx_id
        }));
        
      if (successfulClaims.length > 0) {
        setClaimHistory(successfulClaims);
      }
    } catch (e) {
      console.error("Error fetching recent claims:", e);
    }
  }, [stats.faucetAmount]);

  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      setUserData(userSession.loadUserData());
    }
    fetchStats();
    fetchRecentClaims();

    const interval = setInterval(() => {
      if (userSession.isUserSignedIn()) {
        const address = userSession.loadUserData().profile.stxAddress.testnet;
        updateCooldown(address);
      }
      fetchStats();
      fetchRecentClaims();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchStats, updateCooldown, fetchRecentClaims]);

  useEffect(() => {
    if (userData) {
      updateCooldown(userData.profile.stxAddress.testnet);
    }
  }, [userData, updateCooldown]);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  const handleConnect = () => {
    showConnect({
      appDetails: {
        name: 'STX Faucet',
        icon: window.location.origin + '/logo.png',
      },
      onFinish: () => {
        const data = userSession.loadUserData();
        setUserData(data);
        updateCooldown(data.profile.stxAddress.testnet);
      },
      userSession,
    });
  };

  const handleLogout = () => {
    userSession.signUserOut();
    setUserData(null);
    setTimeRemaining(0);
  };

  const formatTime = (ms) => {
    if (ms <= 0) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleClaim = async () => {
    if (!userData || timeRemaining > 0 || claiming) return;
    setClaiming(true);
    
    const address = userData.profile.stxAddress.testnet;
    const claimAmountMicro = Math.floor(stats.faucetAmount * 1000000);
    
    try {
      const { openContractCall } = await import('@stacks/connect');
      
      // Post-condition: Contract will send exactly the faucet amount to user
      const postConditions = [
        makeContractSTXPostCondition(
          CONTRACT_ADDRESS,
          CONTRACT_NAME,
          FungibleConditionCode.Equal,
          claimAmountMicro
        )
      ];
      
      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'claim',
        functionArgs: [],
        network,
        postConditions,
        postConditionMode: PostConditionMode.Deny,
        onFinish: (data) => {
        onFinish: (data) => {
          setSuccessMessage(`Claimed ${stats.faucetAmount} STX!`);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 5000);
          fetchStats();
        },
          fetchStats();
        },
        onCancel: () => {},
      });
    } catch (e) {
      console.error("Claim error:", e);
    } finally {
      setClaiming(false);
    }
  };

  const handleFund = async () => {
    if (!userData || funding) return;
    const amount = Number(fundAmount);
    if (isNaN(amount) || amount <= 0) return;

    setFunding(true);
    const microSTX = Math.floor(amount * 1000000);
    const address = userData.profile.stxAddress.testnet;

    try {
      const { openContractCall } = await import('@stacks/connect');
      
      // Post-condition: User will send exactly the specified amount to contract
      const postConditions = [
        makeStandardSTXPostCondition(
          address,
          FungibleConditionCode.Equal,
          microSTX
        )
      ];
      
      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'fund-faucet',
        functionArgs: [uintCV(microSTX)],
        network,
        postConditions,
        postConditionMode: PostConditionMode.Deny,
        onFinish: () => {
          setSuccessMessage(`Funded ${amount} STX to the faucet!`);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 5000);
          fetchStats();
        },
        onCancel: () => {},
      });
    } catch (e) {
      console.error("Fund error:", e);
    } finally {
      setFunding(false);
    }
  };

  const walletAddress = userData?.profile?.stxAddress?.testnet || '';
  const canClaim = userData && timeRemaining === 0 && stats.isActive;
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar 
        userData={userData}
        onConnect={handleConnect}
        onLogout={handleLogout}
      />
      
      {/* Gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-fuchsia-500/15 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-20 right-1/3 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl" />
      </div>
      
      <main className="flex-1 relative z-10">
        {/* Success Toast */}
        {showSuccess && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top fade-in duration-300">
            <div className="flex items-center gap-3 px-5 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-emerald-400 font-medium text-sm">{successMessage}</span>
            </div>
          </div>
        )}

        <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-4">
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              Stacks Testnet
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="text-foreground">Get </span>
              <span className="text-gradient">Free STX</span>
            </h1>
            
            <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto">
              Claim testnet tokens instantly. No registration, no limits on how many times you can return.
            </p>
          </div>

          {/* Main Claim Card */}
          <Card className="mb-6 overflow-hidden border-0 bg-card/50 backdrop-blur-sm glow">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5" />
            <CardContent className="relative p-6 md:p-8">
              {!userData ? (
                <div className="text-center py-4 space-y-5">
                  <div className="relative mx-auto w-16 h-16">
                    <div className="absolute inset-0 bg-violet-500/20 rounded-xl blur-xl" />
                    <div className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                      <Wallet className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-2xl font-semibold text-foreground">Connect to claim</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                      Link your Stacks wallet to receive {stats.faucetAmount} STX every 10 minutes
                    </p>
                  </div>
                  
                  <Button 
                    onClick={handleConnect} 
                    size="lg" 
                    className="h-14 px-8 text-base font-medium bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 shadow-lg shadow-violet-500/25"
                  >
                    Connect Wallet
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Wallet Badge */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                        <Wallet className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Connected</p>
                        <p className="font-mono text-sm text-foreground">
                          {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={copyAddress}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Claim Amount Display */}
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-1">Available to claim</p>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-5xl md:text-6xl font-bold text-gradient">{stats.faucetAmount}</span>
                      <span className="text-xl text-muted-foreground font-medium">STX</span>
                    </div>
                  </div>

                  {/* Cooldown Timer */}
                  {timeRemaining > 0 && (
                    <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-secondary/30 border border-border">
                      <Clock className="h-5 w-5 text-violet-400" />
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Next claim in</p>
                        <p className="text-3xl font-bold font-mono text-foreground tracking-wider">
                          {formatTime(timeRemaining)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Claim Button */}
                  <Button 
                    onClick={handleClaim} 
                    disabled={!canClaim || claiming}
                    size="lg"
                    className="w-full h-14 text-base font-medium bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 shadow-lg shadow-violet-500/25 disabled:opacity-40 disabled:shadow-none"
                  >
                    {claiming ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : timeRemaining > 0 ? (
                      'Cooldown Active'
                    ) : (
                      <>
                        <Zap className="mr-2 h-5 w-5" />
                        Claim {stats.faucetAmount} STX
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="group p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-violet-500/30 transition-colors">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Dispensed</span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {stats.totalDispensed.toLocaleString()}
                <span className="text-xs font-normal text-muted-foreground ml-1">STX</span>
              </p>
            </div>
            
            <div className="group p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-violet-500/30 transition-colors">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Total Claims</span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {stats.totalClaims.toLocaleString()}
              </p>
            </div>
            
            <div className="group p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-violet-500/30 transition-colors">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Wallet className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Balance</span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {stats.contractBalance.toLocaleString()}
                <span className="text-xs font-normal text-muted-foreground ml-1">STX</span>
              </p>
            </div>
          </div>

          {/* Fund Section - Only show when connected */}
          {userData && (
            <Card className="mb-6 border-border/50 bg-card/30 backdrop-blur-sm">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-foreground">Support the Faucet</CardTitle>
                <CardDescription className="text-sm">
                  Help keep the faucet running by contributing STX
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder="Amount"
                    className="bg-secondary/50 border-border font-mono"
                  />
                  <Button 
                    onClick={handleFund} 
                    disabled={funding}
                    variant="secondary"
                    className="shrink-0"
                  >
                    {funding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fund'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Claims */}
          {claimHistory.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Recent Activity</h3>
              <div className="space-y-1.5">
                {claimHistory.map((claim, idx) => (
                  <a
                    key={idx}
                    href={`https://explorer.hiro.so/txid/${claim.txId}?chain=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg bg-card/30 backdrop-blur-sm border border-border/50 hover:border-violet-500/30 hover:bg-card/50 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-violet-500/10 flex items-center justify-center">
                        <Zap className="h-3.5 w-3.5 text-violet-400" />
                      </div>
                      <span className="text-sm font-mono text-muted-foreground">
                        {claim.address}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-foreground font-medium text-sm">
                        +{claim.amount} STX
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(claim.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-border/50 mt-auto">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between text-xs text-muted-foreground">
            <p>Built on Stacks</p>
            <a 
              href="https://explorer.hiro.so/?chain=testnet" 
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              Explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
