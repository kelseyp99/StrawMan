;;persons.clar 
;;stores the information needed to select ballots applicable to this person .  
;;i need to ber able to get this info to bring up a ballot.  and then save ballot responses to the blockchain 

;;below uncomment for Clarinet
 (impl-trait .sip009-nft-trait.sip009-nft-trait)
 (use-trait ft-trait .sip010-ft-trait.sip010-ft-trait)
;; below uncommented for mainnet
;;mainnet: SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait
;;(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
;;(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)
;; below uncommented for testnet
;;(use-trait ft-trait  'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)
;;(use-trait nft-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait)
;;(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)
;;(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait)

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))
(define-constant err-no-value (err u102))
(define-constant err-not-designated-utility-company (err u103))
(define-constant err-unauthorised (err u2001))
(define-constant err-payment-asset-mismatch (err u2004))
(define-constant err-payment-contract-not-whitelisted (err u2008))

;; contract variables
(define-non-fungible-token MyParcel uint)
(define-data-var last-id uint u0)
(define-constant IPFS_ROOT "https://ipfs.io/ipfs/")
(define-data-var person-info (map principal { precinct: (string-ascii 50), state: (string-ascii 50), country: (string-ascii 50), election-date: (string-ascii 50), ballot-id: uint }) )

;; Store voter information
(define-public (store-person-info (voter principal) (precinct (string-ascii 50)) (state (string-ascii 50)) (country (string-ascii 50)) (election-date (string-ascii 50)) (ballot-id uint))
  (begin
    ;; Storing voter data by principal (wallet address)
    (map-set person-info voter { precinct: precinct, state: state, country: country, election-date: election-date, ballot-id: ballot-id })
    (ok "Voter information stored successfully")
  )
)

;; Get the ballot information applicable to a person
(define-public (get-person-info (voter principal))
  (ok (map-get? person-info voter))
)

;; Store responses for a specific ballot
(define-data-var ballot-responses (map { voter: principal, ballot-id: uint } (list (tuple (office (string-ascii 50)) (choice (string-ascii 50))))) )

(define-public (submit-ballot-response (ballot-id uint) (responses (list (tuple (office (string-ascii 50)) (choice (string-ascii 50))))))
  (begin
    ;; Ensure the voter has not voted yet for this ballot
    (asserts! (is-none (map-get? ballot-responses { voter: tx-sender, ballot-id: ballot-id })) (err "Voter has already submitted a response for this ballot"))
    
    ;; Save the responses to the ballot
    (map-set ballot-responses { voter: tx-sender, ballot-id: ballot-id } responses)
    (ok "Ballot responses saved successfully")
  )
)

(define-data-var voter-info-map (map principal {voter-id: uint, precinct: (string-ascii 20), county: (string-ascii 20), state: (string-ascii 20)}))

(define-public (register-voter (voter-id uint) (precinct (string-ascii 20)) (county (string-ascii 20)) (state (string-ascii 20)))
  (begin
    (map-insert voter-info-map tx-sender {voter-id: voter-id, precinct: precinct, county: county, state: state})
    (ok true)
  )
)

(define-read-only (get-voter-info (voter principal))
  (map-get voter-info-map voter)
)

