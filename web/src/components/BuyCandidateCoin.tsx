import React, { useState } from 'react';
import { useOpenContractCall } from '@micro-stacks/react';
import { uintCV, principalCV, noneCV } from '@stacks/transactions';


const CONTRACT_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const CONTRACT_NAME = 'house-token';
const FUNCTION_NAME = 'transfer?';

interface BuyCandidateCoinProps {
  candidateAddress: string;
  userAddress: string;
}

export function BuyCandidateCoin({ candidateAddress, userAddress }: BuyCandidateCoinProps) {
  const [amount, setAmount] = useState<number>(1);
  const { openContractCall, isRequestPending } = useOpenContractCall();

  const handleBuy = async () => {
    await openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: FUNCTION_NAME,
      functionArgs: [
        uintCV(amount),
        principalCV(userAddress),
        principalCV(candidateAddress),
        noneCV()
      ],
      postConditions: [],
      onFinish: data => {
        alert('Transaction submitted! TxID: ' + data.txId);
      },
      onCancel: () => {
        alert('Transaction cancelled.');
      },
    });
  };

  return (
    <div>
      <input
        type="number"
        min="1"
        value={amount}
        onChange={e => setAmount(Number(e.target.value))}
        placeholder="Amount"
      />
      <button onClick={handleBuy} disabled={isRequestPending}>
        Buy Candidate Coin
      </button>
    </div>
  );
}
