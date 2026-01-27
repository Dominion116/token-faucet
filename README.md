# STX Token Faucet

A production-ready token faucet smart contract and web interface for the Stacks blockchain. Dispenses STX tokens to users with configurable cooldown periods, perfect for testnet onboarding and user acquisition.

## Features

### Smart Contract Features
- ⏱️ **Configurable Cooldown** - Set custom waiting periods between claims (default: 1 hour)
- 💰 **Flexible Amounts** - Adjustable claim amounts with min/max limits
- 📊 **Comprehensive Statistics** - Track total dispensed, claim counts, and per-user data
- 🛡️ **Admin Controls** - Owner functions for configuration and emergency management
- 💎 **Funding System** - Anyone can fund the faucet, only owner can withdraw
- 🔒 **Security** - Built-in validation and error handling

### Frontend Features
- 🎨 **Cyberpunk Design** - Distinctive retro-futuristic aesthetic
- ⏰ **Live Countdown** - Real-time timer showing when users can claim again
- 📱 **Responsive UI** - Works seamlessly on desktop and mobile
- 💾 **Local Storage** - Tracks claim history client-side
- ✨ **Smooth Animations** - Engaging visual feedback and transitions
- 📈 **Live Statistics** - Displays faucet metrics in real-time

## Contract Architecture

### Data Structures

**Variables:**
- `faucet-amount` - Amount dispensed per claim (default: 10 STX)
- `cooldown-period` - Time between claims in seconds (default: 3600)
- `is-active` - Global on/off switch for the faucet
- `total-dispensed` - Cumulative STX distributed
- `total-claims` - Total number of successful claims

**Maps:**
- `user-last-claim` - Timestamp of each user's last claim
- `user-total-claimed` - Cumulative amount claimed by each user

### Public Functions

#### User Functions

**`claim()`**
Main claiming function. Validates cooldown, checks balance, and transfers STX.
```clarity
(contract-call? .token-faucet claim)
```
Returns: `{amount: uint, timestamp: uint, next-claim-time: uint}`

**`fund-faucet(amount)`**
Allows anyone to fund the faucet contract.
```clarity
(contract-call? .token-faucet fund-faucet u10000000)
```

#### Admin Functions (Owner Only)

**`set-faucet-amount(new-amount)`**
Update the amount dispensed per claim.
```clarity
(contract-call? .token-faucet set-faucet-amount u5000000)
```

**`set-cooldown-period(new-cooldown)`**
Update the cooldown period in seconds.
```clarity
(contract-call? .token-faucet set-cooldown-period u7200)
```

**`toggle-faucet()`**
Enable or disable the faucet.
```clarity
(contract-call? .token-faucet toggle-faucet)
```

**`withdraw(amount, recipient)`**
Withdraw funds from the contract.
```clarity
(contract-call? .token-faucet withdraw u10000000 'SP2...)
```

**`emergency-withdraw()`**
Withdraw all funds to owner (emergency use).
```clarity
(contract-call? .token-faucet emergency-withdraw)
```

**`set-claim-limits(min-amount, max-amount)`**
Update min/max claim boundaries.
```clarity
(contract-call? .token-faucet set-claim-limits u1000000 u50000000)
```

**`reset-user-cooldown(user)`**
Reset cooldown for a specific user (emergency use).
```clarity
(contract-call? .token-faucet reset-user-cooldown 'SP2...)
```

### Read-Only Functions

**`get-faucet-amount()`** - Get current claim amount
**`get-cooldown-period()`** - Get cooldown duration
**`get-time-until-next-claim(user)`** - Get seconds until user can claim
**`can-claim(user)`** - Check if user is eligible to claim
**`get-user-last-claim(user)`** - Get user's last claim timestamp
**`get-user-total-claimed(user)`** - Get user's cumulative claims
**`get-faucet-stats()`** - Get all faucet statistics
**`is-faucet-active()`** - Check if faucet is enabled
**`get-contract-balance()`** - Get contract's STX balance

### Error Codes

- `u100` - Owner-only function
- `u101` - Insufficient contract balance
- `u102` - Cooldown period not elapsed
- `u103` - Invalid amount parameter
- `u104` - Already initialized

## Deployment Guide

### Prerequisites
- [Clarinet](https://github.com/hirosystems/clarinet) installed
- Stacks wallet with STX for deployment
- Node.js and npm (for frontend)

### Deploy Contract

1. **Initialize Clarinet Project**
```bash
clarinet new stx-faucet
cd stx-faucet
```

2. **Add Contract**
```bash
# Copy token-faucet.clar to contracts/
cp token-faucet.clar contracts/
```

3. **Update Clarinet.toml**
```toml
[project]
name = "stx-faucet"
requirements = []
[contracts.token-faucet]
path = "contracts/token-faucet.clar"
```

4. **Test Locally**
```bash
clarinet test
```

5. **Deploy to Testnet**
```bash
clarinet deploy --testnet
```

6. **Deploy to Mainnet**
```bash
clarinet deploy --mainnet
```

### Initial Setup

After deployment, fund the contract:

```clarity
;; Fund with 1000 STX
(contract-call? .token-faucet fund-faucet u1000000000)
```

### Frontend Integration

1. **Install Dependencies**
```bash
npm install @stacks/connect @stacks/transactions
```

2. **Connect Wallet**
```javascript
import { showConnect } from '@stacks/connect';
import { StacksTestnet, StacksMainnet } from '@stacks/network';

const connectWallet = () => {
  showConnect({
    appDetails: {
      name: 'STX Faucet',
      icon: window.location.origin + '/logo.png',
    },
    onFinish: () => {
      // Handle successful connection
    },
    userSession,
  });
};
```

3. **Implement Claim Function**
```javascript
import { 
  makeContractCall, 
  broadcastTransaction,
  AnchorMode 
} from '@stacks/transactions';

async function claimTokens(walletAddress) {
  const network = new StacksTestnet(); // or StacksMainnet()
  
  const txOptions = {
    contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Your contract address
    contractName: 'token-faucet',
    functionName: 'claim',
    functionArgs: [],
    senderKey: userSession.loadUserData().profile.stxAddress.testnet,
    validateWithAbi: true,
    network,
    anchorMode: AnchorMode.Any,
  };

  const transaction = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction(transaction, network);
  
  return broadcastResponse.txid;
}
```

4. **Check Eligibility**
```javascript
import { callReadOnlyFunction, cvToJSON } from '@stacks/transactions';

async function canUserClaim(userAddress) {
  const network = new StacksTestnet();
  
  const result = await callReadOnlyFunction({
    contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    contractName: 'token-faucet',
    functionName: 'can-claim',
    functionArgs: [principalCV(userAddress)],
    network,
    senderAddress: userAddress,
  });
  
  return cvToJSON(result).value;
}
```

5. **Get Time Until Next Claim**
```javascript
async function getTimeRemaining(userAddress) {
  const network = new StacksTestnet();
  
  const result = await callReadOnlyFunction({
    contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    contractName: 'token-faucet',
    functionName: 'get-time-until-next-claim',
    functionArgs: [principalCV(userAddress)],
    network,
    senderAddress: userAddress,
  });
  
  return cvToJSON(result).value.value; // seconds remaining
}
```

## Configuration Examples

### For Testing (Testnet)
```clarity
;; Short cooldown for testing
(contract-call? .token-faucet set-cooldown-period u300) ;; 5 minutes

;; Generous amount for testing
(contract-call? .token-faucet set-faucet-amount u50000000) ;; 50 STX
```

### For Production (Mainnet)
```clarity
;; Daily claims
(contract-call? .token-faucet set-cooldown-period u86400) ;; 24 hours

;; Conservative amount
(contract-call? .token-faucet set-faucet-amount u1000000) ;; 1 STX
```

## Security Considerations

1. **Cooldown Enforcement** - Uses block timestamps to prevent spam
2. **Balance Checks** - Validates contract has sufficient funds before transfer
3. **Owner Restrictions** - Critical functions limited to contract deployer
4. **Input Validation** - All parameters validated against defined limits
5. **Emergency Functions** - Admin can disable faucet or withdraw funds if needed

## Gas Optimization

The contract is optimized for minimal gas usage:
- Efficient data structures (maps instead of lists)
- Single STX transfer per claim
- Minimal state updates
- Read-only functions for queries

## Testing

### Unit Tests with Clarinet

Create `tests/token-faucet_test.ts`:

```typescript
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Allows user to claim tokens after cooldown",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        
        // Fund the faucet
        let block = chain.mineBlock([
            Tx.contractCall('token-faucet', 'fund-faucet', 
                [types.uint(100000000)], deployer.address)
        ]);
        
        // First claim should succeed
        block = chain.mineBlock([
            Tx.contractCall('token-faucet', 'claim', [], wallet1.address)
        ]);
        block.receipts[0].result.expectOk();
        
        // Second immediate claim should fail
        block = chain.mineBlock([
            Tx.contractCall('token-faucet', 'claim', [], wallet1.address)
        ]);
        block.receipts[0].result.expectErr(types.uint(102));
    },
});
```

Run tests:
```bash
clarinet test
```

## Monitoring & Analytics

### Track Faucet Health

```javascript
async function getFaucetHealth() {
  const stats = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: 'token-faucet',
    functionName: 'get-faucet-stats',
    functionArgs: [],
    network,
    senderAddress: userAddress,
  });
  
  const data = cvToJSON(stats).value;
  
  return {
    totalDispensed: data['total-dispensed'].value,
    totalClaims: data['total-claims'].value,
    contractBalance: data['contract-balance'].value,
    isActive: data['is-active'].value,
    balanceInSTX: data['contract-balance'].value / 1000000,
  };
}
```

## Troubleshooting

### Common Issues

**"Cooldown active" error**
- User hasn't waited long enough between claims
- Check time remaining with `get-time-until-next-claim`

**"Insufficient balance" error**
- Contract needs more funds
- Call `fund-faucet` to add STX

**"Owner only" error**
- Trying to call admin function from non-owner account
- Only deployer can call these functions

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions or issues:
- Open an issue on GitHub
- Join the Stacks Discord
- Check Stacks documentation: https://docs.stacks.co

## Roadmap

- [ ] Multi-token support (SIP-010 tokens)
- [ ] Referral system
- [ ] Captcha integration
- [ ] Analytics dashboard
- [ ] Rate limiting by IP
- [ ] Whitelist/blacklist functionality
- [ ] Automated refilling mechanism
- [ ] Social media verification
