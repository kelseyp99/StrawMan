;; house-token.clar

;; Fungible token contract to represent a share in profits for a specific election event

(define-fungible-token house-token u1000000000)
(define-data-var total-supply uint u10000) ;; Initially minted 10k tokens
(define-data-var house-pool uint u0) ;; Profit pool for this FT contract

;; Only allow the main betting contract to send profits
(define-constant betting-contract tx-sender)

;; Errors
(define-constant ERR-UNAUTHORIZED u401)
(define-constant ERR-NOT-OWNER u402)
(define-constant ERR-INVALID-PARAMETERS u403)
(define-constant ERR-NOT-ENOUGH-FUND u101)

;; Variables
(define-data-var contract-owner principal tx-sender)

;; SIP-010 Functions (manually implemented)
(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq from tx-sender)
      (err ERR-UNAUTHORIZED))
    (try! (ft-transfer? house-token amount from to))
    (print memo)
    (ok true)
  )
)

(define-public (get-name)
  (ok "HouseToken")
)

(define-public (get-symbol)
  (ok "HOUSE")
)

(define-public (get-decimals)
  (ok u0)
)

(define-public (get-balance (owner principal))
  (ok (ft-get-balance house-token owner))
)

(define-public (get-total-supply)
  (ok (var-get total-supply))
)

(define-data-var token-uri (optional (string-utf8 256)) (some u"https://gaia.hiro.so/hub/1N4KbsPkdcV6XMrQKu6Zkv7J5Tq4TVUDoW/housewins-0-decimals.json"))

(define-public (get-token-uri)
  (ok (var-get token-uri))
)

(define-public (set-token-uri (value (string-utf8 256)))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-OWNER))
    (var-set token-uri (some value))
    (ok true)
  )
)

;; Mint tokens to investors up to max supply
(define-public (mint (amount uint))
  (begin
    (asserts! (<= (+ (var-get total-supply) amount) u100000) (err ERR-INVALID-PARAMETERS))
    (try! (ft-mint? house-token amount tx-sender))
    (var-set total-supply (+ (var-get total-supply) amount))
    (ok amount)))

;; Receive profits from betting contract
(define-public (receive-profits (amount uint))
  (begin
    ;; Accumulate profits in house pool
    (var-set house-pool (+ (var-get house-pool) amount))
    (ok "Profits received")))
