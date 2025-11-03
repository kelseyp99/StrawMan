;; ElectionBettingSystem.clar
;; A Clarity smart contract for a multi-round election betting system with house tokens for profits

;; Dynamic map to track candidate tokens per event
(define-map candidate-tokens
  {event-id: uint, candidate-name: (string-ascii 20)}
  {token-contract: principal})

;; Maps to store token holdings and total stakes for each candidate
(define-map tokens-held
  {bettor: principal, event-id: uint, candidate-name: (string-ascii 20)}
  uint)
(define-map candidate-stakes
  {event-id: uint, candidate-name: (string-ascii 20)}
  uint)

;; House token for profit-sharing
(define-fungible-token house-token)
(define-data-var house-pool uint u0)
(define-data-var total-house-supply uint u100000) ;; Example max supply

;; Create a new election event and register candidate tokens
(define-public (create-election (event-id uint) (candidate-list (list 10 (string-ascii 20))))
  (begin
    (map each candidate-name candidate-list
      (let ((token-name (as-contract (ft-create? candidate-name))))
        (map-set candidate-tokens {event-id: event-id, candidate-name: candidate-name} {token-contract: token-name})))
    (ok "Election created"))
)

;; Place a bet (buy tokens) for a specific candidate in an event
(define-public (place-bet (event-id uint) (candidate-name (string-ascii 20)) (amount uint))
  (begin
    ;; Increase user's holdings and candidate's total stake
    (let ((current-holdings (default-to u0 (map-get? tokens-held {bettor: tx-sender, event-id: event-id, candidate-name: candidate-name}))))
      (map-set tokens-held {bettor: tx-sender, event-id: event-id, candidate-name: candidate-name} (+ current-holdings amount)))
    (let ((current-stake (default-to u0 (map-get? candidate-stakes {event-id: event-id, candidate-name: candidate-name}))))
      (map-set candidate-stakes {event-id: event-id, candidate-name: candidate-name} (+ current-stake amount)))

    ;; Mint tokens for the candidate and transfer to bettor
    (ft-mint? candidate-name amount tx-sender)
    (ok "Bet placed"))
)

;; Eliminate a candidate in an event and redistribute half of their pool to another candidate
(define-public (eliminate-candidate (event-id uint) (loser-name (string-ascii 20)) (winner-name (string-ascii 20)))
  (begin
    (let ((loser-stake (default-to u0 (map-get? candidate-stakes {event-id: event-id, candidate-name: loser-name}))))
      (if (is-eq loser-stake u0)
          (err "Candidate has no stakes")
          (let ((half-pool (/ loser-stake u2)))
            ;; Distribute half of the loser pool to winning bettors
            (let ((winner-stake (default-to u0 (map-get? candidate-stakes {event-id: event-id, candidate-name: winner-name}))))
              (foreach (bet (map-filter tokens-held (lambda (key value)
                                                       (and (is-eq (get candidate-name key) winner-name)
                                                            (is-eq (get event-id key) event-id)))))
                (let ((bettor (get bettor bet))
                      (bet-amount (get (tuple bettor bet) tokens-held))
                      (reward (/ (* bet-amount half-pool) winner-stake)))
                  (stx-transfer? reward bettor)))
              ;; Burn the losing candidate's tokens
              (ft-burn? loser-name loser-stake)
              ;; Update house pool for remaining profits
              (var-set house-pool (+ (var-get house-pool) half-pool))
              (ok "Candidate eliminated and funds redistributed")))))
)

;; Final election resolution for an event, distributing winnings to final winner’s bettors
(define-public (resolve-election (event-id uint) (winner-name (string-ascii 20)))
  (begin
    (let ((winner-stake (default-to u0 (map-get? candidate-stakes {event-id: event-id, candidate-name: winner-name}))))
      (if (is-eq winner-stake u0)
          (err "Winner has no stakes")
          (foreach (bet (map-filter tokens-held (lambda (key value)
                                                  (and (is-eq (get candidate-name key) winner-name)
                                                       (is-eq (get event-id key) event-id)))))
            (let ((bettor (get bettor bet))
                  (bet-amount (get (tuple bettor bet) tokens-held))
                  (payout (* bet-amount winner-stake)))
              (stx-transfer? payout bettor)))
          (var-set house-pool (+ (var-get house-pool) winner-stake))
          (ok "Election resolved, winnings distributed"))))
)

;; Distribute dividends from the house pool to all house-token holders
(define-public (distribute-house-dividends)
  (let ((total-supply (var-get total-house-supply))
        (total-profits (var-get house-pool)))
    (asserts! (> total-supply u0) (err "No house tokens in circulation"))
    ;; Iterate over house-token holders to calculate and transfer their dividend share
    (foreach holder (ft-get-holders house-token)
      (let ((holder-balance (ft-get-balance house-token holder)))
        (let ((dividend (/ (* holder-balance total-profits) total-supply)))
          (stx-transfer? dividend holder))))
    ;; Reset the house pool after distribution
    (var-set house-pool u0)
    (ok "Dividends distributed to house-token holders")))
)

;; Helper function to fetch candidate stake
(define-public (get-candidate-stake (event-id uint) (candidate-name (string-ascii 20)))
  (ok (default-to u0 (map-get? candidate-stakes {event-id: event-id, candidate-name: candidate-name})))
)

;; Helper function to fetch bettor holdings for a specific candidate in an event
(define-public (get-bettor-holdings (bettor principal) (event-id uint) (candidate-name (string-ascii 20)))
  (ok (default-to u0 (map-get? tokens-held {bettor: bettor, event-id: event-id, candidate-name: candidate-name})))
)
