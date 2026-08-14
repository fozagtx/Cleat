import { PrismaClient } from "@prisma/client";
import { Buffer } from "buffer";
import { encrypt } from "ecies-geth";
import {
  bytesToHex,
  encodeAbiParameters,
  hexToBytes,
  keccak256,
  stringToHex,
} from "viem";

const TEE_URL = (process.env.EXT_PROXY_URL ?? "").replace(/\/$/, "");
const DIRECT_API_KEY = process.env.DIRECT_API_KEY ?? "";
const BORROWER = "0x1111111111111111111111111111111111111111";

const drafts = [
  {
    invoiceNumber: "INV-441",
    debtorName: "Northwind Trading",
    currency: "USD",
    amountMinor: "4200000",
    dueDate: "2026-12-15",
  },
  {
    invoiceNumber: "INV-882",
    debtorName: "Harbor Goods",
    currency: "EUR",
    amountMinor: "18500000",
    dueDate: "2026-11-01",
  },
];

async function teeInfo() {
  const response = await fetch(`${TEE_URL}/info`);
  if (!response.ok) throw new Error(`TEE /info ${response.status}`);
  const body = await response.json();
  const key = body.publicKey ?? body.teeInfo?.publicKey ?? body.machineData?.publicKey;
  if (!key?.x || !key?.y) throw new Error("TEE public key missing");
  return { publicKey: key };
}

async function seal(draft, tee) {
  const dueDate = new Date(`${draft.dueDate}T00:00:00.000Z`);
  const dueDateSeconds = BigInt(Math.floor(dueDate.getTime() / 1000));
  const nonce = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
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
        draft.invoiceNumber,
        draft.debtorName,
        draft.currency,
        BigInt(draft.amountMinor),
        dueDateSeconds,
      ],
    ),
  );
  const commitment = keccak256(
    encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [invoiceId, nonce]),
  );
  const plaintext = new TextEncoder().encode(
    JSON.stringify({
      amountMinor: draft.amountMinor,
      commitment,
      currency: draft.currency,
      debtorName: draft.debtorName,
      dueDate: Number(dueDateSeconds),
      invoiceNumber: draft.invoiceNumber,
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
    commitment,
    dueDate,
    encryptedBlob: bytesToHex(encrypted),
  };
}

async function deliver(encryptedBlob) {
  const response = await fetch(`${TEE_URL}/direct`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": DIRECT_API_KEY,
    },
    body: JSON.stringify({
      message: encryptedBlob,
      opCommand: stringToHex("SEAL", { size: 32 }),
      opType: stringToHex("CLEAT", { size: 32 }),
    }),
  });
  const detail = await response.text();
  if (!response.ok) throw new Error(`SEAL ${response.status}: ${detail.slice(0, 200)}`);
}

async function main() {
  if (!process.env.DATABASE_URL || !TEE_URL || !DIRECT_API_KEY) {
    throw new Error("DATABASE_URL, EXT_PROXY_URL, and DIRECT_API_KEY are required");
  }
  const tee = await teeInfo();
  const prisma = new PrismaClient();
  const borrower = await prisma.user.upsert({
    where: { address: BORROWER },
    create: { address: BORROWER, role: "BORROWER" },
    update: {},
  });

  for (const draft of drafts) {
    const sealed = await seal(draft, tee);
    await deliver(sealed.encryptedBlob);
    await prisma.invoice.upsert({
      where: {
        borrowerId_invoiceNumber: {
          borrowerId: borrower.id,
          invoiceNumber: draft.invoiceNumber,
        },
      },
      update: {
        amountMinor: BigInt(draft.amountMinor),
        currency: draft.currency,
        debtorName: draft.debtorName,
        dueDate: sealed.dueDate,
        commitments: {
          create: {
            commitment: sealed.commitment.toLowerCase(),
            encryptedBlob: Buffer.from(sealed.encryptedBlob.slice(2), "hex"),
          },
        },
      },
      create: {
        amountMinor: BigInt(draft.amountMinor),
        borrowerId: borrower.id,
        currency: draft.currency,
        debtorName: draft.debtorName,
        dueDate: sealed.dueDate,
        invoiceNumber: draft.invoiceNumber,
        commitments: {
          create: {
            commitment: sealed.commitment.toLowerCase(),
            encryptedBlob: Buffer.from(sealed.encryptedBlob.slice(2), "hex"),
          },
        },
      },
    });
    console.log(`seeded ${draft.invoiceNumber}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
