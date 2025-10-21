;;below uncomment for Clarinet
;; (impl-trait .sip009-nft-trait.sip009-nft-trait)
;; (use-trait ft-trait .sip010-ft-trait.sip010-ft-trait)
;; below uncommented for mainnet
;;mainnet: SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait
;;(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
;;(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)
;; below uncommented for testnet
;;(use-trait ft-trait  'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)
(use-trait nft-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait)
;;(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)
(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait)

;; Contract starts here
(define-data-var persons (map principal {ballot-votes: (optional (tuple (vote-for-1 int) (vote-for-2 int))),
                                        owned-nfts: (list 10 uint)}))

;; Function to initialize a person with empty ballot votes and NFT collection
(define-public (initialize-person (person principal))
  (begin
    (map-insert persons person {ballot-votes: none, owned-nfts: (list)})
    (ok "Person initialized")
  )
)

;; Function to store ballot votes for a person
(define-public (cast-vote (person principal) (vote-for-1 int) (vote-for-2 int))
  (match (map-get persons person)
    person-data
    (begin
      (map-set persons person (merge person-data {ballot-votes: (some {vote-for-1: vote-for-1, vote-for-2: vote-for-2})}))
      (ok "Vote cast")
    )
    (err "Person not found")
  )
)

;; Function to add an NFT to a person's collection
(define-public (add-nft (person principal) (nft-id uint))
  (match (map-get persons person)
    person-data
    (let ((owned-nfts (get owned-nfts person-data)))
      (if (< (len owned-nfts) 10)
          (begin
            (map-set persons person (merge person-data {owned-nfts: (append owned-nfts nft-id)}))
            (ok "NFT added")
          )
          (err "NFT collection limit reached")
      )
    )
    (err "Person not found")
  )
)

;; Function to retrieve a person's information
(define-read-only (get-person (person principal))
  (map-get persons person)
)


(define-map person-nfts
  { person-id: (string-ascii 32) }
  { owner: principal })

(define-public (mint-nft (person-id (string-ascii 32)) (owner principal))
  (begin
    (if (is-none (map-get? person-nfts { person-id: person-id }))
      (map-set person-nfts { person-id: person-id } { owner: owner })
      (err u100))  
    (ok u1)))
