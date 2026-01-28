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
import { Droplets, Wallet, Clock, Activity, CheckCircle, LogOut, Coins, ExternalLink, Loader2 } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />
      
      <div className="relative z-10 container mx-auto px-4 py-8 md:py-16 max-w-5xl">
        {/* Success Toast */}
        {showSuccess && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right">
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="flex items-center gap-3 p-4">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-green-400 font-medium">{successMessage}</span>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Header */}
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
              <Droplets className="h-10 w-10 md:h-12 md:w-12 text-primary" />
            </div>
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
              STX Faucet
            </h1>
          </div>
          <p className="text-muted-foreground text-sm md:text-base">
            Get free testnet STX tokens for development
          </p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Dispensed</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-green-400">
                {stats.totalDispensed.toLocaleString()} STX
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Claims</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-purple-400">
                {stats.totalClaims.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-4 w-4 text-cyan-500" />
                <span className="text-xs text-muted-foreground">Balance</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-cyan-400">
                {stats.contractBalance.toLocaleString()} STX
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Per Claim</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-amber-400">
                {stats.faucetAmount} STX
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Card */}
        <Card className="bg-slate-900/70 border-slate-800 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-primary" />
              Claim Tokens
            </CardTitle>
            <CardDescription>
              {stats.isActive ? 'Faucet is online and ready' : 'Faucet is currently offline'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!userData ? (
              <div className="text-center py-8">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Wallet className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Connect a Stacks wallet to claim testnet tokens
                </p>
                <Button onClick={handleConnect} size="lg" className="w-full md:w-auto">
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet
                </Button>
              </div>
            ) : (
              <>
                {/* Connected Wallet */}
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-mono text-muted-foreground">
                      {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-1" />
                    Logout
                  </Button>
                </div>

                {/* Cooldown Timer */}
                {timeRemaining > 0 && (
                  <div className="text-center p-6 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                    <Clock className="h-8 w-8 text-purple-500 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-2">Cooldown Active</p>
                    <p className="text-3xl font-bold font-mono text-purple-400">
                      {formatTime(timeRemaining)}
                    </p>
                  </div>
                )}

                {/* Claim Button */}
                <Button 
                  onClick={handleClaim} 
                  disabled={!canClaim || claiming}
                  size="lg"
                  className="w-full h-14 text-lg"
                >
                  {claiming ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Droplets className="mr-2 h-5 w-5" />
                      Claim {stats.faucetAmount} STX
                    </>
                  )}
                </Button>

                {/* Fund Section */}
                <div className="pt-6 border-t border-slate-800">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    Fund the Faucet
                  </h4>
                  <div className="flex gap-3">
                    <Input
                      type="number"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      placeholder="Amount in STX"
                      className="bg-slate-800/50"
                    />
                    <Button 
                      onClick={handleFund} 
                      disabled={funding}
                      variant="secondary"
                    >
                      {funding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fund'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Claim History */}
        {claimHistory.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg">Recent Claims</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {claimHistory.map((claim, idx) => (
                  <a
                    key={idx}
                    href={`https://explorer.hiro.so/txid/${claim.txId}?chain=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors group"
                  >
                    <span className="text-sm font-mono text-muted-foreground">
                      {claim.address}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-green-400 font-semibold">
                        +{claim.amount} STX
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(claim.timestamp).toLocaleTimeString()}
                      </span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-muted-foreground text-sm">
          <p>Powered by Stacks Blockchain • Testnet</p>
        </footer>
      </div>
    </div>
  );
}
