;; candidate.clar
;; Candidate coin contract for StrawMan franchise system

(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)


(define-constant HOUSE-FRANCHISE 'ST2BZ3RGBBTR8JD5V07PSSD9VN6WHAARN0R0Y2YWG)
(define-constant LIQUIDITY-POOL 'ST3FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAK)
(define-constant MAXSUPPLY u1000000)

(define-fungible-token candidate-coin MAXSUPPLY)
(define-data-var total-supply uint u0)
(define-data-var contract-owner principal tx-sender)

;; Mint candidate coins to the house franchise treasury
(define-public (mint-to-house (amount uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err u401))
    (ft-mint? candidate-coin amount HOUSE-FRANCHISE)
    (var-set total-supply (+ (var-get total-supply) amount))
    (ok true)
  )
)

;; Sell candidate coins to user, split proceeds
(define-public (sell-to-user (amount uint) (user principal) (price uint))
  (let (
    (liquidity-share (/ (* price u70) u100))
    (treasury-share (- price liquidity-share))
  )
    (begin
      (asserts! (is-eq tx-sender HOUSE-FRANCHISE) (err u401))
      (ft-transfer? candidate-coin amount HOUSE-FRANCHISE user)
      (try! (stx-transfer? liquidity-share user LIQUIDITY-POOL))
      (try! (stx-transfer? treasury-share user HOUSE-FRANCHISE))
      (ok true)
    )
  )
). 

;; Read-only functions
(define-read-only (get-balance (owner principal))
  (ok (ft-get-balance candidate-coin owner))
)

(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)
