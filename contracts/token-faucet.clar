;; STX Token Faucet Contract
;; A faucet that dispenses STX tokens to users with a cooldown period

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-cooldown-active (err u102))
(define-constant err-invalid-amount (err u103))
(define-constant err-already-initialized (err u104))

;; Configurable parameters
(define-data-var faucet-amount uint u10000000) ;; 10 STX (in microSTX)
(define-data-var cooldown-period uint u3600) ;; 1 hour in seconds
(define-data-var max-claim-amount uint u50000000) ;; 50 STX max per claim
(define-data-var min-claim-amount uint u1000000) ;; 1 STX min per claim
(define-data-var is-active bool true)
(define-data-var total-dispensed uint u0)
(define-data-var total-claims uint u0)

;; Data maps
(define-map user-last-claim principal uint)
(define-map user-total-claimed principal uint)

;; Read-only functions

;; Get the current faucet amount
(define-read-only (get-faucet-amount)
  (ok (var-get faucet-amount))
)

;; Get the cooldown period
(define-read-only (get-cooldown-period)
  (ok (var-get cooldown-period))
)

;; Get time until next claim for a user
(define-read-only (get-time-until-next-claim (user principal))
  (let
    (
      (last-claim (default-to u0 (map-get? user-last-claim user)))
      (current-time (unwrap-panic (get-block-info? time (- block-height u1))))
      (cooldown (var-get cooldown-period))
      (time-elapsed (- current-time last-claim))
    )
    (if (>= time-elapsed cooldown)
      (ok u0)
      (ok (- cooldown time-elapsed))
    )
  )
)

;; Check if user can claim
(define-read-only (can-claim (user principal))
  (let
    (
      (time-remaining (unwrap-panic (get-time-until-next-claim user)))
    )
    (ok (and (var-get is-active) (is-eq time-remaining u0)))
  )
)

;; Get user's last claim timestamp
(define-read-only (get-user-last-claim (user principal))
  (ok (default-to u0 (map-get? user-last-claim user)))
)

;; Get user's total claimed amount
(define-read-only (get-user-total-claimed (user principal))
  (ok (default-to u0 (map-get? user-total-claimed user)))
)

;; Get faucet statistics
(define-read-only (get-faucet-stats)
  (ok {
    total-dispensed: (var-get total-dispensed),
    total-claims: (var-get total-claims),
    faucet-amount: (var-get faucet-amount),
    cooldown-period: (var-get cooldown-period),
    is-active: (var-get is-active),
    contract-balance: (stx-get-balance (as-contract tx-sender))
  })
)

;; Check if faucet is active
(define-read-only (is-faucet-active)
  (ok (var-get is-active))
)

;; Get contract balance
(define-read-only (get-contract-balance)
  (ok (stx-get-balance (as-contract tx-sender)))
)

;; Public functions

;; Main claim function
(define-public (claim)
  (let
    (
      (claimer tx-sender)
      (current-time (unwrap-panic (get-block-info? time (- block-height u1))))
      (last-claim (default-to u0 (map-get? user-last-claim claimer)))
      (time-elapsed (- current-time last-claim))
      (cooldown (var-get cooldown-period))
      (amount (var-get faucet-amount))
      (contract-balance (stx-get-balance (as-contract tx-sender)))
      (previous-total (default-to u0 (map-get? user-total-claimed claimer)))
    )
    ;; Check if faucet is active
    (asserts! (var-get is-active) err-cooldown-active)
    
    ;; Check if cooldown period has passed
    (asserts! (>= time-elapsed cooldown) err-cooldown-active)
    
    ;; Check if contract has sufficient balance
    (asserts! (>= contract-balance amount) err-insufficient-balance)
    
    ;; Transfer STX from contract to claimer
    (try! (as-contract (stx-transfer? amount tx-sender claimer)))
    
    ;; Update user's last claim time
    (map-set user-last-claim claimer current-time)
    
    ;; Update user's total claimed amount
    (map-set user-total-claimed claimer (+ previous-total amount))
    
    ;; Update global statistics
    (var-set total-dispensed (+ (var-get total-dispensed) amount))
    (var-set total-claims (+ (var-get total-claims) u1))
    
    (ok {
      amount: amount,
      timestamp: current-time,
      next-claim-time: (+ current-time cooldown)
    })
  )
)

;; Admin functions

;; Update faucet amount (only owner)
(define-public (set-faucet-amount (new-amount uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (and (>= new-amount (var-get min-claim-amount)) 
                   (<= new-amount (var-get max-claim-amount))) 
              err-invalid-amount)
    (var-set faucet-amount new-amount)
    (ok true)
  )
)

;; Update cooldown period (only owner)
(define-public (set-cooldown-period (new-cooldown uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> new-cooldown u0) err-invalid-amount)
    (var-set cooldown-period new-cooldown)
    (ok true)
  )
)

;; Toggle faucet active state (only owner)
(define-public (toggle-faucet)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set is-active (not (var-get is-active)))
    (ok (var-get is-active))
  )
)

;; Fund the faucet (anyone can fund)
(define-public (fund-faucet (amount uint))
  (begin
    (asserts! (> amount u0) err-invalid-amount)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (ok true)
  )
)

;; Withdraw funds (only owner)
(define-public (withdraw (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> amount u0) err-invalid-amount)
    (try! (as-contract (stx-transfer? amount tx-sender recipient)))
    (ok true)
  )
)

;; Emergency withdraw all (only owner)
(define-public (emergency-withdraw)
  (let
    (
      (balance (stx-get-balance (as-contract tx-sender)))
    )
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (try! (as-contract (stx-transfer? balance tx-sender contract-owner)))
    (ok balance)
  )
)

;; Update claim limits (only owner)
(define-public (set-claim-limits (min-amount uint) (max-amount uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (< min-amount max-amount) err-invalid-amount)
    (var-set min-claim-amount min-amount)
    (var-set max-claim-amount max-amount)
    (ok true)
  )
)

;; Reset user cooldown (only owner, for emergency use)
(define-public (reset-user-cooldown (user principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-delete user-last-claim user)
    (ok true)
  )
)
