import { keccak256 } from "viem";

export const TEE_URL = process.env.EXT_PROXY_URL ?? "";
export const DIRECT_API_KEY = process.env.DIRECT_API_KEY ?? "";
export const CHAIN_URL =
  process.env.CHAIN_URL ?? "https://coston2-api.flare.network/ext/C/rpc";
export const INSTRUCTION_SENDER = (
  process.env.INSTRUCTION_SENDER ?? "0xb2289168d6B5d7823060d2eAC676d24917b3bEdC"
).toLowerCase();

export const COMMAND_SELECTORS = {
  check: "0x9016f88b",
  pledge: "0xfea1348d",
  release: "0xcd544fbc",
} as const;

export function isHash(value: string | undefined): value is `0x${string}` {
  return Boolean(value && /^0x[0-9a-fA-F]{64}$/.test(value));
}

export function isCiphertext(value: string | undefined): value is `0x${string}` {
  return Boolean(value && /^0x[0-9a-fA-F]+$/.test(value) && value.length <= 131_074);
}

export function invoiceAuthorizationMessage(input: {
  amountMinor: string;
  commitment: string;
  currency: string;
  debtorName: string;
  dueDate: string;
  encryptedBlob: string;
  invoiceNumber: string;
}) {
  return [
    "Cleat confidential invoice",
    `Invoice: ${input.invoiceNumber.trim()}`,
    `Debtor: ${input.debtorName.trim()}`,
    `Currency: ${input.currency.toUpperCase()}`,
    `Amount minor: ${input.amountMinor}`,
    `Due date: ${input.dueDate}`,
    `Commitment: ${input.commitment.toLowerCase()}`,
    `Ciphertext hash: ${keccak256(input.encryptedBlob as `0x${string}`)}`,
  ].join("\n");
}

export async function rpc<T>(method: string, params: unknown[]): Promise<T | null> {
  const response = await fetch(CHAIN_URL, {
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Coston2 RPC ${response.status}`);
  }
  const payload = (await response.json()) as {
    error?: { message?: string };
    result?: T | null;
  };
  if (payload.error) {
    throw new Error(payload.error.message ?? "Coston2 RPC error");
  }
  return payload.result ?? null;
}
