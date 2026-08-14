import { Buffer } from "buffer";
import { encrypt } from "ecies-geth";
import {
  bytesToHex,
  encodeAbiParameters,
  hexToBytes,
  keccak256,
  stringToHex,
} from "viem";
import type { TeeInfo } from "@/lib/api";

export type InvoiceDraft = {
  amountMinor: string;
  currency: string;
  debtorName: string;
  dueDate: string;
  invoiceNumber: string;
};

export async function sealInvoice(draft: InvoiceDraft, tee: TeeInfo) {
  const normalized = {
    amountMinor: BigInt(draft.amountMinor).toString(),
    currency: draft.currency.trim().toUpperCase(),
    debtorName: draft.debtorName.trim(),
    dueDate: new Date(`${draft.dueDate}T00:00:00.000Z`),
    invoiceNumber: draft.invoiceNumber.trim(),
  };
  const dueDateSeconds = BigInt(Math.floor(normalized.dueDate.getTime() / 1000));
  const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = bytesToHex(nonceBytes);
  const invoiceId = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "string" },
        { type: "string" },
        { type: "string" },
        { type: "uint256" },
        { type: "uint64" },
      ],
      [
        stringToHex("CLEAT_INVOICE_V1", { size: 32 }),
        normalized.invoiceNumber,
        normalized.debtorName,
        normalized.currency,
        BigInt(normalized.amountMinor),
        dueDateSeconds,
      ],
    ),
  );
  const commitment = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }],
      [invoiceId, nonce],
    ),
  );
  const plaintext = new TextEncoder().encode(
    JSON.stringify({
      amountMinor: normalized.amountMinor,
      commitment,
      currency: normalized.currency,
      debtorName: normalized.debtorName,
      dueDate: Number(dueDateSeconds),
      invoiceNumber: normalized.invoiceNumber,
      nonce,
    }),
  );
  const publicKey = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(hexToBytes(tee.publicKey.x)),
    Buffer.from(hexToBytes(tee.publicKey.y)),
  ]);
  const encrypted = await encrypt(publicKey, Buffer.from(plaintext));

  return {
    authorization: {
      amountMinor: normalized.amountMinor,
      commitment,
      currency: normalized.currency,
      debtorName: normalized.debtorName,
      dueDate: normalized.dueDate.toISOString(),
      encryptedBlob: bytesToHex(encrypted),
      invoiceNumber: normalized.invoiceNumber,
    },
    commitment,
  };
}

export function invoiceAuthorizationMessage(input: {
  amountMinor: string;
  commitment: `0x${string}`;
  currency: string;
  debtorName: string;
  dueDate: string;
  encryptedBlob: `0x${string}`;
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
    `Ciphertext hash: ${keccak256(input.encryptedBlob)}`,
  ].join("\n");
}
