(use-trait ft-trait .sip-010-ft-standard)

(define-map candidate-details
  { candidate-id: uint }
  {
    token-name: (string-ascii 32),
    token-symbol: (string-ascii 10),
    active: bool
  })

(define-map candidate-supply
  { candidate-id: uint }
  { total-supply: uint })

(define-data-var next-candidate-id uint 1)

(define-public (create-candidate (name (string-ascii 32)) (symbol (string-ascii 10)) (initial-supply uint))
  (begin
    ;; Generate a candidate ID
    (let ((candidate-id (var-get next-candidate-id)))
      ;; Ensure name and symbol are unique
      (asserts! (not (map-get? candidate-details { candidate-id: candidate-id })) (err u100))
      
      ;; Register the candidate details
      (map-set candidate-details
        { candidate-id: candidate-id }
        { token-name: name, token-symbol: symbol, active: true })

      ;; Initialize candidate token supply
      (map-set candidate-supply
        { candidate-id: candidate-id }
        { total-supply: initial-supply })

      ;; Mint the initial supply to the contract deployer's wallet
      (ok (ft-mint (ft-trait) name symbol candidate-id initial-supply tx-sender))

      ;; Increment the candidate ID for the next creation
      (var-set next-candidate-id (+ candidate-id u1))
      (ok candidate-id))))

(define-public (deactivate-candidate (candidate-id uint))
  (begin
    ;; Ensure the candidate exists
    (asserts! (map-get? candidate-details { candidate-id: candidate-id }) (err u101))
    
    ;; Set the candidate as inactive
    (map-set candidate-details
      { candidate-id: candidate-id }
      (merge { active: false } (unwrap-panic (map-get candidate-details { candidate-id: candidate-id }))))
    (ok true)))

(define-read-only (get-candidate-details (candidate-id uint))
  (match (map-get candidate-details { candidate-id: candidate-id })
    some-details
    (ok some-details)
    (err u102)))

(define-read-only (get-total-supply (candidate-id uint))
  (match (map-get candidate-supply { candidate-id: candidate-id })
    { total-supply: total-supply }
    (ok total-supply)
    (err u103)))

(impl-trait .sip-010-ft-standard)

(define-ft-interface ft-trait
  ;; Mint tokens to a recipient
  (ft-mint (ft-trait) (name (string-ascii 32)) (symbol (string-ascii 10)) (candidate-id uint) (amount uint) (recipient principal))
  ;; Transfer tokens between principals
  (ft-transfer (ft-trait) (candidate-id uint) (amount uint) (sender principal) (recipient principal))
  ;; Get total supply
  (get-total-supply (candidate-id uint) (returns uint))
)
