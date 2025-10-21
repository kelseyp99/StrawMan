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
;;on compile if subnet = testnet then include use-ft_trait, impl_trait_nft, logo
;;on compile if subnet = mainnet then include use-ft_trait, impl_trait_nft
;;on compile if subnet = Clarinet then include use-ft_trait, impl_trait_nft
;;-- END DELETE ABOVE SECTION --

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

;;list of global parameters
(define-map parameters (string-ascii 256) {val-string: (string-ascii 256), val-number: uint})
(define-map parameters-b (string-ascii 256) bool)
(define-map parameters-p (string-ascii 256) principal)
(define-map parameters-s-by-token {parameter-name: (string-ascii 256), token-number: uint} (string-ascii 256))
(define-map parameters-n-by-token {parameter-name: (string-ascii 256), token-number: uint} uint)
(define-map parameters-b-by-token {parameter-name: (string-ascii 256), token-number: uint} bool)
(define-map parameters-p-by-token {parameter-name: (string-ascii 256), token-number: uint} principal)

;; data structures
(define-map nft-data uint (string-ascii 256))
(define-map parcel-numbers uint (string-ascii 256))
(define-map situs-addresses uint (string-ascii 256))
(define-map legal-descriptions uint (string-ascii 256))
(define-map GIS-coordinates uint (string-ascii 256))
(define-map KYC-Owner-Names uint (string-ascii 256))
(define-map nft-data2 {nft-index: uint} {asset-hash: (buff 32), PID: (buff 32), legal-description: (buff 200), situs_address: (buff 200), meta-data-url: (buff 200), max-editions: uint, edition: uint, edition-cost: uint, mint-block-height: uint, series-original: uint})

;;these maps create a linked-list accross contracts of each token specific to a single parcel
(define-map parent-token-addresses uint {contract_address: principal, contract_name: (string-ascii 256), token_ID: uint})
(define-map child-token-addresses uint {contract_address: principal, contract_name: (string-ascii 256), token_ID: uint})

;;these maps hold the names of each jurisdiction for each tax type and the wallet this type of tax is to be deposited into
(define-map payees uint {wallet-owner-name: (string-ascii 256), wallet-address: principal, tax-rate-percent: uint}) ;;(optional tax-rate-percent: uint)
(define-map payee-token {token-number: uint, payee-type: (string-ascii 256)} uint) 
(define-map payee-jurisdiction-summary {pper: uint, dealer: (string-ascii 256), payee-type: (string-ascii 256), tax-type: (string-ascii 256), jurisdiction: (string-ascii 256)} uint) 

;;these are the total amounts due that must be paid in full
(define-map utility-bills uint {amt-due-electric: uint, amt-due-water: uint, amt-due-natural-gas: uint, amt-due-propane: uint, sales-tax: uint, GRT: uint, MUT: uint, surtax: uint, franchise: uint, pper: uint})
;;track the currency on deposit by token number for both STX and OrlO
(define-map deposited-funds uint uint)
(define-map deposited-funds-ft {token-number : uint, asset : (string-ascii 256)}  uint)
(define-map whitelisted-asset-contracts principal bool)

;; Claim a new NFT
(define-private (mint (new-owner principal))
    (let ((next-id (+ u1 (var-get last-id))))
	  (asserts! (is-eq tx-sender contract-owner) err-owner-only)
      (var-set last-id next-id)
      (try! (nft-mint? MyParcel next-id new-owner))
	 ;; (asserts! (var-set token-id-nonce token-id) err-token-id-failure)
	  (ok next-id))
    )

(define-public (claim)
  (mint tx-sender))
  ;; #[allow(unchecked_data)]
(define-public (claim-and-save-all-data 
   (situs-address (string-ascii 256))
   (parcel-number (string-ascii 256))
   (legal-description (string-ascii 256))
   (GIS-coordinate (string-ascii 256))
   (meta-data-url (string-ascii 256))
   (parent-contract-address principal)
   (parent-contract-name (string-ascii 256))
   (parent_token_num uint)
   (electric-utility-name (string-ascii 100))
   (water-utility-name (string-ascii 100))
   (natural-gas-provider-name (string-ascii 100))
   (propane-provider-name (string-ascii 100))
   (State (string-ascii 100))
   (County (string-ascii 100))
   (taxing-jurisdiction (string-ascii 100)))
    (begin
      (try! (claim))      
      (map-insert nft-data (var-get last-id) meta-data-url) 
      (map-insert parcel-numbers (var-get last-id) parcel-number) 
      (map-insert situs-addresses (var-get last-id) situs-address) 
      (map-insert legal-descriptions (var-get last-id) legal-description) 
      (map-insert GIS-coordinates (var-get last-id) GIS-coordinate) 
      (map-insert parent-token-addresses (var-get last-id) {contract_address: parent-contract-address, contract_name: parent-contract-name, token_ID: parent_token_num})
      (assign-payee (var-get last-id) electric-utility-name "electric")
      (assign-payee (var-get last-id) water-utility-name "water")
      (assign-payee (var-get last-id) natural-gas-provider-name "natural-gas")
      (assign-payee (var-get last-id) propane-provider-name "propane")
      (assign-payee (var-get last-id) State "State")
      (assign-payee (var-get last-id) County "County")
      (assign-payee (var-get last-id) taxing-jurisdiction "taxing-jurisdiction")
      (ok (var-get last-id))))
;;;;#[fileter(id, receiver)]
;; SIP009: Transfer token to a specified principal
;; #[allow(unchecked_data)]
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
     (asserts! (is-eq tx-sender sender) (err u403))
     (nft-transfer? MyParcel token-id sender recipient)))

;; Transfer from the sender to a new principal
 ;;   (transfer (uint principal principal) (response bool uint))



(define-public (transfer-memo (token-id uint) (sender principal) (recipient principal) (memo (buff 34)))
  (begin 
    (try! (transfer token-id sender recipient))
    (print memo)
    (ok true)))

;;*********************************************************************
;;
;;        Setters
;;
;;************************set-parameter-value++*********************************************
;;Sets parameter value in parameter table
(define-private (set-parameter (param-name (string-ascii 256)) (val-string  (string-ascii 256)) (val-number uint) ) 
    (map-set parameters param-name {val-string: val-string, val-number: val-number }))
(define-private (set-parameter-string (param-name (string-ascii 256)) (val-string  (string-ascii 256))) 
   (map-set parameters param-name {val-string: val-string, val-number: u0 }))
(define-private (set-parameter-value (param-name (string-ascii 256)) (val-number uint) ) 
    (map-set parameters param-name {val-string: "na", val-number: val-number }))
(define-private (set-parameter-b (param-name (string-ascii 256)) (val-bool  bool))
    (map-set parameters-b param-name val-bool))
(define-private (set-parameter-p (param-name (string-ascii 256)) (val-principal  bool))
    (map-set parameters-b param-name val-principal))
(define-private (set-parameters-n-by-token (param-name (string-ascii 256))  (token-number uint) (val-number uint))
    (map-set parameters-n-by-token {parameter-name: param-name,  token-number: token-number} val-number))
(define-private (set-parameters-b-by-token (param-name (string-ascii 256))  (token-number uint) (val-bool  bool))
    (map-set parameters-b-by-token {parameter-name: param-name,  token-number: token-number} val-bool))

;;set uri tools
;; #[allow(unchecked_data)]
(define-public (set-token-uri (nftIndex uint) (meta-data-url (string-ascii 256)))
   (begin
      (map-set nft-data nftIndex meta-data-url)
      (ok true)))
      
;; #[allow(unchecked_data)]
(define-public (set-token-uri-for-last-tokenID (meta-data-url (string-ascii 256)))
   (begin
      (map-set nft-data (var-get last-id) meta-data-url)
      (ok true)))

;;linked-list maintainer
;; #[allow(unchecked_data)]
(define-public (set-child-token-address (contract_address principal) (contract_name (string-ascii 256)) (token_ID_Child uint) (token_ID uint))
   (begin
      ;;(map-set orders u0 {maker: tx-sender, amount: u50})
      (map-set child-token-addresses token_ID_Child {contract_address: contract_address, contract_name: contract_name, token_ID: token_ID})
      (ok true)))
       
;;set or change the payee that will receive PST for this NFT
;; #[allow(unchecked_data)]
(define-public (set-MUT-jurisdiction (token_Id uint) (jurisdiction_name (string-ascii 256)))
   (begin
      (assign-payee token_Id jurisdiction_name "taxing-jurisdiction")
      (ok true)))

;; #[allow(unchecked_data)]
(define-public (set-USDSTX (market uint)) 
;;this set in cents to preserve the significant figures 
    (ok (set-parameter-value "USDSTX" market)) 
)     

;; #[allow(unchecked_data)]
(define-public (set-USDOrlO (market uint)) 
;;this set in cents to preserve the significant figures 
    (ok (set-parameter-value "USDOrlO" market)) 
) 

;; #[allow(unchecked_data)]
(define-public (set-recieved-balance (dealer (string-ascii 256)) (payee-type (string-ascii 256)) (tax-type (string-ascii 256)) (jurisdiction (string-ascii 256)) (balance uint) (pper uint))
   (begin
      (map-set payee-jurisdiction-summary {pper: pper, dealer: dealer, payee-type: payee-type, tax-type: tax-type, jurisdiction: jurisdiction} balance )
      (ok true)))

;; #[allow(unchecked_data)]
(define-public (reset-recieved-balance (dealer (string-ascii 256)) (payee-type (string-ascii 256)) (tax-type (string-ascii 256)) (jurisdiction (string-ascii 256))  (pper uint) )
   (begin
      (map-set payee-jurisdiction-summary {pper: pper, dealer: dealer, payee-type: payee-type, tax-type: tax-type, jurisdiction: jurisdiction} u0)
      (ok true)))

;; #[allow(unchecked_data)]
(define-public (update-wallet-address (payee-id uint) (wallet-address principal) ) 
    (let
        (
            (payee (unwrap! (map-get? payees payee-id) (err err-no-value)))
            (updatedValue (merge payee {wallet-address: wallet-address}))
        )
        (ok (map-set payees payee-id updatedValue))
    )
)

  ;; #[allow(unchecked_data)]
(define-public (set-whitelisted (asset-contract principal) (whitelisted bool))
	(begin
		(asserts! (is-eq contract-owner tx-sender) err-unauthorised)
		(ok (map-set whitelisted-asset-contracts asset-contract whitelisted))
	)
)

  ;; #[allow(unchecked_data)]
(define-public (set-payee (idx uint) (payee (string-ascii 256)) (wallet-address principal))
	(begin
		(asserts! (is-eq contract-owner tx-sender) err-unauthorised)
		;;(ok (map-insert payees u1 {wallet-owner-name: payee, wallet-address:  wallet-address, tax-rate-percent: u1000 } ))))
        (ok (map-insert payees idx {wallet-owner-name: payee, wallet-address:  wallet-address, tax-rate-percent: u1000 } ))))
    
;;*********************************************************************
;;
;;        Getters
;;
;;*********************************************************************

;;gets a specifically named parameter from the parameter table ppaakk
(define-private (get-parameter (param-name (string-ascii 256)) ) 
   (ok (unwrap! (map-get? parameters param-name) (err err-no-value))))
(define-private (get-parameter-string (param-name (string-ascii 256))) 
        (let (
            (temp1 (unwrap! (map-get? parameters param-name) (err err-no-value))))
            (ok (get val-string temp1))))
(define-private (get-parameter-value (param-name (string-ascii 256))) 
        (let (
            (temp1 (unwrap! (get-parameter param-name) (err err-no-value))))
            (ok (get val-number temp1))))
;;use these for incrementing a number stating from u0 if it has not yet been set
(define-private (get-parameter-value++ (param-name (string-ascii 256))) 
        (let (
            (temp1 (default-to u0 (get val-number (map-get? parameters param-name))))
            (try! (set-parameter-value param-name (+ temp1 u1)))) 
            (ok temp1)))
(define-private (get++parameter-value (param-name (string-ascii 256))) 
    (begin (
        let (
            (temp1 (default-to u0 (get val-number (map-get? parameters param-name))))
           ;; (temp2 (+ temp1 u1))            
            ;;(map-set parameters param-name {val-string: "na", val-number: u2 })
            )       
            (set-parameter-value param-name (+ temp1 u1)) 
            (ok (+ temp1 u1)))))

;; (define-private (get++parameter-value2 (param-name (string-ascii 256))) 
;;        (match (map-get? parameters param-name) 
;;         success
;;             (begin 
;;                 (let (
;;                     (temp1 (default-to u0 (get val-number success)))
;;                     (try! (set-parameter-value param-name (+ temp1 u1)))) 
;;                 (ok temp1)))
;;                 (begin (
;;         (try! (set-parameter-value param-name (+ u0 u1)))
;;            (ok u0)))))

;;(define-private (get++parameter-value3 (param-name (string-ascii 256))) 
  ;;    (let ((mapValue (default-to { (some {val-str:"", val-number:u0}) } (map-get? parameters param-name)))))
    ;;  (ok mapValue))
;; (define-private (foundit (param-name (string-ascii 256))) 
;;     (ok (is-some (get val-number (map-get? parameters param-name)))))
;; (define-private (get++parameter-value4 (param-name (string-ascii 256))) 
 ;; (if (is-some (get val-number (map-get? parameters param-name))) ;; Returns true))
;;   (if (foundit param-name) ;; Returns true))
;;         (let (
;;             (temp1 (get val-number (unwrap! (map-get? parameters param-name) err 101)))
;;             (try! (set-parameter-value param-name (+ temp1 u1))))          
;;             (ok (+ temp1 u1))) 
;;         (begin ( 
;;             (try! (set-parameter-value param-name u1))
;;             (ok u0)))))

;; (define-private (get-parameter-value5 (param-name (string-ascii 256))) 
;;        (match (map-get? parameters param-name) u0
;;             (begin 
;;                 (let (
;;                     (temp1 (default-to u0 (get val-number success)))
;;                     (try! (set-parameter-value param-name (+ temp1 u1)))) 
;;                 (ok temp1))
;;             )
;;             (begin
;;                 (try! (set-parameter-value param-name (+ u0 u1)))
;;                 (ok u0)))) 


;; (define-private (get-parameter-value6 (param-name (string-ascii 256))) 
;;     (if (is-none (map-get? parameters param-name))
;;         (begin 
;;             (let (
;;                 (temp1 (default-to u0 (get val-number success)))
;;                 (try! (map-set parameters param-name (+ temp1 u1)))) 
;;             (ok temp1))
;;         )
;;         (begin
;;             (try! (map-set parameters param-name u1))) 
;;             (ok u1)))
(define-private (get-parameter-b (param-name (string-ascii 256)) ) 
   (ok (unwrap! (map-get? parameters param-name) (err err-no-value))))
(define-private (get-parameter-p (param-name (string-ascii 256)) ) 
   (ok (unwrap! (map-get? parameters param-name) (err err-no-value))))
(define-private (get-parameters-s-by-token (param-name (string-ascii 256))  (token-number uint) )
    (ok (unwrap! (map-get? parameters-s-by-token {parameter-name: param-name,  token-number: token-number}) (err err-no-value))))
(define-private (get-parameters-n-by-token (param-name (string-ascii 256))  (token-number uint) )
    (ok (unwrap! (map-get? parameters-n-by-token {parameter-name: param-name,  token-number: token-number}) (err err-no-value))))
(define-private (get-parameters-b-by-token (param-name (string-ascii 256))  (token-number uint) )
    (ok (unwrap! (map-get? parameters-b-by-token {parameter-name: param-name,  token-number: token-number}) (err err-no-value))))
(define-private (get-parameters-p-by-token (param-name (string-ascii 256))  (token-number uint) )
    (ok (unwrap! (map-get? parameters-p-by-token {parameter-name: param-name,  token-number: token-number}) (err err-no-value))))
    
;; SIP009: Get the owner of the specified token ID
(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? MyParcel token-id)))
     ;; Owner of a given token identifier
   ;; (get-owner (uint) (response (optional principal) uint))


;; SIP009: Get the last token ID
(define-read-only (get-last-token-id)
  (ok (var-get last-id)))
(define-read-only (get-last-token-id2)
  (ok u5))

;; SIP009: Get the token URI. You can set it to any other URI
(define-read-only (get-token-uri (token-id uint))
   (ok (map-get? nft-data token-id)))

;;(get-token-uri (uint) (response (optional (string-ascii 256)) uint))

(define-read-only (get-parcel-number (token-id uint))
   (ok (map-get? parcel-numbers token-id)))

(define-read-only (get-situs-address (token-id uint))
   (ok (map-get? situs-addresses token-id)))

(define-read-only (get-legal-description (token-id uint))
   (ok (map-get? legal-descriptions token-id)))

(define-read-only (get-GIS-coordinate (token-id uint))
   (ok (map-get? GIS-coordinates token-id)))

(define-read-only (get-parent-token-address (token-id uint))
   (ok (map-get? parent-token-addresses token-id)))

(define-read-only (get-child-token-address (token-id uint))
   (ok (map-get? child-token-addresses token-id)))

(define-read-only (get-token-uri2 (token-id uint))
    (ok (as-max-len? (concat (concat IPFS_ROOT (concat "guinea_" (uint-to-string token-id))) "_metadata.json") u256)))


(define-read-only (get-jurisdiction (token-number uint) (payee-type (string-ascii 256)))
    (let (
        (payee-id (unwrap!
                    (map-get? payee-token 
                      {token-number: token-number, 
                       payee-type: payee-type})
                    (err err-no-value))) ;;the payee must have been set up for this token 
        (payee (unwrap!
                 (map-get? payees payee-id)
                 (err err-no-value)))
        (payee-name (get wallet-owner-name payee)))
     (ok payee-name)))

(define-read-only (get-MUT-jurisdiction (token-number uint))
    (let (
        (payee-type "taxing-jurisdiction")
        (payee-id (unwrap!
                    (map-get? payee-token 
                      {token-number: token-number, 
                       payee-type: payee-type})
                    (err err-no-value))) ;;the payee must have been set up for this token 
        (payee (unwrap!
                 (map-get? payees payee-id)
                 (err err-no-value)))
        (payee-name (get wallet-owner-name payee))
        )
     (ok payee-name)))

;;get the total amount recieved by this jurisediction for this type of tax as a result of this dealer's operations.
;;this is used at month-end to apply a total amount to the dealer's tax retrun 
(define-read-only (get-recieved-balance (dealer (string-ascii 256)) (payee-type (string-ascii 256)) (tax-type (string-ascii 256)) (jurisdiction (string-ascii 256)) (pper uint))
   (ok (default-to u0  (map-get? payee-jurisdiction-summary {pper : pper, dealer: dealer, payee-type: payee-type, tax-type: tax-type, jurisdiction: jurisdiction}) )))

(define-read-only (get-USDSTX)    
;;future design may include call to Redstone Oracle to get USDSTX
;;this is received in cents to keep significant figures
    (let (
        (temp1 (default-to u0 (get val-number (map-get? parameters "USDSTX")))))
        ;; (try! (* te(unwrap! (get-parameter-string "temp1") (err err-no-value))mp1 u1)))))
        (ok temp1)))

(define-read-only (get-USDOrlO)    
;;future design may include call to Redstone Oracle to get USDOrlO
;;this is received in cents to keep significant figures
    (let (
        (temp1 (default-to u0 (get val-number (map-get? parameters "USDOrlO")))))
        (ok temp1)))
 
(define-read-only (get-USDSTX-micro)  
;;muliplier is 10 as USDSTX was posted in cents.  so this is actual dollar rate to preserve significant figures  
    (let (
        (temp1 (unwrap! (get-USDSTX) (err err-no-value))))
        (ok (/  temp1 u10))))

(define-read-only (get-USDOrlO-micro)    
    (let (
        (temp1 (unwrap! (get-USDOrlO) (err err-no-value)))
        (try! (/  temp1 u10)))
        (ok temp1)))

(define-read-only (is-whitelisted (asset-contract principal))
	(default-to false (map-get? whitelisted-asset-contracts asset-contract))
)


;;*********************************************************************
;;
;;        Helpful funcitons
;;
;;*********************************************************************

(define-constant FOLDS_3 (list true true true))

(define-constant NUM_TO_CHAR (list
    "0" "1" "2" "3" "4" "5" "6" "7" "8" "9"
))

(define-private (concat-uint (ignore bool) (input { dec: uint, data: (string-ascii 3) }))
    (let (
            (last-val (get dec input))
        )
        (if (is-eq last-val u0)
            {
                dec: last-val,
                data: (get data input)
            }
            (if (< last-val u10)
                {
                    dec: u0,
                    data: (concat-num-to-string last-val (get data input))
                }
                {
                    dec: (/ last-val u10),
                    data: (concat-num-to-string (mod last-val u10) (get data input))
                }))))

(define-private (concat-num-to-string (num uint) (right (string-ascii 3)))
    (unwrap-panic (as-max-len? (concat (unwrap-panic (element-at NUM_TO_CHAR num)) right) u3)))

(define-private (uint-to-string (num uint))
    (if (is-eq num u0)
        (unwrap-panic (as-max-len? "0" u3))
        (get data (fold concat-uint FOLDS_3 { dec: num, data: ""}))))


;;*********************************************************************
;;
;;        Alerts, Wanrings, Thins of interest
;;
;;*********************************************************************

;; (define-public (toggle-IRS-lein-alert  (token-number uint) )
;;     (match (get-parameters-b-by-token "irs-lien" token-number)
;;         success
;;         (ok (set-parametesr-b-by-token "irs-lien" token-number (not success )))
;;         (ok (set-parametesr-b-by-token "irs-lien" token-number true ))
;;         (ok false))
;; )



;;*********************************************************************
;;
;;        Tax and Utiltiy Bill Related Section
;;
;;*********************************************************************

;;***************************************************************************************
;;          Assignment of Payee to Parcel Token
;;          Function Name:  assign-payee
;;
;;          This cluster of functions is called during the mint process
;;          or as needed to maitain a list of the payees to assign to each
;;          parcel token.  For nstance, if Duke Energy is the utility provider,
;;          the key to the map named 'payees'for the row associated with Duke Energy
;;          is saved to the 'payee-token' map.  There is a one-to-many relatioship
;;          with the NFTs (tokens) and the 'payee-token' map.  When a bill is paid,
;;          the wallet addresses of each payee are gathered and the proceeds
;;          distributed to these wallets
;;
;;          loop values in the payee table to find utility names ppaakk
;;            insert pk's of the payee to a map with key{token#,payee-type} value {fk-payee}
;;              payee-type (water, electric, sales tax, MUT etc)
;;          loop values in the payee table to find jurisdiction name and tax type(uincorporated Orange/MUT)
;;              insert pk's of the payee to a map with key{token#,payee-type} value {fk-payee}
;;**************************************************************************************
;;https://clarity.tools/perma/KGRlZmluZS1tYXAgcGFyYW1ldGVycyAKICAoc3RyaW5nLWFzY2lpIDI1NikgCiAge3ZhbC1zdHJpbmc6IChzdHJpbmctYXNjaWkgMjU2KSwgCiAgIHZhbC1udW1iZXI6IHVpbnR9KQoKKGRlZmluZS1tYXAgcGF5ZWUtdGFibGUgCiAgdWludCAKICB7dG9rZW4tbnVtYmVyOiB1aW50LCAKICAgcGF5ZWUtdHlwZTogKHN0cmluZy1hc2NpaSAyNTYpfSkgCgooZGVmaW5lLXByaXZhdGUgKGFzc2lnbi1wYXllZSDCoAogICAgICAgICAgICAgICAgICAodG9rZW4tbnVtYmVyIHVpbnQpIAogICAgICAgICAgICAgICAgICAocGF5ZWUtbmFtZSAoc3RyaW5nLWFzY2lpIDI1NikpIAogICAgICAgICAgICAgICAgICAocGF5ZWUtdHlwZSAoc3RyaW5nLWFzY2lpIDI1NikpKSAKICAoc2V0LXBhcmFtZXRlciAidGVtcDEiIHBheWVlLW5hbWUgdG9rZW4tbnVtYmVyKQogIChzZXQtcGFyYW1ldGVyICJ0ZW1wMiIgcGF5ZWUtdHlwZSB1MCkgwqAgwqAKICAoYXNzaWduLXBheWVlcyAobGlzdCB0cnVlKSkpCgooZGVmaW5lLXByaXZhdGUgKGFzc2lnbi1wYXllZXMgCiAgICAgICAgICAgICAgICAgIChwYXllZXMgKGxpc3QgMjUgYm9vbCkpKQogIChhcHBseS1wYXllZS10by10b2tlbiBwYXllZXMpKQoKOzsgbG9vcCB0aHJvdWdoIHRoZSBwYXllZSBtYXAgYW5kIGxvb2sgZm9yIHRoaXMgcGF5ZWUKOzsgKGZvciBuZXh0LWlkPTA7IG5leHQtaWQrKywgbmV4dC1pZDw9bGVuZ3RoKHBheWVlcykpCgooZGVmaW5lLXByaXZhdGUgKGFwcGx5LXBheWVlLXRvLXRva2VuIAogICAgICAgICAgICAgICAgICAocGF5ZWVzIChsaXN0IDI1IGJvb2wpKSkKICAobGV0ICgoaWQtcmVhY2hlZCAoZm9sZCBwYXllZS1pdGVyIHBheWVlcyB1MCkpKQogICAgIGlkLXJlYWNoZWQpKQoKKGRlZmluZS1wcml2YXRlIChwYXllZS1pdGVyCiAgICAgICAgICAgICAgICAgIChpZ25vcmUgYm9vbCkgCiAgICAgICAgICAgICAgICAgIChuZXh0LWlkIHVpbnQpKQogIChsZXQgKChwYXllZS1uYW1lIChnZXQgdmFsLXN0cmluZyAoZ2V0LXBhcmFtZXRlciAidGVtcDEiKSkpKQogICAgKGlmIChhbmQgKDw9IG5leHQtaWQgdTI1KSAKICAgICAgICAgICAgIChpcy1lcSBwYXllZS1uYW1lIAogICAgICAgICAgICAgICAgICAgKGdldCBwYXllZS10eXBlIAogICAgICAgICAgICAgICAgICAgICAobWFwLWdldD8gcGF5ZWUtdGFibGUgbmV4dC1pZCkpKSkKICAgICAgKGxldCAoKHRva2VuLW51bWJlciAodW53cmFwLXBhbmljIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgKGdldCB2YWwtbnVtYmVyIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZ2V0LXBhcmFtZXRlciAidGVtcDEiKSkpKQogICAgICAgICAgICAocGF5ZWUtdHlwZSAodW53cmFwLXBhbmljIAogICAgICAgICAgICAgICAgICAgICAgICAgIChnZXQgdmFsLXN0cmluZyAKICAgICAgICAgICAgICAgICAgICAgICAgICAgIChnZXQtcGFyYW1ldGVyICJ0ZW1wMiIpKSkpKSAgICAKICAgICAgICAobWFwLWluc2VydCBwYXllZS10YWJsZSBuZXh0LWlkCiAgICAgICAgICB7dG9rZW4tbnVtYmVyOiB0b2tlbi1udW1iZXIsIAogICAgICAgICAgIHBheWVlLXR5cGU6IHBheWVlLXR5cGV9KSAKICAgICAgICAoKyBuZXh0LWlkIHUxKSkKICAgICAgbmV4dC1pZCkpKQogIAooZGVmaW5lLXByaXZhdGUgKHNldC1wYXJhbWV0ZXIgCiAgICAgICAgICAgICAgICAgIChwYXJhbS1uYW1lIChzdHJpbmctYXNjaWkgMjU2KSkgCiAgICAgICAgICAgICAgICAgICh2YWwtc3RyaW5nIChzdHJpbmctYXNjaWkgMjU2KSkgKHZhbC1udW1iZXIgdWludCkpCiAgKG9rIChtYXAtaW5zZXJ0IHBhcmFtZXRlcnMgCiAgICAgICAgcGFyYW0tbmFtZSAKICAgICAgICB7dmFsLXN0cmluZzogdmFsLXN0cmluZywgCiAgICAgICAgIHZhbC1udW1iZXI6IHZhbC1udW1iZXJ9KSkpCgooZGVmaW5lLXByaXZhdGUgKGdldC1wYXJhbWV0ZXIgCiAgICAgICAgICAgICAgICAgIChwYXJhbS1uYW1lIChzdHJpbmctYXNjaWkgMjU2KSkpIAogIChtYXAtZ2V0PyBwYXJhbWV0ZXJzIHBhcmFtLW5hbWUpKQoKOzs%3D
;;https://github.com/boomcrypto/clarity-deployed-contracts/blob/main/contracts/SP0DV7BAC1H5WFRV3ECV250S150T89Q2CQEZ39WA/artistic-stacks.clar       
(define-private (assign-payee  
                  (token-number uint) 
                  (payee-name (string-ascii 256)) 
                  (payee-type (string-ascii 256))) 
(begin
  ;;(print (concat (concat (concat "Assigning: " payee-name  ) " as ")  payee-type))
  (set-parameter "temp1" payee-name token-number)
  (set-parameter "temp2" payee-type u0)
;; loop through the payee map and look for this payee
;; (for i=0; i++, i<=length(a-list))   
    (set-max-i (list true true true true true true true true true true true true true true true true true true true true true true true true true))))
    (define-private (set-max-i (a-list (list 25 bool))) (loop-list a-list)) 
    (define-private (loop-list (a-list (list 25 bool)))
    (let ((id-reached (fold i-iter a-list u1))) id-reached))
    (define-private (i-iter (ignore bool) (i uint))
    (if (<= i u25)
        (begin 
        (unwrap! (assign-payee-to-token i) i)
        (+ i u1)) i))

(define-private (assign-payee-to-token (payee-id uint))
    (begin
      (if (is-eq (unwrap! (get-parameter-string "temp1") (err err-no-value))
                  (get wallet-owner-name (unwrap! (map-get? payees payee-id) (err err-no-value))))
        (let (
            (token-number (unwrap! (get-parameter-value "temp1") (err err-no-value)))
            (payee-type (unwrap! (get-parameter-string "temp2") (err err-no-value)))
            (the-tuple (tuple  (token-number token-number) (payee-type payee-type))))
           ;; (print "Tuple is ") (print the-tuple) (print (concat "PayeeId is " (uint-to-string payee-id)))
            (print (concat "Payee-type: " (concat (get payee-type the-tuple) (concat ", token#:  " (concat (uint-to-string (get token-number the-tuple)) (concat ", PayeeId is " (uint-to-string payee-id)))))))
            (ok (map-set payee-token the-tuple payee-id ))) (ok true))))    
;;******************************************************************************************


;;***************************************************************************************
;;          Set the wallet address for payee
;;          Function Name:  
;;
;;          The payees must be able manage thier wallet addresses in the 
;;          smart contract without the County or in ohter entity being able
;;          to make changes with extreme protocal.  This prevents a bad-actor
;;          from intentional changing a wallet address and stealing funds.
;;          This function find the payee in the map and changes the wallet 
;;          address provided the change is being initiated from the current
;;          wallet addresses on file
;;          distributed to these wallets
;;**************************************************************************************
;; (define-private (set-wallet-address 
;;                   (p uint) 
;;                   (payee-name (string-ascii 256)) 
;;                   (payee-type (string-ascii 256))) 
;; (begin
;;   ;;(print (concat (concat (concat "Assigning: " payee-name  ) " as ")  payee-type))
;;   (set-parameter "temp1" payee-name token-number)
;;   (set-parameter "temp2" payee-type u0)
;; ;; loop through the payee map and look for this payee
;; ;; (for i=0; i++, i<=length(a-list))   
;;     (set-max-i2 (list true true true true true true true true true true true true true true true true true true true true true true true true true))))
;;     (define-private (set-max-i2 (a-list (list 25 bool))) (loop-list a-list)) 
;;     (define-private (loop-list2 (a-list (list 25 bool)))
;;     (let ((id-reached (fold i-iter a-list u1))) id-reached))
;;     (define-private (i-iter2 (ignore bool) (i uint))
;;     (if (<= i u25)
;;         (begin 
;;         (unwrap! (assign-payee-to-token i) i)
;;         (+ i u1)) i))

;; (define-private (set-wallet-address2 (payee-id uint))
;;     (begin
;;       (if (is-eq (unwrap! (get-parameter-string "temp1") (err err-no-value))
;;                   (get wallet-owner-name (unwrap! (map-get? payees payee-id) (err err-no-value))))
;;         (asserts! (principal-of? (get wallet-address (unwrap! (map-get? payees payee-id) (err err-no-value)))) (err err-owner-only))
;;         (let (
;;             (wallet-address (unwrap! (get-parameter-p "temp1") (err err-no-value)))
;;             (wallet-owner-name (unwrap! (get-parameter-string "temp1") (err err-no-value)))
;;             (tax-rate-percent (get tax-rate-percent (unwrap! (map-get? payees payee-id) (err err-no-value))))
;;             (the-tuple2 (tuple  (wallet-owner-name wallet-owner-name) (wallet-address wallet-address) (tax-rate-percent tax-rate-percent))))
;;            ;; (print "Tuple is ") (print the-tuple) (print (concat "PayeeId is " (uint-to-string payee-id)))
;;           ;;  (print (concat "Payee-type: " (concat (get payee-type the-tuple) (concat ", token#:  " (concat (uint-to-string (get token-number the-tuple)) (concat ", PayeeId is " (uint-to-string payee-id)))))))
            ;; (ok (map-set payees payee-id the-tuple2  ))) (ok true))))    
;;******************************************************************************************
;;set up a new utility company payee or tax recipient jurisdiction
;; #[allow(unchecked_data)]
;; (define-public (add-payee (payee-name (string-ascii 256)) (wallet-address principal))
;; (match (get++parameter-value "payee-next-id")
;;          success 
;;         (map-insert payees success { wallet-owner-name: payee-name, wallet-address:  wallet-address, tax-rate-percent: u1000 })  
;;         fail
;;         (ok false)))

(define-public (add-payee (payee-name (string-ascii 256)) (wallet-address principal))
    (ok (map-insert payees (unwrap! (get++parameter-value "payee-next-id") (err 200)) { wallet-owner-name: payee-name, wallet-address:  wallet-address, tax-rate-percent: u1000 }))) 

;; (define-public (add-payee2)
;; (add-payee ("duke" 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0)))
;;post a utility bill
;; #[allow(unchecked_data)]
(define-public (post-utility-bill (token-number uint) (amt-due-electric uint) (amt-due-water uint) (amt-due-natural-gas uint) (amt-due-propane uint) (sales-tax uint) (GRT uint) (MUT uint) (surtax uint) (franchise uint) (pper uint)) 
    (begin
        ;;(asserts! (> token-number u0) (err err-no-value)) 
        (asserts! (is-eq tx-sender tx-sender) (err err-not-designated-utility-company)) 
        (map-set utility-bills u1 {amt-due-electric: amt-due-electric, amt-due-water: amt-due-water, amt-due-natural-gas: amt-due-natural-gas, amt-due-propane: amt-due-propane,sales-tax: sales-tax, GRT: GRT, MUT: MUT, surtax: surtax, franchise: franchise, pper: pper })         
        (ok true)))

;;post a utility bill
;; #[allow(unchecked_data)]
(define-public (post-utility-bill-ft (token-number uint) (amt-due-electric uint) (amt-due-water uint) (amt-due-natural-gas uint) (amt-due-propane uint) (sales-tax uint) (GRT uint) (MUT uint) (surtax uint) (franchise uint) (pper uint) (payment-asset-contract (optional principal))) 
    (begin
     	(asserts! (match payment-asset-contract payment-asset (is-whitelisted payment-asset) true) err-payment-contract-not-whitelisted)
    ;;    (map-set utility-bills-ft u1 {amt-due-electric: amt-due-electric, amt-due-water: amt-due-water, amt-due-natural-gas: amt-due-natural-gas, amt-due-propane: amt-due-propane,sales-tax: sales-tax, GRT: GRT, MUT: MUT, surtax: surtax, franchise: franchise, pper: pper })         
	    (ok true)))

;;get the total amount the customer owes for this period
(define-read-only (utility-bill-amount-due (token-number uint)) 
    (let ((temp1 (map-get? utility-bills token-number)))
        (+ 
          (default-to u0 (get amt-due-electric temp1))
          (default-to u0 (get amt-due-water temp1))
          (default-to u0 (get amt-due-natural-gas temp1))
          (default-to u0 (get amt-due-propane temp1))
          (default-to u0 (get sales-tax temp1)) 
          (default-to u0 (get GRT temp1))
          (default-to u0 (get MUT temp1))
          (default-to u0 (get franchise temp1))
          (default-to u0 (get surtax temp1)))))

;;recieve payment to contract and record to which token it applies
;; #[allow(unchecked_data)]

;; #[allow(unchecked_data)]
(define-public (recieve-payment2  (token-number uint) (amount uint) (payment-asset-contract  (optional <ft-trait>)))
    (begin
        (asserts! (> amount u0) err-no-value)
       ;; (asserts! (match payment-asset-contract payment-asset (is-whitelisted payment-asset) true) err-payment-contract-not-whitelisted)
	    (match payment-asset-contract 
            payment-asset
            (begin 
               ;; (asserts! (is-whitelisted payment-asset) err-payment-contract-not-whitelisted)
           ;;     (try! (recieve-payment-ft  token-number amount payment-asset-contract)))
                (try! (recieve-payment  token-number amount)))
            (try! (recieve-payment  token-number amount))
        )
    (ok false)))
            
;; #[allow(unchecked_data)]
(define-public (recieve-payment  (token-number uint) (amount uint))
    (begin
        (asserts! (> amount u0) err-no-value)
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender))) 
        (let (
            (market (unwrap-panic (get-USDSTX) ) ) ;;get USDSTX @ time of transaction
            ;;determine new customer balance in mSTX
            (current-balance (default-to u0 ( map-get? deposited-funds token-number ))) 
            (new-balance (+ current-balance amount))               
            ) 
            ;;set new customer balance in mSTX
            (map-set deposited-funds token-number new-balance)
          ;;  (match (get-USDSTX) 
          ;;   USDSTX (if (> amount u0)
           ;; (begin
                ;;save the USDSTX at time of customer payment for this token
                (map-set parameters-n-by-token {parameter-name: "USDSTX", token-number: token-number} market )
            ;; )
             ;; (ok false))
            ;;  fail-val
    (ok false)))
            )

;; #[allow(unchecked_data)]            
(define-public (recieve-payment-ft  (token-number uint) (amount uint) (payment-asset <ft-trait>))
    (begin
        (try! (transfer-ft payment-asset amount tx-sender (as-contract tx-sender))) 
        (let (
            (market (unwrap-panic (get-USDOrlO) ) ) ;;get USDSTX @ time of transaction
            ;;determine new customer balance in OrlO
            (current-balance (default-to u0 ( map-get? deposited-funds-ft { token-number : token-number, asset : "OrlO" }  ))) 
            (new-balance (+ current-balance amount))               
            ) 
            ;;set new customer balance in OrlO
            (map-set deposited-funds-ft {token-number : token-number, asset : "OrlO"}  new-balance)
             ;;save the USDOrlO at time of customer payment for this token
             (map-set parameters-n-by-token {parameter-name: "USDOrlO", token-number: token-number} market )
    (ok false))))


;;recieve payment to contract and record to which token it applies
;; (define-public (recieve-payment-type  (token-number uint) (amount uint) (payee-id uint) (payee-type uint) jurisdiction (string-ascii 256))
;;     (begin
;;         (asserts! (> amount u0) err-no-value)
;;         (try! (stx-transfer? amount tx-sender (as-contract tx-sender))) 
;;         (let (
;;             (current-balance (default-to u0 ( map-get? deposited-funds token-number ))) 
;;             (new-balance (+ current-balance amount))                     
;;             ) 
;;             (map-set deposited-funds token-number new-balance)  
;;             (try! (increase-recieved-balance payee-id payee-type jurisdiction amount)) ;;increase total balance recieve by this jurisdiction from this payee
;;         )       
;;         (ok true)))


(define-public (increase-recieved-balance (token-number uint) (dealer (string-ascii 256))  (payee-type (string-ascii 256)) (tax-type (string-ascii 256)) (jurisdiction (string-ascii 256)) (amount uint) (pper uint))
     (begin
        (let ((balance (+ (unwrap! (get-recieved-balance dealer payee-type tax-type jurisdiction pper) (err err-no-value)) amount))) 
        (set-recieved-balance  dealer payee-type tax-type jurisdiction balance pper))))

(define-private (increase-recieved-balance-by-token   (token-number uint) (payee-type (string-ascii 256)) (tax-type (string-ascii 256)) (payment (optional uint)) (pper uint)) 
  (match payment
    amount
;;so if payee-type is "MUT" meaning the wallet transfer is to a the jurisdiction receiving "MUT" then proceed further
;;this will be expanded to handle ohter tax types
;;the dealer from which this transaction was initiated is determined based on just the "eletric" dealer for this 
;;token.  later we will have to expand to handle whatever dealer initiated the transaction and furhter when
;;there are payments for multiple types of services such as water and electric at OUC
    (if (is-eq payee-type "MUT")
        (begin
            (let (   
                (dealer (unwrap! (get-jurisdiction token-number "electric") (err err-no-value)))
                (jurisdiction (unwrap! (get-jurisdiction token-number "taxing-jurisdiction") (err err-no-value))))  
                (try! (increase-recieved-balance  token-number dealer payee-type tax-type jurisdiction amount pper)))
                (ok false))
            (ok false))           
    (ok false)))

(define-private (increase-recieved-balance-by-token2 (token-number uint) (dealer-type (string-ascii 256)) (payee-type (string-ascii 256)) (tax-type (string-ascii 256)) (payment (optional uint)) (pper uint)) 
  (match payment
    amount
    (begin
    (if (is-eq payee-type "MUT")
        (begin
            (let (
                (dealer (unwrap! (get-jurisdiction token-number dealer-type) (err err-no-value)))
                (jurisdiction (unwrap! (get-jurisdiction token-number "taxing-jurisdiction") (err err-no-value))))  
                (try! (increase-recieved-balance  token-number dealer payee-type tax-type jurisdiction amount pper)))
                (ok false))
    (ok false))    
    )       
    (ok false)))

;;decrease balance for this token by amount used to pay current bill
;; #[allow(unchecked_data)]
(define-public (decrease-customer-funds  (token-number uint) (amount uint))
    (begin
        (asserts! (> amount u0) (err err-no-value)) 
        (let (
            (current-balance (default-to u0 ( map-get? deposited-funds token-number ))) 
            (new-balance (- current-balance amount))                     
            ) 
            (map-set deposited-funds token-number new-balance)  
        )       
        (ok true)))

;;decrease balance for this token by amount used to pay current bill
;; #[allow(unchecked_data)]
(define-public (disburse-funds  (token-number uint) (amount uint))
    (begin
        (asserts! (> amount u0) err-no-value) 
        (let (
            (current-balance (default-to u0 ( map-get? deposited-funds token-number ))) 
            (new-balance (- current-balance amount))                     
            ) 
            (map-set deposited-funds token-number new-balance)  
        )       
        (ok true)))

(define-read-only (get-balance-due (token_ID uint)) 
  (ok (utility-bill-amount-due token_ID)))

(define-read-only (get-balance-due-USD (token_ID uint)) 
  (ok (utility-bill-amount-due token_ID)))

(define-read-only (get-balance-due-STX (token_ID uint))
    (let (
        (balance-due (utility-bill-amount-due token_ID))
       (USDSTX (unwrap! (get-USDSTX) (err err-no-value)))
       )
  (ok (* balance-due USDSTX))))
        
(define-read-only (get-balance-due-STX-micro (token_ID uint))
    (let (
        (balance-due (utility-bill-amount-due token_ID))
        (Market (unwrap! (get-USDSTX-micro) (err err-no-value))))
    (ok (* balance-due (* u1 Market)))))
        
(define-read-only (get-balance-due-OrlO-micro (token_ID uint))
    (let (
        (balance-due (utility-bill-amount-due token_ID))
        (Market (unwrap! (get-USDOrlO-micro) (err err-no-value))))
    (ok (* balance-due (* u1 Market)))))

(define-read-only (get-STX-micro-amount-in-USD (amount uint))
    (let (
    ;;    (balance-due (utility-bill-amount-due token_ID))
       (Market (unwrap! (get-USDSTX-micro) (err err-no-value)))
       )
  (ok (/ amount Market))))

(define-read-only (get-OrlO-micro-amount-in-USD (amount uint))
    (let (
    ;;    (balance-due (utility-bill-amount-due token_ID))
       (Market (unwrap! (get-USDOrlO-micro) (err err-no-value)))
       )
  (ok (/ amount Market))))


(define-read-only (get-wallet-address? (token-number uint) (payee-type (string-ascii 256))) 
;;get the wallet address of the utility/jurisdiction for this NFT for this payee type.
  (let (
        (payee-type2 (unwrap! (get-parameter-string payee-type) (err err-no-value)))
        (payee-id (unwrap!
                    (map-get? payee-token 
                      {token-number: token-number, 
                       payee-type: payee-type2})
                    (err err-no-value))) ;;the payee must have been set up for this token 
        (payee (unwrap!
                 (map-get? payees payee-id)
                 (err err-no-value)))
        ;;(print (get wallet-address payee))
        )  ;;must have a wallet address for this payee
  
     (ok (get wallet-address payee))))

;; #[allow(unchecked_data)]
(define-public (pay-wallet (token-number uint) (payment (optional uint)) (payee-type (string-ascii 100)) (pper uint ))
    (let (
        (wallet_address (unwrap! 
                (get-wallet-address? token-number payee-type)
                (err err-no-value))))
    (begin
        (unwrap! (pay payment wallet_address token-number) (err err-no-value))
        (unwrap! (increase-recieved-balance-by-token token-number payee-type payee-type payment pper) (err err-no-value)))
    (ok false))) 

;; #[allow(unchecked_data)]
(define-public (pay-wallet-ft (token-number uint) (payment (optional uint)) (payee-type (string-ascii 100)) (pper uint ) (payment-asset-contract  (optional <ft-trait>)))
    (let (
        (wallet_address (unwrap! 
                (get-wallet-address? token-number payee-type)
                (err err-no-value))))
    (begin
        (unwrap! (pay payment wallet_address token-number) (err err-no-value))
        (unwrap! (increase-recieved-balance-by-token token-number payee-type payee-type payment pper) (err err-no-value)))
    (ok false))) 

(define-private (pay (payment (optional uint)) (receiver principal) (token-number uint)) 
;;pay the payee thier share which was stated in USD on the customer bill. So convert to micro STX
;;using the conversion rate saved to the token at the time the customer paid thier bill
  (match payment
    amount (if (> amount u0)
        (begin
            (let (
                (USDSTX (unwrap-panic (map-get? parameters-n-by-token {parameter-name: "USDSTX", token-number: token-number})))
                (amount-STX-micro (/ (* amount USDSTX) u10))
                ;;so, if amt to pay payee is $10
                ;;and conversion rate at time of customer payment was .4035 which was entered as 4035
                ;;$10 *  * (4035/1000)USD/STX is amount due in STX ($10 * 0.4035USD/STX) which is 4.035STX
                ;;4.035STX equal 4035 micro STX
                ;;this is equivlent to $10 * 4035 /10 which is the formula above
                ;;4035  .4035STX = 403.5 mSTX   $10 * 0.4035USD/STX = 4.035STX=>*1000=4035
                )
            (as-contract (stx-transfer? amount-STX-micro tx-sender receiver))
            ;;(send-stx (recipient { to: receiver, amount-STX-micro: uint, memo: (buff 34) }))
        ))
        (ok false))
    (ok false)))

(define-private (pay-ft (payment (optional uint)) (receiver principal) (token-number uint) (payment-asset-contract <ft-trait>)) 
;;pay the payee thier share which was stated in USD on the customer bill. So convert to micro Orlo
;;using the conversion rate saved to the token at the time the customer paid thier bill
  (match payment
    amount (if (> amount u0)
        (begin
            (let (
                (market (unwrap-panic (map-get? parameters-n-by-token {parameter-name: "USDOrlO", token-number: token-number})))
                (market-micro (/ (* amount market) u10)))
                (ok (try! (transfer-ft payment-asset-contract market-micro receiver tx-sender)))
          ;;  (as-contract (ft-transfer? market-micro tx-sender receiver))
        ))
        (ok false))
    (ok false)))

(define-private (transfer-ft (token-contract <ft-trait>) (amount uint) (sender principal) (recipient principal))
	(contract-call? token-contract transfer amount sender recipient none)
)

(define-public (distribute-funds-received (token-number uint) (pper uint) )  
  (let (
      (temp1 (map-get? utility-bills token-number)))         
 ;; (asserts! (is-some (get amt-due-electric temp1)) (err err-no-value))
  (begin 
    ;;pay each payee thier share in terms on micro STX @ conversion rate at time of customer payment
    (and (is-some (get amt-due-electric temp1)) (try! (pay-wallet token-number (get amt-due-electric temp1) "electric" pper)))
    (and (is-some (get amt-due-water temp1)) (try! (pay-wallet token-number (get amt-due-water temp1) "water" pper)))
    (and (is-some (get amt-due-natural-gas temp1)) (try! (pay-wallet token-number (get amt-due-natural-gas temp1) "natural-gas" pper)))
    (and (is-some (get amt-due-propane temp1)) (try! (pay-wallet token-number (get amt-due-propane temp1) "propane" pper)))
    (and (is-some (get sales-tax temp1)) (try! (pay-wallet token-number (get sales-tax temp1) "sales-tax" pper)))
    (and (is-some (get GRT temp1)) (try! (pay-wallet token-number (get GRT temp1) "GRT" pper)))
    (and (is-some (get MUT temp1)) (try! (pay-wallet token-number (get MUT temp1) "MUT" pper)))
    (and (is-some (get franchise temp1)) (try! (pay-wallet token-number (get franchise temp1) "franchise" pper)))
    (and (is-some (get surtax temp1)) (try! (pay-wallet token-number (get surtax temp1) "surtax" pper)))
    (ok true))))

(define-public (distribute-funds-received-ft (token-number uint) (pper uint) (payment-asset-contract  (optional <ft-trait>)))  
  (let (
      (temp1 (map-get? utility-bills token-number)))         
 ;; (asserts! (is-some (get amt-due-electric temp1)) (err err-no-value))
  (begin 
    ;;pay each payee thier share in terms on micro STX @ conversion rate at time of customer payment
    (and (is-some (get amt-due-electric temp1)) (try! (pay-wallet token-number (get amt-due-electric temp1) "electric" pper)))
    (and (is-some (get amt-due-water temp1)) (try! (pay-wallet token-number (get amt-due-water temp1) "water" pper)))
    (and (is-some (get amt-due-natural-gas temp1)) (try! (pay-wallet token-number (get amt-due-natural-gas temp1) "natural-gas" pper)))
    (and (is-some (get amt-due-propane temp1)) (try! (pay-wallet token-number (get amt-due-propane temp1) "propane" pper)))
    (and (is-some (get sales-tax temp1)) (try! (pay-wallet token-number (get sales-tax temp1) "sales-tax" pper)))
    (and (is-some (get GRT temp1)) (try! (pay-wallet token-number (get GRT temp1) "GRT" pper)))
    (and (is-some (get MUT temp1)) (try! (pay-wallet token-number (get MUT temp1) "MUT" pper)))
    (and (is-some (get franchise temp1)) (try! (pay-wallet token-number (get franchise temp1) "franchise" pper)))
    (and (is-some (get surtax temp1)) (try! (pay-wallet token-number (get surtax temp1) "surtax" pper)))
    (ok true))))

;; #[allow(unchecked_data)]
(define-public (reset-utility-bill  (token-number uint) (pper uint) )
    (begin
        (asserts! (> token-number u0) (err err-no-value)) 
        (map-set utility-bills u1 {amt-due-electric: u0, amt-due-water: u0, amt-due-natural-gas: u0, amt-due-propane: u0,sales-tax: u0, GRT: u0, MUT: u0, surtax: u0, franchise: u0, pper: pper })         
        (ok true)))

;;https://explorer.stacks.co/txid/0xe643ac041d2ef1faabb255f0b980b6f3f782421a42df2d0c30bee4bb115869ec?chain=mainnet
;; send-many
(define-public (send-stx-with-memo (ustx uint) (to principal) (memo (buff 34)))
 (let ((transfer-ok (try! (stx-transfer? ustx tx-sender to))))
   (print memo)
   (ok transfer-ok)))

(define-private (send-stx (recipient { to: principal, ustx: uint, memo: (buff 34) }))
  (send-stx-with-memo
     (get ustx recipient)
     (get to recipient)
     (get memo recipient)))

(define-private (check-err (result (response bool uint))
                           (prior (response bool uint)))
  (match prior ok-value result
               err-value (err err-value)))

(define-public (send-many (recipients (list 200 { to: principal, ustx: uint, memo: (buff 34) })))
  (fold check-err
    (map send-stx recipients)
    (ok true)))


;;-- BEGIN DELETE SECTION --
;; this marks the begining of the sectin ath will be deleted emtrily by the compiler



    ;;ability to change wallet address restricted to wallet holder.  ORG cant change once set.
;;wallet 1: Duke Energy
;;Wallet 2: Florida Department of Revenue Sales Tax
;;Wallet 3: Florida Department of Revenue Gross Reciepts Tax
;;Wallet 4: Orange County Comptroller
;;Wallet 5: Florida Department of Revenue Discretionary Surtax
;; ;;Wallet 6: City of Orlando

        ;;HERE YOU NEED TO GET THE APPLICABLE WALLET ADDRESS DYNAMICLLY
        ;;parameter table with descripton as key and value as param value
        ;;payee map has uint as pk with both utiltiy & jurisdiction names in a single row
        ;;payee/token table is this: key{token#,payee-type} value {fk-payee}
        ;;token is minted passing utility names for electric and water and local & state jurisdictions
        ;;  loop values in the payee table to find utility names
        ;;  insert pk's of the payee to a map with key{token#,payee-type} value {fk-payee}
        ;;      payee-type (water, electric, sales tax, MUT etc)
        ;;  loop values in the payee table to find jurisdiction name and tax type(uincorporated Orange/MUT)
        ;;  insert pk's of the payee to a map with key{token#,payee-type} value {fk-payee}
        ;;on payment, use the token# & payee type composit key in the payee table
        ;; to get fk to payee and use it to get wallet of utilities & jurisdictions to be paid
        ;;  
        ;;
        ;;set up a payee such as a utiltiy company or jurisdicton and save thier wallet address and other info ppaakk
(define-public (test55)
     (ok (var-set last-id u55))
)

;;STEP 1: Set up all needed data and mint a few tokens        
(define-public (test)
    (begin
    ;;create needed parameters
    (set-parameter "electric" "electric" u0)
    (set-parameter "water" "water" u0)
    (set-parameter "natural-gas" "natural-gas" u0)
    (set-parameter "propane" "propane" u0)
    (set-parameter "MUT" "taxing-jurisdiction" u0)
    (set-parameter "GRT" "State" u0)
    (set-parameter "surtax" "State" u0)
    (set-parameter "sales-tax" "State" u0)
    (set-parameter "franchise" "County" u0)
    (set-parameter "CST" "County" u0)
    ;;create list of utilty companies and jurisdictions with thier wallets where tax will be recieved
    (map-insert payees u1 {wallet-owner-name: "Duke Energy", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u2 {wallet-owner-name: "Orange County Public Utilites", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u3 {wallet-owner-name: "Orlando Utility Corporaton", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u4 {wallet-owner-name: "City of Winter Park", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u5 {wallet-owner-name: "Lake Apopka Natura Gas District", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u6 {wallet-owner-name: "Amerigas Propane Inc", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u7 {wallet-owner-name: "Peoples Gas", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u8 {wallet-owner-name: "Gas South", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u9 {wallet-owner-name: "Florida Department of Revenue Sales Tax", wallet-address:  'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG, tax-rate-percent: u1000 } )
    (map-insert payees u10 {wallet-owner-name: "Florida Department of Revenue Gross Reciepts Tax", wallet-address:  'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC, tax-rate-percent: u1000 } )
    (map-insert payees u11 {wallet-owner-name: "Orange County Comptroller", wallet-address:  'ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND, tax-rate-percent: u1000 } )
    (map-insert payees u12 {wallet-owner-name: "Florida Department of Revenue Discretionary Surtax", wallet-address:  'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB, tax-rate-percent: u1000 } )
    (map-insert payees u13 {wallet-owner-name: "City of Ocoee", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u14 {wallet-owner-name: "City of Winter Garden", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u15 {wallet-owner-name: "City of Orlando", wallet-address:  'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB, tax-rate-percent: u1000 } )
    (print "finished setting up payees")
    (print (map-get? payees u1))
    ;;mint a token for a parcel
    (print "minting token")
    (try! (claim-and-save-all-data "2665 Hempel Ave, Windermere FL 34786"
            "292303018290011"
            "tdd"
            "28.78547748 -81.60528943"
            "//ipfs.io/ipfs/QmfVyamTcLr8WU1AcnGSK5iUshfksRB8woG3ZbTrHLuQVn?filename=322215233601403.json"
            'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
            "ORANGE_COUNTY_6"
            u24
            "Duke Energy"
            "Orange County Public Utilites"
            "Lake Apopka Natura Gas District"
            "Amerigas Propane Inc"
            "Florida Department of Revenue Sales Tax"
            "Orange County Comptroller"
            "Orange County Comptroller"))  

    (try! (claim-and-save-all-data "109 E Church St, Orlnado FL 32802"
            "292303018290011"
            "tdd"
            "28.78547748 -81.60528943"
            "//ipfs.io/ipfs/QmfVyamTcLr8WU1AcnGSK5iUshfksRB8woG3ZbTrHLuQVn?filename=322215233601403.json"
            'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
            "ORANGE_COUNTY_6"
            u24
            "Orlando Utility Corporaton"
            "Orlando Utility Corporaton"
            "Peoples Gas"
            "Amerigas Propane Inc"
            "Florida Department of Revenue Sales Tax"
            "Orange County Comptroller"
            "City of Orlando"))     
    (ok true)))

;;STEP 2:  Utility post bill due and customer remitts fund to pay bill
(define-public (test2)
    (begin
        ;;post utility bill for the newly created token
        ;;  this is the interface for the utility company where they will enter amounts due for the current 
        ;;  month or for unpaid billing periods
        ;;(try! (post-utility-bill u1 u100 u25 u100 u25 u6 u1 u2 u1 u0))
        (map-set utility-bills u1 {amt-due-electric: u100, amt-due-water: u25, amt-due-natural-gas: u100, amt-due-propane: u25,sales-tax: u6, GRT: u1, MUT: u2, surtax: u1, franchise: u0, pper: u202207 })    
        (let (
            (balance-due (utility-bill-amount-due u1)))
            (print (concat (concat "The balance-due on account is:  " (uint-to-string balance-due)) " microstacks"))
            ;;Customer pays the balance due on thier utility bill, customers funds saved in with token are increased by amount paid 
            (try! (recieve-payment  u1 balance-due))
            (print (concat (concat "Recieved payment from customer of:  " (uint-to-string balance-due)) " microstacks,  THANK YOU!!"))
            (ok balance-due))))

;;STEP 3:  The utilty company & jurisidictions recieve portions due
(define-public (test3) (distribute-funds-received u1 u202007))

;;STEP 4:  THe customer amount on deposit is decreased by bill amount and the utility bill is set to zero
(define-public (test4)
        (let (
            (balance-due (utility-bill-amount-due u1)))
            ;;the customers funds saved in with token are decreased by amount paid          
            (try! (decrease-customer-funds u1 balance-due)) ;;decrease token balances by amount paid
            ;;The customers bill amount due is set to zero
            (reset-utility-bill u1 u202007 )))

;; (define-public (test5) ;;this is just a watered-down distribute-funds-received
;;     (let (
;;         (balance-due (utility-bill-amount-due u1)))
;;          (let (
;;              (temp1 (map-get? utility-bills u1)))         
;;         ;; ;; (asserts! (is-some (get amt-due-electric temp1)) (err err-no-value))
;;         (begin             
;;             (let (
;;                 (temp2 (map-get? utility-bills u1)))         
;;                 (begin 
;;                     (try! (pay-wallet u1 (get amt-due-electric temp2) "electric"))
;;                   ;;  (try! (pay-wallet u1 (get amt-due-water temp2) "water"))
;;                     (try! (pay-wallet u1 (get sales-tax temp2) "sales-tax"))
;;                     (try! (pay-wallet u1 (get GRT temp2) "GRT"))
;;                     (try! (pay-wallet u1 (get MUT temp2) "MUT"))
;;                  ;;   (try! (pay-wallet u1 (get franchise temp2) "franchise"))
;;                     (try! (pay-wallet u1 (get surtax temp2) "surtax"))
;;                    ))
         
;;             ;;The utilty company & jurisidictions recieve portions due
;;             (unwrap! (distribute-funds-received u1) (err err-no-value))
;;          (ok balance-due)
;;          )
;;  )))

(define-public (test5)
    (begin
    ;;create needed parameters
    ;; (set-parameter "electric" "electric" u0)
    ;; (set-parameter "water" "water" u0)
    ;; (set-parameter "natural-gas" "natural-gas" u0)
    ;; (set-parameter "propane" "propane" u0)
    ;; (set-parameter "MUT" "taxing-jurisdiction" u0)
    ;; (set-parameter "GRT" "State" u0)
    ;; (set-parameter "surtax" "State" u0)
    ;; (set-parameter "sales-tax" "State" u0)
    ;; (set-parameter "franchise" "County" u0)
    ;; (set-parameter "CST" "County" u0)
    ;;create list of utilty companies and jurisdictions with thier wallets where tax will be recieved
    ;; (map-insert payees u1 {wallet-owner-name: "Duke Energy", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    ;; (map-insert payees u2 {wallet-owner-name: "Orange County Public Utilites", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u3 {wallet-owner-name: "Orlando Utility Corporaton", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u4 {wallet-owner-name: "City of Winter Park", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u5 {wallet-owner-name: "Lake Apopka Natura Gas District", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u6 {wallet-owner-name: "Amerigas Propane Inc", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u7 {wallet-owner-name: "Peoples Gas", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u8 {wallet-owner-name: "Gas South", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u9 {wallet-owner-name: "Florida Department of Revenue Sales Tax", wallet-address:  'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG, tax-rate-percent: u1000 } )
    (map-insert payees u10 {wallet-owner-name: "Florida Department of Revenue Gross Reciepts Tax", wallet-address:  'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC, tax-rate-percent: u1000 } )
    (map-insert payees u11 {wallet-owner-name: "Orange County Comptroller", wallet-address:  'ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND, tax-rate-percent: u1000 } )
    (map-insert payees u12 {wallet-owner-name: "Florida Department of Revenue Discretionary Surtax", wallet-address:  'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB, tax-rate-percent: u1000 } )
    (map-insert payees u13 {wallet-owner-name: "City of Ocoee", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u14 {wallet-owner-name: "City of Winter Garden", wallet-address:  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, tax-rate-percent: u1000 } )
    (map-insert payees u15 {wallet-owner-name: "City of Orlando", wallet-address:  'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB, tax-rate-percent: u1000 } )
    (print "finished setting up payees")
    (print (map-get? payees u1))
    ;;mint a token for a parcel
    (print "minting token")
    (try! (claim-and-save-all-data "2665 Hempel Ave, Windermere FL 34786"
            "292303018290011"
            "tdd"
            "28.78547748 -81.60528943"
            "//ipfs.io/ipfs/QmfVyamTcLr8WU1AcnGSK5iUshfksRB8woG3ZbTrHLuQVn?filename=322215233601403.json"
            'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
            "ORANGE_COUNTY_6"
            u24
            "Duke Energy"
            "Orange County Public Utilites"
            "Lake Apopka Natura Gas District"
            "Amerigas Propane Inc"
            "Florida Department of Revenue Sales Tax"
            "Orange County Comptroller"
            "Orange County Comptroller"))  

    (try! (claim-and-save-all-data "109 E Church St, Orlnado FL 32802"
            "292303018290011"
            "tdd"
            "28.78547748 -81.60528943"
            "//ipfs.io/ipfs/QmfVyamTcLr8WU1AcnGSK5iUshfksRB8woG3ZbTrHLuQVn?filename=322215233601403.json"
            'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
            "ORANGE_COUNTY_6"
            u24
            "Orlando Utility Corporaton"
            "Orlando Utility Corporaton"
            "Peoples Gas"
            "Amerigas Propane Inc"
            "Florida Department of Revenue Sales Tax"
            "Orange County Comptroller"
            "City of Orlando"))     
    (ok true)))



(define-public (set-synonymns)
    (begin 
    ;;create needed parameters
    (set-parameter "electric" "electric" u0)
    (set-parameter "water" "water" u0)
    (set-parameter "natural-gas" "natural-gas" u0)
    (set-parameter "propane" "propane" u0)
    (set-parameter "MUT" "taxing-jurisdiction" u0)
    (set-parameter "GRT" "State" u0)
    (set-parameter "surtax" "State" u0)
    (set-parameter "sales-tax" "State" u0)
    (set-parameter "franchise" "County" u0)
    (set-parameter "CST" "County" u0)
    (print "set synonymns")
    (ok true)))

(define-public (print-payee-token)
    (begin
    ;;(print (concat ( "u1 electric " (uint-to-string (unwrap! (map-get? payee-token {token-number: u1, payee-type: "electric"}) (u0))))))
    ;;(print (concat ( "u1 electric " (uint-to-string (map-get? payee-token {token-number: u1, payee-type: "electric"})))))
    (print "u1 electric ") (print (map-get? payee-token {token-number: u1, payee-type: "electric"}))
    (print "u1 water ") (print (map-get? payee-token {token-number: u1, payee-type: "water"}))
    (print "u1 taxing-jurisdiction ") (print (map-get? payee-token {token-number: u1, payee-type: "taxing-jurisdiction"}))
    (print "u1 County ") (print (map-get? payee-token {token-number: u1, payee-type: "County"}))
    (print "u1 State ") (print (map-get? payee-token {token-number: u1, payee-type: "State"}))
    ;; (print "u1 sales-tax ") (print (map-get? payee-token {token-number: u1, payee-type: "sales-tax"}))
    ;; (print "u1 GRT ") (print (map-get? payee-token {token-number: u1, payee-type: "GRT"}))
    ;; (print "u1 MUT ") (print (map-get? payee-token {token-number: u1, payee-type: "MUT"}))
    ;; (print "u1 surtax ") (print (map-get? payee-token {token-number: u1, payee-type: "surtax"}))
    (print "******************************************************************************")
    (print "u2 electric ") (print (map-get? payee-token {token-number: u2, payee-type: "electric"}))
    (print "u2 water ") (print (map-get? payee-token {token-number: u2, payee-type: "water"}))
    (print "u2 taxing-jurisdiction ") (print (map-get? payee-token {token-number: u1, payee-type: "taxing-jurisdiction"}))
    (print "u2 County ") (print (map-get? payee-token {token-number: u1, payee-type: "County"}))
     (print "u2 State ") (print (map-get? payee-token {token-number: u1, payee-type: "State"}))
    ;; (print "u2 sales-tax ") (print (map-get? payee-token {token-number: u2, payee-type: "sales-tax"}))
    ;; (print "u2 GRT ") (print (map-get? payee-token {token-number: u2, payee-type: "GRT"}))
    ;; (print "u2 MUT ") (print (map-get? payee-token {token-number: u2, payee-type: "MUT"}))
    ;; (print "u2 surtax ") (print (map-get? payee-token {token-number: u2, payee-type: "surtax"}))
    (print "******************************************************************************")
    (print "u3 electric ") (print (map-get? payee-token {token-number: u3, payee-type: "electric"}))
    (print "u3 water ") (print (map-get? payee-token {token-number: u3, payee-type: "water"}))
    (print "u3 sales-tax ") (print (map-get? payee-token {token-number: u3, payee-type: "sales-tax"}))
    (print "u3 GRT ") (print (map-get? payee-token {token-number: u3, payee-type: "GRT"}))
    (print "u3 MUT ") (print (map-get? payee-token {token-number: u3, payee-type: "MUT"}))
    (print "u3 surtax ") (print (map-get? payee-token {token-number: u3, payee-type: "surtax"}))
    (print "******************************************************************************")
    (print "u4 electric ") (print (map-get? payee-token {token-number: u4, payee-type: "electric"}))
    (print "u4 water ") (print (map-get? payee-token {token-number: u4, payee-type: "water"}))
    (print "u4 sales-tax ") (print (map-get? payee-token {token-number: u4, payee-type: "sales-tax"}))
    (print "u4 GRT ") (print (map-get? payee-token {token-number: u4, payee-type: "GRT"}))
    (print "u4 MUT ") (print (map-get? payee-token {token-number: u4, payee-type: "MUT"}))
    (print "u4 surtax ") (print (map-get? payee-token {token-number: u4, payee-type: "surtax"}))
    (print "******************************************************************************")
    (print "u5 electric ") (print (map-get? payee-token {token-number: u5, payee-type: "electric"}))
    (print "u5 water ") (print (map-get? payee-token {token-number: u5, payee-type: "water"}))
    (print "u5 sales-tax ") (print (map-get? payee-token {token-number: u5, payee-type: "sales-tax"}))
    (print "u5 GRT ") (print (map-get? payee-token {token-number: u5, payee-type: "GRT"}))
    (print "u5 MUT ") (print (map-get? payee-token {token-number: u5, payee-type: "MUT"}))
    (print "u5 surtax ") (print (map-get? payee-token {token-number: u5, payee-type: "surtax"}))
    (print "******************************************************************************")
    (print "u6 electric ") (print (map-get? payee-token {token-number: u6, payee-type: "electric"}))
    (print "u6 water ") (print (map-get? payee-token {token-number: u6, payee-type: "water"}))
    (print "u6 sales-tax ") (print (map-get? payee-token {token-number: u6, payee-type: "sales-tax"}))
    (print "u6 GRT ") (print (map-get? payee-token {token-number: u6, payee-type: "GRT"}))
    (print "u6 MUT ") (print (map-get? payee-token {token-number: u6, payee-type: "MUT"}))
    (print "u6 surtax ") (print (map-get? payee-token {token-number: u6, payee-type: "surtax"}))
    (ok true)
    )
)



