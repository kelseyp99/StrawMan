;; sip010-token
;; A SIP010-compliant fungible token with a mint function.

;; TRAIT DEFINITIONS

;;(impl-trait .citycoin-trait.citycoin-token)
(use-trait coreTrait .citycoin-core-trait.citycoin-core)

;; ERROR CODES

(define-constant ERR_UNAUTHORIZED u2000)
(define-constant ERR_TOKEN_NOT_ACTIVATED u2001)
(define-constant ERR_TOKEN_ALREADY_ACTIVATED u2002)

;; SIP-010 DEFINITION

;;(impl-trait .sip010-ft-trait.sip010-ft-trait)
;; SIP010 trait on testnet
(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)
;; SIP010 trait on mainnet
;; (impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-constant contract-owner tx-sender)

(define-fungible-token OrlOcoin u100000000)

(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u102))


;; DEFINE METADATA
(define-data-var token-uri (optional (string-utf8 256)) (some u"https://gaia.hiro.so/hub/1N4KbsPkdcV6XMrQKu6Zkv7J5Tq4TVUDoW/city-of-orlandoorange-county-0-decimals.json"))

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


;; #[allow(unchecked_data)]
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
	(begin
		(asserts! (is-eq tx-sender sender) err-owner-only)
		(try! (ft-transfer? OrlOcoin amount sender recipient))
		(match memo to-print (print to-print) 0x)
		(ok true)
	)
)

(define-read-only (get-name)
	(ok "OrlandoOrangeCoin")
)

(define-read-only (get-symbol)
	(ok "OrlO")
)

(define-read-only (get-decimals)
	(ok u6)
)

(define-read-only (get-balance (who principal))
	(ok (ft-get-balance OrlOcoin who))
)

(define-read-only (get-total-supply)
	(ok (ft-get-supply OrlOcoin))
)

(define-read-only (get-token-uri)
	(ok none)
)

;; #[allow(unchecked_data)]
(define-public (mint (amount uint) (recipient principal))
	(begin
		(asserts! (is-eq tx-sender contract-owner) err-owner-only)
		(ft-mint? OrlOcoin amount recipient)
	)
)

;;need to implement these
;;https://github.com/citycoins/contracts/blob/develop/contracts/cities/mia/local/miamicoin-token.clar#L29
;;https://github.com/citycoins/contracts/blob/develop/contracts/base/local/citycoin-core-trait.clar

;; TOKEN CONFIGURATION

;; how many blocks until the next halving occurs
(define-constant TOKEN_HALVING_BLOCKS u210000)

;; store block height at each halving, set by register-user in core contract 
(define-data-var coinbaseThreshold1 uint u0)
(define-data-var coinbaseThreshold2 uint u0)
(define-data-var coinbaseThreshold3 uint u0)
(define-data-var coinbaseThreshold4 uint u0)
(define-data-var coinbaseThreshold5 uint u0)

;; once activated, thresholds cannot be updated again
(define-data-var tokenActivated bool false)

;; core contract states
(define-constant STATE_DEPLOYED u0)
(define-constant STATE_ACTIVE u1)
(define-constant STATE_INACTIVE u2)

;; one-time function to activate the token
;; #[allow(unchecked_data)]
(define-public (activate-token (coreContract principal) (stacksHeight uint))
;;  (let
 ;;   (
 ;;     (coreContractMap (try! (contract-call? .miamicoin-auth get-core-contract-info coreContract)))
 ;;   )
 ;;   (asserts! (is-eq (get state coreContractMap) STATE_ACTIVE) (err ERR_UNAUTHORIZED))
 ;;   (asserts! (not (var-get tokenActivated)) (err ERR_TOKEN_ALREADY_ACTIVATED))
 ;;   (var-set tokenActivated true)
 ;;   (var-set coinbaseThreshold1 (+ stacksHeight TOKEN_HALVING_BLOCKS))
 ;;   (var-set coinbaseThreshold2 (+ stacksHeight (* u2 TOKEN_HALVING_BLOCKS)))
 ;;   (var-set coinbaseThreshold3 (+ stacksHeight (* u3 TOKEN_HALVING_BLOCKS)))
 ;;   (var-set coinbaseThreshold4 (+ stacksHeight (* u4 TOKEN_HALVING_BLOCKS)))
;;    (var-set coinbaseThreshold5 (+ stacksHeight (* u5 TOKEN_HALVING_BLOCKS)))
    (ok true)
;;  )
)

;; return coinbase thresholds if token activated
(define-read-only (get-coinbase-thresholds)
  (let
    (
      (activated (var-get tokenActivated))
    )
    (asserts! activated (err ERR_TOKEN_NOT_ACTIVATED))
    (ok {
      coinbaseThreshold1: (var-get coinbaseThreshold1),
      coinbaseThreshold2: (var-get coinbaseThreshold2),
      coinbaseThreshold3: (var-get coinbaseThreshold3),
      coinbaseThreshold4: (var-get coinbaseThreshold4),
      coinbaseThreshold5: (var-get coinbaseThreshold5)
    })
  )
)

;; UTILITIES

(define-data-var tokenUri (optional (string-utf8 256)) (some u"https://cdn.citycoins.co/metadata/miamicoin.json"))

;; set token URI to new value, only accessible by Auth
;; #[allow(unchecked_data)]
(define-public (set-token-uri (newUri (optional (string-utf8 256))))
  (begin
    (asserts! (is-authorized-auth) (err ERR_UNAUTHORIZED))
    (ok (var-set tokenUri newUri))
  )
)

;; mint new tokens, only accessible by a Core contract
;;(define-public (mint (amount uint) (recipient principal))
 ;; (let
 ;;   (
 ;;     (coreContract (try! (contract-call? .miamicoin-auth get-core-contract-info contract-caller)))
 ;;   )
 ;;   (ft-mint? miamicoin amount recipient)
 ;; )
;;)

;; burn tokens, only accessible by a Core contract
(define-public (burn (amount uint) (recipient principal))
;;  (let
 ;;   (
 ;;     (coreContract (try! (contract-call? .miamicoin-auth get-core-contract-info contract-caller)))
 ;;   )
 ;;   (ft-burn? miamicoin amount recipient)
 ;; )
 (ok false)
)

;; checks if caller is Auth contract
(define-private (is-authorized-auth)
  (is-eq contract-caller .miamicoin-auth)
)

;; SEND-MANY

(define-public (send-many (recipients (list 200 { to: principal, amount: uint, memo: (optional (buff 34)) })))
  (fold check-err
    (map send-token recipients)
    (ok true)
  )
)

(define-private (check-err (result (response bool uint)) (prior (response bool uint)))
  (match prior ok-value result
               err-value (err err-value)
  )
)

(define-private (send-token (recipient { to: principal, amount: uint, memo: (optional (buff 34)) }))
  (send-token-with-memo (get amount recipient) (get to recipient) (get memo recipient))
)

(define-private (send-token-with-memo (amount uint) (to principal) (memo (optional (buff 34))))
  (let
    (
      (transferOk (try! (transfer amount tx-sender to memo)))
    )
    (ok transferOk)
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; TESTING FUNCTIONS
;; DELETE BEFORE DEPLOYING TO MAINNET
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant DEPLOYED_AT block-height)

(define-private (is-test-env)
  (<= DEPLOYED_AT u5)
)

;;(define-public (test-mint (amount uint) (recipient principal))
;;  (begin
;;    (asserts! (is-test-env) (err ERR_UNAUTHORIZED))
;;    (ft-mint? OrlOcoin amount recipient)
;;  )
