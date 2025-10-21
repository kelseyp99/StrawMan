
;;  ---------------------------------------------------------
;; SIP-10 Fungible Token Contract | Created on: stx.city/deploy
;; ---------------------------------------------------------

;; house-token.clar
;; Fungible token contract to represent a share in profits for a specific election event

(define-fungible-token house-token)
(define-constant max-supply u100000) ;; Max supply of 100k tokens
(define-data-var total-supply uint u10000) ;; Initially minted 10k tokens
(define-data-var house-pool uint u0) ;; Profit pool for this FT contract

;; Only allow the main betting contract to send profits
(define-constant betting-contract tx-sender)

;; Errors 
(define-constant ERR-UNAUTHORIZED u401)
(define-constant ERR-NOT-OWNER u402)
(define-constant ERR-INVALID-PARAMETERS u403)
(define-constant ERR-NOT-ENOUGH-FUND u101)

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; Constants
(define-constant MAXSUPPLY u1000000000)

;; Variables
(define-fungible-token hsw MAXSUPPLY)
(define-data-var contract-owner principal tx-sender) 

;; SIP-10 Functions
(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-eq from tx-sender)
            (err ERR-UNAUTHORIZED))
        ;; Perform the token transfer
        (ft-transfer? hsw amount from to)
    )
)

;; DEFINE METADATA
(define-data-var token-uri (optional (string-utf8 256)) (some u"https://gaia.hiro.so/hub/1N4KbsPkdcV6XMrQKu6Zkv7J5Tq4TVUDoW/housewins-0-decimals.json"))

(define-public (set-token-uri (value (string-utf8 256)))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
        (var-set token-uri (some value))
        (ok (print {
              notification: "token-metadata-update",
              payload: {
                contract-id: (as-contract tx-sender),
                token-class: "ft"
              }
            })
        )
    )
)


(define-read-only (get-balance (owner principal))
  (ok (ft-get-balance hsw owner))
)
(define-read-only (get-name)
  (ok "HouseWins")
)

(define-read-only (get-symbol)
  (ok "hsw")
)

(define-read-only (get-decimals)
  (ok u0)
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply hsw))
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; transfer ownership
(define-public (transfer-ownership (new-owner principal))
  (begin
    ;; Checks if the sender is the current owner
    (if (is-eq tx-sender (var-get contract-owner))
      (begin
        ;; Sets the new owner
        (var-set contract-owner new-owner)
        ;; Returns success message
        (ok "Ownership transferred successfully"))
      ;; Error if the sender is not the owner
      (err ERR-NOT-OWNER)))
)


;; ---------------------------------------------------------
;; Utility Functions
;; ---------------------------------------------------------
(define-public (send-many (recipients (list 200 { to: principal, amount: uint, memo: (optional (buff 34)) })))
  (fold check-err (map send-token recipients) (ok true))
)

(define-private (check-err (result (response bool uint)) (prior (response bool uint)))
  (match prior ok-value result err-value (err err-value))
)

(define-private (send-token (recipient { to: principal, amount: uint, memo: (optional (buff 34)) }))
  (send-token-with-memo (get amount recipient) (get to recipient) (get memo recipient))
)

(define-private (send-token-with-memo (amount uint) (to principal) (memo (optional (buff 34))))
  (let ((transferOk (try! (transfer amount tx-sender to memo))))
    (ok transferOk)
  )
)

(define-private (send-stx (recipient principal) (amount uint))
  (begin
    (try! (stx-transfer? amount tx-sender recipient))
    (ok true) 
  )
)



;; Mint tokens to investors up to max supply
(define-public (mint (amount uint))
  (begin
    (asserts! (<= (+ (var-get total-supply) amount) max-supply) (err "Max supply exceeded"))
    (ft-mint? house-token amount tx-sender)
    (var-set total-supply (+ (var-get total-supply) amount))
    (ok amount)))

;; Receive profits from betting contract
(define-public (receive-profits (amount uint))
  (begin
    ;; Accumulate profits in house pool
    (var-set house-pool (+ (var-get house-pool) amount))
    (ok "Profits received")))

;; Distribute profits proportionally to all token holders
(define-public (distribute-dividends)
  (let ((total-tokens (var-get total-supply))
        (total-profits (var-get house-pool)))
    (asserts! (> total-tokens u0) (err "No tokens in circulation"))
    ;; Iterate over holders to calculate their share of the pool
    (foreach holder (ft-get-holders house-token)
      (let ((holder-balance (ft-get-balance house-token holder)))
        (let ((dividend (/ (* holder-balance total-profits) total-tokens)))
          (stx-transfer? dividend holder))))
    ;; Reset the house pool after distribution
    (var-set house-pool u0)
    (ok "Dividends distributed")))


(define-read-only (get-contract-stx-balance)
  (ok (stx-get-balance (as-contract tx-sender)))
)
