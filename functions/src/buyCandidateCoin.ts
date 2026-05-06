// Cloud Function: buyCandidateCoin
// Calls the buy-candidate-coin function on the house contract using micro-stacks

import { onCall, CallableRequest } from "firebase-functions/v2/https";
import { StacksMainnet, StacksTestnet } from "micro-stacks/network";
import { makeContractCall } from "micro-stacks/transactions";
import { principalCV, uintCV } from "micro-stacks/clarity";

// Replace with your contract details
const HOUSE_CONTRACT_ADDRESS = "ST2BZ3RGBBTR8JD5V07PSSD9VN6WHAARN0R0Y2YWG";
const HOUSE_CONTRACT_NAME = "houseFranchise";

export const buyCandidateCoin = onCall(async (request: CallableRequest<any>) => {
  const data = request.data;
  const context = request;
  // Require authentication
  if (!context.auth || !context.auth.uid) {
    throw new Error("Unauthenticated");
  }

  // Extract parameters
  const candidateId = Number(data.candidateId);
  const buyer = String(data.buyer); // principal string
  const amount = Number(data.amount);
  const price = Number(data.price);

  if (!candidateId || !buyer || !amount || !price) {
    throw new Error("Missing required parameters");
  }

  // Prepare contract call
  const functionArgs = [
    uintCV(candidateId),
    principalCV(buyer),
    uintCV(amount),
    uintCV(price)
  ];

  // Choose network
  const network = new StacksTestnet(); // or StacksMainnet()

  // Prepare transaction
  const txOptions = {
    contractAddress: HOUSE_CONTRACT_ADDRESS,
    contractName: HOUSE_CONTRACT_NAME,
    functionName: "buy-candidate-coin",
    functionArgs,
    network,
    postConditionMode: 1, // allow
    anchorMode: 1, // on-chain only
    senderKey: process.env.STACKS_PRIVATE_KEY || '', // Set securely
  };

  try {
    const tx = await makeContractCall(txOptions);
    return { success: true, txId: tx.txid };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
});
