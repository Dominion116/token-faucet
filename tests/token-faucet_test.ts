import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Test: Initial contract state
Clarinet.test({
    name: "Contract initializes with correct default values",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        // Check faucet amount
        let call = chain.callReadOnlyFn(
            'token-faucet',
            'get-faucet-amount',
            [],
            deployer.address
        );
        call.result.expectOk().expectUint(10000000); // 10 STX
        
        // Check cooldown period
        call = chain.callReadOnlyFn(
            'token-faucet',
            'get-cooldown-period',
            [],
            deployer.address
        );
        call.result.expectOk().expectUint(3600); // 1 hour
        
        // Check if active
        call = chain.callReadOnlyFn(
            'token-faucet',
            'is-faucet-active',
            [],
            deployer.address
        );
        call.result.expectOk().expectBool(true);
    },
});

// Test: Funding the faucet
Clarinet.test({
    name: "Anyone can fund the faucet",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'fund-faucet',
                [types.uint(100000000)], // 100 STX
                wallet1.address
            )
        ]);
        
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify contract balance
        let call = chain.callReadOnlyFn(
            'token-faucet',
            'get-contract-balance',
            [],
            deployer.address
        );
        call.result.expectOk().expectUint(100000000);
    },
});

// Test: Successful claim
Clarinet.test({
    name: "User can claim tokens successfully",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        
        // First fund the faucet
        let block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'fund-faucet',
                [types.uint(100000000)],
                deployer.address
            )
        ]);
        
        // Then claim
        block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'claim',
                [],
                wallet1.address
            )
        ]);
        
        const receipt = block.receipts[0];
        receipt.result.expectOk();
        
        // Verify the response structure
        const result = receipt.result.expectOk().expectTuple();
        result['amount'].expectUint(10000000);
        
        // Verify user's total claimed
        let call = chain.callReadOnlyFn(
            'token-faucet',
            'get-user-total-claimed',
            [types.principal(wallet1.address)],
            deployer.address
        );
        call.result.expectOk().expectUint(10000000);
    },
});

// Test: Cooldown enforcement
Clarinet.test({
    name: "Prevents claims during cooldown period",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        
        // Fund the faucet
        let block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'fund-faucet',
                [types.uint(100000000)],
                deployer.address
            )
        ]);
        
        // First claim - should succeed
        block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'claim',
                [],
                wallet1.address
            )
        ]);
        block.receipts[0].result.expectOk();
        
        // Immediate second claim - should fail with cooldown error
        block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'claim',
                [],
                wallet1.address
            )
        ]);
        block.receipts[0].result.expectErr().expectUint(102);
        
        // Verify user can't claim
        let call = chain.callReadOnlyFn(
            'token-faucet',
            'can-claim',
            [types.principal(wallet1.address)],
            deployer.address
        );
        call.result.expectOk().expectBool(false);
    },
});

// Test: Insufficient balance
Clarinet.test({
    name: "Fails when contract has insufficient balance",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        
        // Try to claim without funding - should fail
        let block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'claim',
                [],
                wallet1.address
            )
        ]);
        
        block.receipts[0].result.expectErr().expectUint(101);
    },
});

// Test: Owner can update faucet amount
Clarinet.test({
    name: "Owner can update faucet amount",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        
        // Owner updates amount
        let block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'set-faucet-amount',
                [types.uint(5000000)], // 5 STX
                deployer.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify new amount
        let call = chain.callReadOnlyFn(
            'token-faucet',
            'get-faucet-amount',
            [],
            deployer.address
        );
        call.result.expectOk().expectUint(5000000);
        
        // Non-owner cannot update
        block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'set-faucet-amount',
                [types.uint(20000000)],
                wallet1.address
            )
        ]);
        block.receipts[0].result.expectErr().expectUint(100);
    },
});

// Test: Owner can update cooldown period
Clarinet.test({
    name: "Owner can update cooldown period",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'set-cooldown-period',
                [types.uint(7200)], // 2 hours
                deployer.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify new cooldown
        let call = chain.callReadOnlyFn(
            'token-faucet',
            'get-cooldown-period',
            [],
            deployer.address
        );
        call.result.expectOk().expectUint(7200);
    },
});

// Test: Toggle faucet
Clarinet.test({
    name: "Owner can toggle faucet on/off",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        
        // Fund the faucet
        let block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'fund-faucet',
                [types.uint(100000000)],
                deployer.address
            )
        ]);
        
        // Toggle off
        block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'toggle-faucet',
                [],
                deployer.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(false);
        
        // Try to claim - should fail
        block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'claim',
                [],
                wallet1.address
            )
        ]);
        block.receipts[0].result.expectErr().expectUint(102);
        
        // Toggle back on
        block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'toggle-faucet',
                [],
                deployer.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Claim should now work
        block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'claim',
                [],
                wallet1.address
            )
        ]);
        block.receipts[0].result.expectOk();
    },
});

// Test: Owner can withdraw
Clarinet.test({
    name: "Owner can withdraw funds",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        
        // Fund the faucet
        let block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'fund-faucet',
                [types.uint(100000000)],
                deployer.address
            )
        ]);
        
        // Owner withdraws
        block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'withdraw',
                [types.uint(50000000), types.principal(deployer.address)],
                deployer.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify contract balance
        let call = chain.callReadOnlyFn(
            'token-faucet',
            'get-contract-balance',
            [],
            deployer.address
        );
        call.result.expectOk().expectUint(50000000);
        
        // Non-owner cannot withdraw
        block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'withdraw',
                [types.uint(10000000), types.principal(wallet1.address)],
                wallet1.address
            )
        ]);
        block.receipts[0].result.expectErr().expectUint(100);
    },
});

// Test: Get faucet stats
Clarinet.test({
    name: "Get comprehensive faucet statistics",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        
        // Fund and make some claims
        let block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'fund-faucet',
                [types.uint(100000000)],
                deployer.address
            ),
            Tx.contractCall(
                'token-faucet',
                'claim',
                [],
                wallet1.address
            ),
            Tx.contractCall(
                'token-faucet',
                'claim',
                [],
                wallet2.address
            )
        ]);
        
        // Get stats
        let call = chain.callReadOnlyFn(
            'token-faucet',
            'get-faucet-stats',
            [],
            deployer.address
        );
        
        const stats = call.result.expectOk().expectTuple();
        stats['total-dispensed'].expectUint(20000000); // 2 claims × 10 STX
        stats['total-claims'].expectUint(2);
        stats['is-active'].expectBool(true);
        stats['faucet-amount'].expectUint(10000000);
        stats['cooldown-period'].expectUint(3600);
    },
});

// Test: Multiple users can claim
Clarinet.test({
    name: "Multiple users can claim independently",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        const wallet3 = accounts.get('wallet_3')!;
        
        // Fund the faucet
        let block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'fund-faucet',
                [types.uint(100000000)],
                deployer.address
            )
        ]);
        
        // Multiple users claim
        block = chain.mineBlock([
            Tx.contractCall('token-faucet', 'claim', [], wallet1.address),
            Tx.contractCall('token-faucet', 'claim', [], wallet2.address),
            Tx.contractCall('token-faucet', 'claim', [], wallet3.address),
        ]);
        
        // All should succeed
        assertEquals(block.receipts.length, 3);
        block.receipts[0].result.expectOk();
        block.receipts[1].result.expectOk();
        block.receipts[2].result.expectOk();
        
        // Each user should have 10 STX claimed
        for (const wallet of [wallet1, wallet2, wallet3]) {
            let call = chain.callReadOnlyFn(
                'token-faucet',
                'get-user-total-claimed',
                [types.principal(wallet.address)],
                deployer.address
            );
            call.result.expectOk().expectUint(10000000);
        }
    },
});

// Test: Emergency withdraw
Clarinet.test({
    name: "Owner can emergency withdraw all funds",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        // Fund the faucet
        let block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'fund-faucet',
                [types.uint(100000000)],
                deployer.address
            )
        ]);
        
        // Emergency withdraw
        block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'emergency-withdraw',
                [],
                deployer.address
            )
        ]);
        
        const receipt = block.receipts[0];
        receipt.result.expectOk().expectUint(100000000);
        
        // Contract balance should be 0
        let call = chain.callReadOnlyFn(
            'token-faucet',
            'get-contract-balance',
            [],
            deployer.address
        );
        call.result.expectOk().expectUint(0);
    },
});

// Test: Reset user cooldown
Clarinet.test({
    name: "Owner can reset user cooldown",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        
        // Fund and claim
        let block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'fund-faucet',
                [types.uint(100000000)],
                deployer.address
            ),
            Tx.contractCall(
                'token-faucet',
                'claim',
                [],
                wallet1.address
            )
        ]);
        
        // User can't claim immediately
        let call = chain.callReadOnlyFn(
            'token-faucet',
            'can-claim',
            [types.principal(wallet1.address)],
            deployer.address
        );
        call.result.expectOk().expectBool(false);
        
        // Owner resets cooldown
        block = chain.mineBlock([
            Tx.contractCall(
                'token-faucet',
                'reset-user-cooldown',
                [types.principal(wallet1.address)],
                deployer.address
            )
        ]);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // User can now claim again
        call = chain.callReadOnlyFn(
            'token-faucet',
            'can-claim',
            [types.principal(wallet1.address)],
            deployer.address
        );
        call.result.expectOk().expectBool(true);
    },
});
