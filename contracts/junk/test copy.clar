;; ---------------------------------------------------------
;; Constants
;; ---------------------------------------------------------
(define-constant MAXSUPPLY u10000000000000)
(define-constant ERR-UNAUTHORIZED u401)
(define-constant ERR-NOT-OWNER u402)
(define-constant ERR-INVALID-PARAMETERS u403)
 (use-trait ft-trait .sip010-ft-trait.sip010-ft-trait)
;;(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)
;; ---------------------------------------------------------
;; Fungible Token Definition
;; ---------------------------------------------------------
(define-fungible-token house MAXSUPPLY)
(define-data-var contract-owner principal tx-sender) 
(define-data-var token-uri (optional (string-utf8 256)) 
    (some u"https://www.dropbox.com/s/byhx1225xeopv4ptrkwzk/OrlO.json?raw=1"))

;; ---------------------------------------------------------
;; SIP-010 Standard Functions
;; ---------------------------------------------------------
(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq from tx-sender) (err ERR-UNAUTHORIZED))
    (ft-transfer? house amount from to)
  )
)

(define-read-only (get-balance (owner principal))
  (ok (ft-get-balance house owner))
)

(define-read-only (get-name) (ok "house"))
(define-read-only (get-symbol) (ok "house"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-total-supply) (ok (ft-get-supply house)))
(define-read-only (get-token-uri) (ok (var-get token-uri)))

;; ---------------------------------------------------------
;; Ownership
;; ---------------------------------------------------------
(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-OWNER))
    (asserts! (not (is-eq new-owner 'ST000000000000000000002AMW42H)) (err ERR-INVALID-PARAMETERS))
    (var-set contract-owner new-owner)
    (ok "Ownership transferred successfully")
  )
)

(define-public (set-token-uri (value (string-utf8 256)))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
    (var-set token-uri (some value))
    (ok "Token metadata updated")
  )
)

;; ---------------------------------------------------------
;; Batch Transfers
;; ---------------------------------------------------------
(define-public (send-many (recipients (list 200 { to: principal, amount: uint, memo: (optional (buff 34)) })))
  (fold check-err (map send-token recipients) (ok true))
)

(define-private (check-err (result (response bool uint)) (prior (response bool uint)))
  (match prior ok-value result err-value (err err-value))
)

(define-private (send-token (recipient { to: principal, amount: uint, memo: (optional (buff 34)) }))
  (let ((transferOk (try! (transfer (get amount recipient) tx-sender (get to recipient) (get memo recipient)))))
    (ok transferOk)
  )
)
