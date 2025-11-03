;; test-contract.clar
(use-trait testable 'test-trait)
(define-public (foo (x uint))
  (ok true)
)
