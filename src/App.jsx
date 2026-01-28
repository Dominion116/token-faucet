import React, { useState, useEffect } from 'react';
import { Droplets, Clock, Wallet, Zap, Activity, CheckCircle, LogOut, Coins } from 'lucide-react';
import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { StacksTestnet } from '@stacks/network';
import { 
  callReadOnlyFunction, 
  cvToValue, 
  standardPrincipalCV,
  uintCV,
  AnchorMode,
  PostConditionMode
} from '@stacks/transactions';
import { motion, AnimatePresence } from 'framer-motion';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });
const network = new StacksTestnet();
const contractAddress = 'ST30VGN68PSGVWGNMD0HH2WQMM5T486EK3WBNTHCY';
const contractName = 'token-faucet';

export default function TokenFaucet() {
  const [userData, setUserData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [funding, setFunding] = useState(false);
  const [fundAmount, setFundAmount] = useState('100');
  const [claimHistory, setClaimHistory] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [stats, setStats] = useState({
    totalDispensed: '0',
    totalClaims: '0',
    faucetAmount: '10',
    contractBalance: '0',
    isActive: true
  });

  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      setUserData(userSession.loadUserData());
    }
    fetchStats();
    
    const history = localStorage.getItem('claimHistory');
    if (history) {
      setClaimHistory(JSON.parse(history));
    }

    const interval = setInterval(() => {
      if (userSession.isUserSignedIn()) {
        const address = userSession.loadUserData().profile.stxAddress.testnet;
        updateCooldown(address);
      }
      fetchStats();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const result = await callReadOnlyFunction({
        network,
        contractAddress,
        contractName,
        functionName: 'get-faucet-stats',
        functionArgs: [],
        senderAddress: contractAddress,
      });
      const data = cvToValue(result).value;
      setStats({
        totalDispensed: (Number(data['total-dispensed']) / 1000000).toLocaleString(),
        totalClaims: data['total-claims'].toString(),
        faucetAmount: (Number(data['faucet-amount']) / 1000000).toString(),
        contractBalance: (Number(data['contract-balance']) / 1000000).toLocaleString(),
        isActive: data['is-active']
      });
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  const updateCooldown = async (address) => {
    try {
      const result = await callReadOnlyFunction({
        network,
        contractAddress,
        contractName,
        functionName: 'get-time-until-next-claim',
        functionArgs: [standardPrincipalCV(address)],
        senderAddress: address,
      });
      const seconds = Number(cvToValue(result).value);
      setTimeRemaining(seconds * 1000);
    } catch (e) {
      console.error("Error fetching cooldown:", e);
    }
  };

  const handleConnect = () => {
    showConnect({
      appDetails: {
        name: 'STX Faucet',
        icon: window.location.origin + '/logo.png',
      },
      onFinish: () => {
        setUserData(userSession.loadUserData());
        const address = userSession.loadUserData().profile.stxAddress.testnet;
        updateCooldown(address);
      },
      userSession,
    });
  };

  const handleLogout = () => {
    userSession.signUserOut();
    setUserData(null);
  };

  const formatTime = (ms) => {
    if (ms <= 0) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleClaim = async () => {
    if (!userData || timeRemaining > 0 || claiming) return;
    setClaiming(true);
    
    const address = userData.profile.stxAddress.testnet;
    
    await showConnect({
      contractAddress,
      contractName,
      functionName: 'claim',
      functionArgs: [],
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      onFinish: (data) => {
        const newClaim = {
          amount: stats.faucetAmount,
          timestamp: Date.now(),
          address: address.slice(0, 8) + '...' + address.slice(-6),
          txId: data.txId
        };
        const updatedHistory = [newClaim, ...claimHistory.slice(0, 4)];
        setClaimHistory(updatedHistory);
        localStorage.setItem('claimHistory', JSON.stringify(updatedHistory));
        setSuccessMsg(`Claiming ${stats.faucetAmount} STX...`);
        setShowSuccess(true);
        setClaiming(false);
        setTimeout(() => setShowSuccess(false), 5000);
      },
      onCancel: () => {
        setClaiming(false);
      },
      userSession,
      appDetails: {
        name: 'STX Faucet',
        icon: window.location.origin + '/logo.png',
      }
    });
  };

  const handleFund = async () => {
    if (!userData || funding) return;
    const amount = Number(fundAmount);
    if (isNaN(amount) || amount <= 0) return;

    setFunding(true);
    const microSTX = amount * 1000000;

    await showConnect({
      contractAddress,
      contractName,
      functionName: 'fund-faucet',
      functionArgs: [uintCV(microSTX)],
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      onFinish: (data) => {
        setSuccessMsg(`Funding ${amount} STX...`);
        setShowSuccess(true);
        setFunding(false);
        setTimeout(() => setShowSuccess(false), 5000);
      },
      onCancel: () => {
        setFunding(false);
      },
      userSession,
      appDetails: {
        name: 'STX Faucet',
        icon: window.location.origin + '/logo.png',
      }
    });
  };

  const walletAddress = userData ? userData.profile.stxAddress.testnet : '';
  const canClaim = userData && timeRemaining === 0 && stats.isActive;

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1034 50%, #0d1b2a 100%)',
      fontFamily: '"Orbitron", "Courier New", monospace',
      color: '#00ff9d',
      padding: '20px',
      position: 'relative',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      {/* Animated Background Grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 255, 157, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 255, 157, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        animation: 'gridPulse 20s ease-in-out infinite',
        pointerEvents: 'none'
      }} />

      <style>{`
        @keyframes gridPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes neonPulse {
          0%, 100% { 
            box-shadow: 0 0 5px #00ff9d, 0 0 10px #00ff9d, 0 0 20px #00ff9d;
          }
          50% { 
            box-shadow: 0 0 10px #00ff9d, 0 0 20px #00ff9d, 0 0 40px #00ff9d, 0 0 60px #00ff9d;
          }
        }

        @keyframes glitch {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-2px); }
          40% { transform: translateX(2px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
      `}</style>

      <div style={{
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <motion.header 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          style={{
            textAlign: 'center',
            marginBottom: '60px',
            marginTop: '40px'
          }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            >
               <img src="/logo.png" alt="Logo" style={{ width: '64px', height: '64px', filter: 'drop-shadow(0 0 10px #00ff9d)' }} />
            </motion.div>
            <h1 style={{
              fontSize: 'min(3.5rem, 10vw)',
              fontWeight: 900,
              margin: 0,
              textShadow: '0 0 20px rgba(0, 255, 157, 0.8), 0 0 40px rgba(0, 255, 157, 0.4)',
              letterSpacing: '3px',
              textTransform: 'uppercase'
            }}>
              STX FAUCET
            </h1>
          </div>
          <p style={{
            fontFamily: '"Share Tech Mono", monospace',
            fontSize: '1.1rem',
            color: '#8b5cf6',
            textShadow: '0 0 10px rgba(139, 92, 246, 0.5)',
            letterSpacing: '2px'
          }}>
            &gt; CLAIM_FREE_STX_TOKENS.sh
          </p>
        </motion.header>

        {/* Stats Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '40px'
        }}>
          {[
            { icon: Activity, label: 'TOTAL DISPENSED', value: stats.totalDispensed + ' STX', color: '#00ff9d' },
            { icon: Wallet, label: 'TOTAL CLAIMS', value: stats.totalClaims, color: '#8b5cf6' },
            { icon: CheckCircle, label: 'FAUCET BALANCE', value: stats.contractBalance + ' STX', color: '#06b6d4' }
          ].map(({ icon: Icon, label, value, color }, idx) => (
            <motion.div 
              key={idx}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -5, boxShadow: `0 5px 30px ${color}40` }}
              style={{
                background: 'rgba(10, 14, 39, 0.6)',
                border: `1px solid ${color}40`,
                borderRadius: '12px',
                padding: '20px',
                backdropFilter: 'blur(10px)',
                boxShadow: `0 0 20px ${color}20`,
                transition: 'all 0.3s ease'
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <Icon size={18} color={color} />
                <span style={{
                  fontFamily: '"Share Tech Mono", monospace',
                  fontSize: '0.7rem',
                  color: '#64748b',
                  letterSpacing: '1px'
                }}>{label}</span>
              </div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: color,
                textShadow: `0 0 10px ${color}80`
              }}>
                {value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Claim Interface */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          style={{
            background: 'rgba(10, 14, 39, 0.8)',
            border: '2px solid #00ff9d40',
            borderRadius: '20px',
            padding: '40px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 10px 60px rgba(0, 255, 157, 0.2)',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: '40px'
          }}>
          <AnimatePresence>
            {showSuccess && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0, 255, 157, 0.1)',
                  backdropFilter: 'blur(5px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                }}>
                <motion.div 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  style={{
                    background: 'rgba(10, 14, 39, 0.95)',
                    border: '2px solid #00ff9d',
                    borderRadius: '20px',
                    padding: '40px',
                    textAlign: 'center',
                    boxShadow: '0 0 60px rgba(0, 255, 157, 0.4)'
                  }}>
                  <CheckCircle size={64} color="#00ff9d" style={{
                    marginBottom: '20px',
                    filter: 'drop-shadow(0 0 20px #00ff9d)'
                  }} />
                  <h2 style={{
                    fontSize: '2rem',
                    marginBottom: '10px',
                    color: '#00ff9d',
                    textShadow: '0 0 20px rgba(0, 255, 157, 0.8)'
                  }}>SUCCESS!</h2>
                  <p style={{
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: '1.2rem',
                    color: '#8b5cf6'
                  }}>
                    {successMsg}
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {!userData ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                marginBottom: '30px',
                padding: '40px',
                background: 'rgba(0, 255, 157, 0.05)',
                border: '1px dashed #00ff9d40',
                borderRadius: '15px'
              }}>
                <Wallet size={48} color="#00ff9d" style={{ marginBottom: '20px' }} />
                <h3 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>CONNECT WALLET</h3>
                <p style={{ color: '#64748b', fontFamily: '"Share Tech Mono", monospace' }}>
                  Please connect your Stacks wallet to claim tokens
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleConnect}
                style={{
                  width: '100%',
                  padding: '20px',
                  background: 'linear-gradient(135deg, #00ff9d 0%, #00d4aa 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#0a0e27',
                  fontSize: '1.3rem',
                  fontWeight: 900,
                  fontFamily: '"Orbitron", monospace',
                  cursor: 'pointer',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  boxShadow: '0 5px 30px rgba(0, 255, 157, 0.4)'
                }}
              >
                CONNECT WALLET
              </motion.button>
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '30px',
                padding: '15px',
                background: 'rgba(0, 255, 157, 0.05)',
                borderRadius: '12px',
                border: '1px solid #00ff9d20'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#00ff9d',
                    boxShadow: '0 0 10px #00ff9d'
                  }} />
                  <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: '0.9rem' }}>
                    {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: '0.8rem'
                  }}
                >
                  <LogOut size={14} /> LOGOUT
                </button>
              </div>

              {timeRemaining > 0 && (
                <div style={{
                  textAlign: 'center',
                  marginBottom: '30px',
                  padding: '20px',
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid #8b5cf640',
                  borderRadius: '12px'
                }}>
                  <Clock size={32} color="#8b5cf6" style={{
                    marginBottom: '10px',
                    filter: 'drop-shadow(0 0 10px #8b5cf6)'
                  }} />
                  <div style={{
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: '0.9rem',
                    color: '#64748b',
                    marginBottom: '5px',
                    letterSpacing: '1px'
                  }}>
                    COOLDOWN ACTIVE
                  </div>
                  <div style={{
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: '#8b5cf6',
                    textShadow: '0 0 15px rgba(139, 92, 246, 0.8)',
                    fontFamily: '"Orbitron", monospace'
                  }}>
                    {formatTime(timeRemaining)}
                  </div>
                </div>
              )}

              <motion.button
                whileHover={canClaim && !claiming ? { scale: 1.02, boxShadow: '0 8px 40px rgba(0, 255, 157, 0.6)' } : {}}
                whileTap={canClaim && !claiming ? { scale: 0.98 } : {}}
                onClick={handleClaim}
                disabled={!canClaim || claiming}
                style={{
                  width: '100%',
                  padding: '20px',
                  background: canClaim 
                    ? 'linear-gradient(135deg, #00ff9d 0%, #00d4aa 100%)'
                    : 'rgba(100, 116, 139, 0.3)',
                  border: 'none',
                  borderRadius: '12px',
                  color: canClaim ? '#0a0e27' : '#64748b',
                  fontSize: '1.3rem',
                  fontWeight: 900,
                  fontFamily: '"Orbitron", monospace',
                  cursor: canClaim ? 'pointer' : 'not-allowed',
                  transition: 'background 0.3s ease',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: canClaim ? '0 5px 30px rgba(0, 255, 157, 0.4)' : 'none'
                }}
              >
                {claiming ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <Zap size={24} style={{ animation: 'glitch 0.5s infinite' }} />
                    PROMPTING...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <Droplets size={24} />
                    CLAIM {stats.faucetAmount} STX
                  </span>
                )}
              </motion.button>

              <div style={{
                marginTop: '40px',
                paddingTop: '20px',
                borderTop: '1px solid rgba(139, 92, 246, 0.2)'
              }}>
                <h4 style={{
                  color: '#8b5cf6',
                  fontFamily: '"Share Tech Mono", monospace',
                  fontSize: '0.9rem',
                  marginBottom: '15px'
                }}>&gt; FUND_FAUCET.sh</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Coins size={18} color="#8b5cf6" style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }} />
                    <input 
                      type="number"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 12px 12px 40px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid #8b5cf640',
                        borderRadius: '10px',
                        color: '#8b5cf6',
                        fontFamily: '"Share Tech Mono", monospace'
                      }}
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05, background: '#8b5cf6', color: '#0a0e27' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleFund}
                    disabled={funding}
                    style={{
                      padding: '0 25px',
                      background: 'transparent',
                      border: '1px solid #8b5cf6',
                      borderRadius: '10px',
                      color: '#8b5cf6',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: '"Share Tech Mono", monospace'
                    }}
                  >
                    {funding ? '...' : 'FUND'}
                  </motion.button>
                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* Recent Claims */}
        <AnimatePresence>
          {claimHistory.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              style={{
                marginTop: '40px'
              }}>
              <h3 style={{
                fontSize: '1.5rem',
                marginBottom: '20px',
                color: '#8b5cf6',
                textShadow: '0 0 15px rgba(139, 92, 246, 0.6)',
                fontFamily: '"Orbitron", monospace',
                letterSpacing: '2px'
              }}>
                &gt; CLAIM_HISTORY.log
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {claimHistory.map((claim, idx) => (
                  <motion.a
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.7 + idx * 0.1 }}
                    key={idx}
                    href={`https://explorer.hiro.so/txid/${claim.txId}?chain=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      textDecoration: 'none',
                      background: 'rgba(10, 14, 39, 0.6)',
                      border: '1px solid #00ff9d20',
                      borderRadius: '10px',
                      padding: '15px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backdropFilter: 'blur(10px)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(10, 14, 39, 0.8)';
                      e.currentTarget.style.borderColor = '#00ff9d40';
                      e.currentTarget.style.transform = 'translateX(5px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(10, 14, 39, 0.6)';
                      e.currentTarget.style.borderColor = '#00ff9d20';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    <div style={{
                      fontFamily: '"Share Tech Mono", monospace',
                      fontSize: '0.9rem',
                      color: '#64748b'
                    }}>
                      {claim.address}
                    </div>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                      <span style={{
                        color: '#00ff9d',
                        fontWeight: 700,
                        textShadow: '0 0 10px rgba(0, 255, 157, 0.6)'
                      }}>
                        +{claim.amount} STX
                      </span>
                      <span style={{
                        fontFamily: '"Share Tech Mono", monospace',
                        fontSize: '0.8rem',
                        color: '#64748b'
                      }}>
                        {new Date(claim.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </motion.a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer style={{
          marginTop: '60px',
          textAlign: 'center',
          padding: '30px',
          borderTop: '1px solid #00ff9d20',
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: '0.85rem',
          color: '#64748b',
          letterSpacing: '1px'
        }}>
          <p>&gt; POWERED_BY_STACKS_BLOCKCHAIN</p>
          <div style={{ marginTop: '10px', color: '#334155', display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <span>&gt; v2.2.0</span>
            <span>&gt; NETWORK: TESTNET</span>
            <span>&gt; STATUS: SECURE</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
