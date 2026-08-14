import type { Address } from "viem";

export const instructionSenderAddress =
  "0xb2289168d6B5d7823060d2eAC676d24917b3bEdC" satisfies Address;

export const instructionFee = BigInt(1_000_000);

export const instructionSenderAbi = [
  {
    inputs: [{ internalType: "bytes32", name: "_commitment", type: "bytes32" }],
    name: "sendCheck",
    outputs: [{ internalType: "bytes32", name: "requestId", type: "bytes32" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "_commitment", type: "bytes32" }],
    name: "sendPledge",
    outputs: [{ internalType: "bytes32", name: "requestId", type: "bytes32" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "_commitment", type: "bytes32" }],
    name: "sendRelease",
    outputs: [{ internalType: "bytes32", name: "requestId", type: "bytes32" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;
