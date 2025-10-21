

;; Allows a user to vote on a ballot by providing their wallet, voter ID, ballot ID, and answers.
;; Stores each vote along with metadata about the voter.
;; Provides a read-only function to summarize results.
;; person.clar:

;; Stores voter demographics, such as precinct, county, and state.
;; Provides read-only functions for retrieving demographic information.

;; Key Points:
;; Voting Logic:

;; Checks if the user has already voted for the specified ballot-id to prevent duplicate votes.
;; Records the user's wallet, voter ID, ballot ID, and their answers in a list.
;; Result Storage:

;; Stores aggregated results by ballot-id using the results map.
;; The answers field is flexible to handle multiple-choice responses or free text.
;; Integration with person.clar:

;; Uses the contract-call? function to query voter demographic information (precinct, county, state) for each vote.
;; Read-only Queries:

;; get-results: Returns the raw results for a specific ballot ID.
;; get-summary: Returns demographic data about voters for a specific ballot, querying the person.clar contract.

;;below uncomment for Clarinet
;; (impl-trait .sip009-nft-trait.sip009-nft-trait)
;; (use-trait ft-trait .sip010-ft-trait.sip010-ft-trait)
;; below uncommented for mainnet
;;mainnet: SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait
;;(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
;;(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)
;; below uncommented for testnet
(use-trait ft-trait  'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)
(use-trait nft-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait)
;;(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)
(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait)

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))
(define-constant err-no-value (err u102))
(define-constant err-not-designated-utility-company (err u103))
(define-constant err-unauthorised (err u2001))
(define-constant err-payment-asset-mismatch (err u2004))
(define-constant err-payment-contract-not-whitelisted (err u2008))

;; Define a variable to store votes
(define-data-var votes (list 200 {wallet: principal, voter-id: uint, ballot-id: uint, answers: (string-ascii 200)}))

;; Define a variable to store aggregated results by ballot ID
(define-data-var results (map uint (map uint uint))) ;; {ballot-id -> {question-id -> vote-count}}

;; Function to allow users to vote on a ballot
(define-public (vote (voter-id uint) (ballot-id uint) (answers (string-ascii 200)))
  (let (
    ;; Ensure the voter hasn't already voted
    (already-voted 
      (is-some (list-find (lambda (vote)
                             (and (is-eq (get wallet vote) tx-sender)
                                  (is-eq (get ballot-id vote) ballot-id)))
                           (var-get votes))))
  )
    (if already-voted
        (err u100) ;; Error if the voter already voted
        (begin
          ;; Add the vote to the list
          (var-set votes (cons {wallet: tx-sender, voter-id: voter-id, ballot-id: ballot-id, answers: answers} (var-get votes)))
          (ok true)
        )
    )
  )
)

;; Function to query results by ballot ID
(define-read-only (get-results (ballot-id uint))
  (map-get? results ballot-id)
)

;; Function to summarize votes with demographics from `person.clar`
(define-read-only (get-summary (ballot-id uint))
  (let (
    (votes-for-ballot 
      (list-filter (lambda (vote) (is-eq (get ballot-id vote) ballot-id)) (var-get votes)))
  )
    ;; Collect summaries of demographics by querying person.clar
    (map 
      (lambda (vote)
        (ok (contract-call? .person get-voter-info (get wallet vote)))
      )
      votes-for-ballot
    )
  )
)
