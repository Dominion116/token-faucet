# STX Token Faucet - Frontend Integration Guide

## Contract Details
- **Contract Address**: `ST30VGN68PSGVWGNMD0HH2WQMM5T486EK3WBNTHCY.token-faucet`
- **Network**: Stacks Testnet (Hiro Sandbox)

## Prerequisites

```bash
npm install @stacks/connect @stacks/transactions @stacks/network
```

## Quick Start Integration

### 1. Basic Setup

```javascript
import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { 
  uintCV, 
  principalCV,
  callReadOnlyFunction,
  makeContractCall,
  broadcastTransaction
} from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';

// Configure network
const network = new StacksTestnet();
const contractAddress = 'ST30VGN68PSGVWGNMD0HH2WQMM5T486EK3WBNTHCY';
const contractName = 'token-faucet';

// User session setup
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });
```

### 2. Connect Wallet

```javascript
function connectWallet() {
  showConnect({
    appDetails: {
      name: 'STX Faucet',
      icon: window.location.origin + '/logo.png',
    },
    redirectTo: '/',
    onFinish: () => {
      window.location.reload();
    },
    userSession,
  });
}
```

### 3. Read Contract Data

```javascript
// Get faucet amount
async function getFaucetAmount() {
  const result = await callReadOnlyFunction({
    network,
    contractAddress,
    contractName,
    functionName: 'get-faucet-amount',
    functionArgs: [],
    senderAddress: contractAddress,
  });
  
  // Result is in microSTX (1 STX = 1,000,000 microSTX)
  const microSTX = result.value;
  return microSTX / 1000000; // Convert to STX
}

// Get cooldown period (in blocks)
async function getCooldownPeriod() {
  const result = await callReadOnlyFunction({
    network,
    contractAddress,
    contractName,
    functionName: 'get-cooldown-period',
    functionArgs: [],
    senderAddress: contractAddress,
  });
  
  return result.value;
}

// Check if user can claim
async function canUserClaim(userAddress) {
  const result = await callReadOnlyFunction({
    network,
    contractAddress,
    contractName,
    functionName: 'can-claim',
    functionArgs: [principalCV(userAddress)],
    senderAddress: contractAddress,
  });
  
  return result.value;
}

// Get user's last claim
async function getUserLastClaim(userAddress) {
  const result = await callReadOnlyFunction({
    network,
    contractAddress,
    contractName,
    functionName: 'get-user-last-claim',
    functionArgs: [principalCV(userAddress)],
    senderAddress: contractAddress,
  });
  
  return result.value;
}

// Get user's total claimed amount
async function getUserTotalClaimed(userAddress) {
  const result = await callReadOnlyFunction({
    network,
    contractAddress,
    contractName,
    functionName: 'get-user-total-claimed',
    functionArgs: [principalCV(userAddress)],
    senderAddress: contractAddress,
  });
  
  const microSTX = result.value;
  return microSTX / 1000000; // Convert to STX
}

// Get faucet statistics
async function getFaucetStats() {
  const result = await callReadOnlyFunction({
    network,
    contractAddress,
    contractName,
    functionName: 'get-faucet-stats',
    functionArgs: [],
    senderAddress: contractAddress,
  });
  
  return {
    totalDispensed: result.value.data['total-dispensed'].value / 1000000,
    totalClaims: result.value.data['total-claims'].value,
    faucetAmount: result.value.data['faucet-amount'].value / 1000000,
    cooldownPeriod: result.value.data['cooldown-period'].value,
    isActive: result.value.data['is-active'].value,
    contractBalance: result.value.data['contract-balance'].value / 1000000,
  };
}

// Check if faucet is active
async function isFaucetActive() {
  const result = await callReadOnlyFunction({
    network,
    contractAddress,
    contractName,
    functionName: 'is-faucet-active',
    functionArgs: [],
    senderAddress: contractAddress,
  });
  
  return result.value;
}

// Get contract balance
async function getContractBalance() {
  const result = await callReadOnlyFunction({
    network,
    contractAddress,
    contractName,
    functionName: 'get-contract-balance',
    functionArgs: [],
    senderAddress: contractAddress,
  });
  
  return result.value / 1000000; // Convert to STX
}
```

### 4. Write Functions (User Actions)

```javascript
// Claim tokens
async function claimTokens() {
  const txOptions = {
    network,
    anchorMode: 1,
    contractAddress,
    contractName,
    functionName: 'claim',
    functionArgs: [],
    postConditionMode: 1,
    onFinish: (data) => {
      console.log('Transaction ID:', data.txId);
      console.log('Explorer:', `https://explorer.hiro.so/txid/${data.txId}?chain=testnet`);
    },
  };

  await makeContractCall(txOptions);
}

// Fund the faucet (anyone can fund)
async function fundFaucet(amountInSTX) {
  const microSTX = amountInSTX * 1000000;
  
  const txOptions = {
    network,
    anchorMode: 1,
    contractAddress,
    contractName,
    functionName: 'fund-faucet',
    functionArgs: [uintCV(microSTX)],
    postConditionMode: 1,
    onFinish: (data) => {
      console.log('Funded! Transaction ID:', data.txId);
    },
  };

  await makeContractCall(txOptions);
}
```

### 5. Admin Functions (Owner Only)

```javascript
// Set faucet amount (owner only)
async function setFaucetAmount(newAmountInSTX) {
  const microSTX = newAmountInSTX * 1000000;
  
  const txOptions = {
    network,
    anchorMode: 1,
    contractAddress,
    contractName,
    functionName: 'set-faucet-amount',
    functionArgs: [uintCV(microSTX)],
    postConditionMode: 1,
    onFinish: (data) => {
      console.log('Amount updated! Transaction ID:', data.txId);
    },
  };

  await makeContractCall(txOptions);
}

// Set cooldown period (owner only)
async function setCooldownPeriod(blocks) {
  const txOptions = {
    network,
    anchorMode: 1,
    contractAddress,
    contractName,
    functionName: 'set-cooldown-period',
    functionArgs: [uintCV(blocks)],
    postConditionMode: 1,
    onFinish: (data) => {
      console.log('Cooldown updated! Transaction ID:', data.txId);
    },
  };

  await makeContractCall(txOptions);
}

// Toggle faucet active state (owner only)
async function toggleFaucet() {
  const txOptions = {
    network,
    anchorMode: 1,
    contractAddress,
    contractName,
    functionName: 'toggle-faucet',
    functionArgs: [],
    postConditionMode: 1,
    onFinish: (data) => {
      console.log('Faucet toggled! Transaction ID:', data.txId);
    },
  };

  await makeContractCall(txOptions);
}

// Withdraw funds (owner only)
async function withdrawFunds(amountInSTX, recipientAddress) {
  const microSTX = amountInSTX * 1000000;
  
  const txOptions = {
    network,
    anchorMode: 1,
    contractAddress,
    contractName,
    functionName: 'withdraw',
    functionArgs: [uintCV(microSTX), principalCV(recipientAddress)],
    postConditionMode: 1,
    onFinish: (data) => {
      console.log('Withdrawal successful! Transaction ID:', data.txId);
    },
  };

  await makeContractCall(txOptions);
}

// Emergency withdraw all (owner only)
async function emergencyWithdraw() {
  const txOptions = {
    network,
    anchorMode: 1,
    contractAddress,
    contractName,
    functionName: 'emergency-withdraw',
    functionArgs: [],
    postConditionMode: 1,
    onFinish: (data) => {
      console.log('Emergency withdrawal complete! Transaction ID:', data.txId);
    },
  };

  await makeContractCall(txOptions);
}

// Set claim limits (owner only)
async function setClaimLimits(minAmountInSTX, maxAmountInSTX) {
  const minMicroSTX = minAmountInSTX * 1000000;
  const maxMicroSTX = maxAmountInSTX * 1000000;
  
  const txOptions = {
    network,
    anchorMode: 1,
    contractAddress,
    contractName,
    functionName: 'set-claim-limits',
    functionArgs: [uintCV(minMicroSTX), uintCV(maxMicroSTX)],
    postConditionMode: 1,
    onFinish: (data) => {
      console.log('Limits updated! Transaction ID:', data.txId);
    },
  };

  await makeContractCall(txOptions);
}

// Reset user cooldown (owner only)
async function resetUserCooldown(userAddress) {
  const txOptions = {
    network,
    anchorMode: 1,
    contractAddress,
    contractName,
    functionName: 'reset-user-cooldown',
    functionArgs: [principalCV(userAddress)],
    postConditionMode: 1,
    onFinish: (data) => {
      console.log('Cooldown reset! Transaction ID:', data.txId);
    },
  };

  await makeContractCall(txOptions);
}
```

## Complete React Component Example

```javascript
import React, { useState, useEffect } from 'react';
import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { callReadOnlyFunction, makeContractCall, principalCV } from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';

const network = new StacksTestnet();
const contractAddress = 'ST30VGN68PSGVWGNMD0HH2WQMM5T486EK3WBNTHCY';
const contractName = 'token-faucet';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

function FaucetApp() {
  const [userData, setUserData] = useState(null);
  const [faucetStats, setFaucetStats] = useState(null);
  const [canClaim, setCanClaim] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userSession.isSignInPending()) {
      userSession.handlePendingSignIn().then((userData) => {
        setUserData(userData);
      });
    } else if (userSession.isUserSignedIn()) {
      setUserData(userSession.loadUserData());
    }
  }, []);

  useEffect(() => {
    loadFaucetData();
  }, [userData]);

  async function loadFaucetData() {
    try {
      // Get faucet stats
      const stats = await callReadOnlyFunction({
        network,
        contractAddress,
        contractName,
        functionName: 'get-faucet-stats',
        functionArgs: [],
        senderAddress: contractAddress,
      });

      setFaucetStats({
        totalDispensed: stats.value.data['total-dispensed'].value / 1000000,
        totalClaims: Number(stats.value.data['total-claims'].value),
        faucetAmount: stats.value.data['faucet-amount'].value / 1000000,
        cooldownPeriod: Number(stats.value.data['cooldown-period'].value),
        isActive: stats.value.data['is-active'].value,
        contractBalance: stats.value.data['contract-balance'].value / 1000000,
      });

      // Check if user can claim
      if (userData) {
        const userAddress = userData.profile.stxAddress.testnet;
        const canClaimResult = await callReadOnlyFunction({
          network,
          contractAddress,
          contractName,
          functionName: 'can-claim',
          functionArgs: [principalCV(userAddress)],
          senderAddress: contractAddress,
        });
        setCanClaim(canClaimResult.value);
      }
    } catch (error) {
      console.error('Error loading faucet data:', error);
    }
  }

  function connectWallet() {
    showConnect({
      appDetails: {
        name: 'STX Faucet',
        icon: window.location.origin + '/logo.png',
      },
      redirectTo: '/',
      onFinish: () => {
        window.location.reload();
      },
      userSession,
    });
  }

  async function handleClaim() {
    if (!userData) return;
    
    setLoading(true);
    try {
      await makeContractCall({
        network,
        anchorMode: 1,
        contractAddress,
        contractName,
        functionName: 'claim',
        functionArgs: [],
        postConditionMode: 1,
        onFinish: (data) => {
          console.log('Claim successful!', data.txId);
          alert('Claim submitted! Check transaction: ' + data.txId);
          loadFaucetData();
        },
      });
    } catch (error) {
      console.error('Claim error:', error);
      alert('Claim failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!userData) {
    return (
      <div className="faucet-container">
        <h1>STX Token Faucet</h1>
        <button onClick={connectWallet}>Connect Wallet</button>
      </div>
    );
  }

  return (
    <div className="faucet-container">
      <h1>STX Token Faucet</h1>
      
      <div className="user-info">
        <p>Connected: {userData.profile.stxAddress.testnet}</p>
      </div>

      {faucetStats && (
        <div className="faucet-stats">
          <h2>Faucet Stats</h2>
          <p>Faucet Amount: {faucetStats.faucetAmount} STX</p>
          <p>Contract Balance: {faucetStats.contractBalance} STX</p>
          <p>Cooldown: {faucetStats.cooldownPeriod} blocks (~{(faucetStats.cooldownPeriod * 10 / 60).toFixed(1)} hours)</p>
          <p>Total Dispensed: {faucetStats.totalDispensed} STX</p>
          <p>Total Claims: {faucetStats.totalClaims}</p>
          <p>Status: {faucetStats.isActive ? '🟢 Active' : '🔴 Inactive'}</p>
        </div>
      )}

      <div className="claim-section">
        <button 
          onClick={handleClaim} 
          disabled={!canClaim || loading || !faucetStats?.isActive}
        >
          {loading ? 'Processing...' : canClaim ? 'Claim Tokens' : 'Cannot Claim Yet'}
        </button>
        {!canClaim && <p>You must wait for the cooldown period to pass</p>}
      </div>
    </div>
  );
}

export default FaucetApp;
```

## Important Notes

1. **Cooldown Period**: Uses block heights (1 block ≈ 10 minutes)
   - 6 blocks = ~1 hour
   - 144 blocks = ~1 day

2. **microSTX Conversion**: 1 STX = 1,000,000 microSTX

3. **Network**: Currently set to `StacksTestnet`. For mainnet, use `StacksMainnet`

4. **Transaction Monitoring**: Use Hiro Explorer to monitor transactions:
   - Testnet: `https://explorer.hiro.so/txid/TX_ID?chain=testnet`

5. **Error Codes**:
   - `u100`: Owner only
   - `u101`: Insufficient balance
   - `u102`: Cooldown active
   - `u103`: Invalid amount

## Testing Checklist

- [ ] Connect wallet
- [ ] View faucet stats
- [ ] Check if user can claim
- [ ] Claim tokens
- [ ] Wait for cooldown
- [ ] Try claiming again (should fail)
- [ ] Fund faucet (as any user)
- [ ] Admin functions (if you're the owner)

## Next Steps

1. Deploy the frontend
2. Fund the contract with STX
3. Test claiming functionality
4. Monitor contract balance
5. Adjust parameters as needed
