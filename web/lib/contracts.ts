import type { Address } from "viem";

export const instructionSenderAddress =
  "0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE" satisfies Address;

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
