;;below uncomment for Clarinet
 (impl-trait .sip009-nft-trait.sip009-nft-trait)
 (use-trait ft-trait .sip010-ft-trait.sip010-ft-trait)
;; below uncommented for mainnet
;;mainnet: SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait
;;(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
;;(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)
;; below uncommented for testnet
;;(use-trait ft-trait  'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)
               ;;       ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard


;;(use-trait nft-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait)
;;                      ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait
;;(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)
;;(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait)
;;on compile if subnet = testnet then include impl-ft_trait, logo
;;on compile if subnet = mainnet then include use-ft_trait
;;on compile if subnet = Clarinet then include use-ft_trait
;;-- END DELETE ABOVE SECTION 
;;  SmartCities
;;  Bringing Blockchain Solutions to Local Government

;; Errors 
;;(define-constant ERR-UNAUTHORIZED u401)
(define-constant ERR-NOT-OWNER u402)
(define-constant ERR-INVALID-PARAMETERS u403)
(define-constant ERR-NOT-ENOUGH-FUND u101);; Error Codes
(define-constant ERR-NOT-WHITELISTED u100)
(define-constant ERR-INSUFFICIENT-FUNDS u101)
(define-constant ERR-INVALID-INPUT u102)
(define-constant ERR-UNAUTHORIZED u103)
(define-constant ERR-NOT-CANDIDATE u104)

(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)

;; Constants
(define-constant TREASURY-WALLET 'ST2BZ3RGBBTR8JD5V07PSSD9VN6WHAARN0R0Y2YWG)

;; Variables
(define-fungible-token house-franchise MAXSUPPLY)
(define-data-var contract-owner principal tx-sender) 

;; Data variables
(define-data-var total-supply uint u0)
(define-data-var fees-collected uint u0)
(define-data-var total-stx uint u0)
(define-data-var total-stx-direct uint u0)
(define-data-var total-stx-lp uint u0)
(define-data-var house-fee-cut uint u5)
(define-data-var total-coins-issued uint u0)
(define-data-var treasury-coins uint u0)
(define-data-var winnings-pool uint u0)
;; Constants
(define-constant MAXSUPPLY u10000000000000)

;; Maps
(define-map whitelisted-wallets principal bool)
(define-map token-balances principal uint)
(define-map token-prices principal uint)
(define-map candidates 
  {id: uint} 
  {tokens-issued: uint, treasury-coins: uint}
)
(define-map candidates-map 
  {id: uint} 
  {candidateName: (string-ascii 50), contractName: (string-ascii 50), contractAddress: principal, version: uint}
)



;; SIP-10 Functions
(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-eq from tx-sender) (err ERR-UNAUTHORIZED))
        (ft-transfer? house-franchise amount from to)
    )
)


;; DEFINE METADATA
(define-data-var token-uri (optional (string-utf8 256)) (some u"https://pdakhjpwkuwtadzmpnjm.supabase.co/storage/v1/object/public/uri/jkPweKzp-aaaaaaa-10-decimals.json"))

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
  (ok (ft-get-balance house-franchise owner))
)
(define-read-only (get-name)
  (ok "aaaaaaa")
)

(define-read-only (get-symbol)
  (ok "house-franchise")
)

(define-read-only (get-decimals)
  (ok u6)
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply house-franchise))
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

;; Add or Update Candidate
(define-public (add-or-update-candidate
  (id uint)
  (candidateName (string-ascii 50))
  (contractName (string-ascii 50))
  (contractAddress principal)
  (version uint)
)
  (begin
    ;;(asserts! (is-eq tx-sender TREASURY-WALLET) ERR-UNAUTHORIZED)
    (map-set candidates-map
      {id: id}
      {candidateName: candidateName, contractName: contractName, contractAddress: contractAddress, version: version}
    )
    (ok true)
  )
)

;;-- BEGIN DELETE SECTION --
;; this marks the begining of the sectin ath will be deleted emtrily by the compiler

