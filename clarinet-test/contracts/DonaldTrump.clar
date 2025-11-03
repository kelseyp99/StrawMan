;;  ---------------------------------------------------------
;; SIP-10 Fungible Token Contract | Created on: stx.city/deploy
;; ---------------------------------------------------------

;; Errors 
(define-constant ERR-UNAUTHORIZED u401)
(define-constant ERR-NOT-OWNER u402)
(define-constant ERR-INVALID-PARAMETERS u403)
(define-constant ERR-NOT-ENOUGH-FUND u101)

(use-trait ft-trait .sip010-ft-trait.sip010-ft-trait)
;;(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)
;;(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-constant housewins-contract 'STDTR40QBV3E3G8SNHH1KX9H9A4MZKGDD6Z188AS.houseFranchise)

;; Constants
(define-constant MAXSUPPLY u1000000000)

;; Variables
(define-fungible-token dt24 MAXSUPPLY)
(define-data-var contract-owner principal tx-sender) 
(define-data-var max-weekly-sale uint u10000) ;; Maximum tokens that can be sold each week
(define-data-var weekly-sold uint u0) ;; Tokens sold in the current week
(define-data-var last-sale-reset uint u0) ;; Timestamp of the last weekly reset



;; SIP-10 Functions
(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-eq from tx-sender)
            (err ERR-UNAUTHORIZED))
        ;; Perform the token transfer
        (ft-transfer? dt24 amount from to)
    )
)


;; DEFINE METADATA
(define-data-var token-uri (optional (string-utf8 256)) (some u"https://gaia.hiro.so/hub/1N4KbsPkdcV6XMrQKu6Zkv7J5Tq4TVUDoW/donald-trump-2024-0-decimals.json"))

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
  (ok (ft-get-balance dt24 owner))
)
(define-read-only (get-name)
  (ok "Donald Trump 2024")
)

(define-read-only (get-symbol)
  (ok "dt24")
)

(define-read-only (get-decimals)
  (ok u0)
)

;;returns the number of token issued less burned tokens
(define-read-only (get-total-supply)
  (ok (ft-get-supply dt24))
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

(define-public (buy-token (amount uint))
  (begin
    ;; Handle token minting/purchase logic here
    (asserts! (<= amount (ft-get-supply mytoken)) (err "Not enough tokens available"))
    (ft-transfer? mytoken amount tx-sender housewins-contract)
    (ok "Token purchased and proceeds sent to housewins"))
)

;;Add a private function to reset the weekly sales counter at the start of a new week:
;;This function resets the weekly-sold counter if more than a week (about 1008 blocks) has passed since the last reset.;;
(define-private (reset-weekly-sales)
  (let ((current-block-time (as-max-lifetime (block-height))))
    (if (> (- current-block-time (var-get last-sale-reset)) u1008) ;; ~7 days assuming ~10-minute blocks
      (begin
        (var-set weekly-sold u0)
        (var-set last-sale-reset current-block-time))
      (ok true))))

;;Modify your sale function to ensure the weekly limit is respected:
(define-public (sell-tokens (amount uint) (buyer principal))
  (begin
    ;; Reset weekly sales if needed
    (try! (reset-weekly-sales))
    ;; Check if the sale exceeds the weekly limit
    (asserts! (<= (+ amount (var-get weekly-sold)) (var-get max-weekly-sale))
              (err u1001)) ;; Custom error for exceeding weekly limit
    ;; Update the weekly sales counter
    (var-set weekly-sold (+ (var-get weekly-sold) amount))
    ;; Transfer the tokens to the buyer
    (ft-transfer? candidate-token amount tx-sender buyer)
    (ok "Tokens sold successfully")))

;;Optionally, you can provide a method to adjust the max-weekly-sale limit. This can be restricted to the contract owner:
(define-public (update-weekly-limit (new-limit uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err u401)) ;; Ensure only owner can update
    (var-set max-weekly-sale new-limit)
    (ok "Weekly limit updated")))
;;    5. Test Scenarios
;;Initial Setup: Set the initial max-weekly-sale and ensure it is enforced correctly.
;;Mid-Week Sale: Test to confirm that sales exceeding the limit within the week are rejected.
;;New Week Reset: Simulate a new week to ensure the reset mechanism works as expected.
;;Limit Adjustment: Test updating the weekly limit and verify it takes effect.
