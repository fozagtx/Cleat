import { getAddress, stringToHex, verifyMessage } from "viem";
import { NextRequest, NextResponse } from "next/server";
import {
  DIRECT_API_KEY,
  invoiceAuthorizationMessage,
  isCiphertext,
  isHash,
  TEE_URL,
} from "@/lib/server/cleat";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

type CreateInvoiceBody = {
  address?: string;
  amountMinor?: string;
  commitment?: string;
  currency?: string;
  debtorName?: string;
  dueDate?: string;
  encryptedBlob?: string;
  invoiceNumber?: string;
  signature?: `0x${string}`;
};

export async function GET() {
  const rows = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
  });
  const seen = new Set<string>();
  const invoices = [];
  for (const row of rows) {
    const invoiceNumber = row.invoiceNumber.trim();
    if (seen.has(invoiceNumber)) continue;
    seen.add(invoiceNumber);
    invoices.push({
      amountMinor: row.amountMinor.toString(),
      currency: row.currency,
      debtorName: row.debtorName,
      dueDate: row.dueDate.toISOString(),
      id: row.id,
      invoiceNumber,
    });
  }
  invoices.sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));

  return NextResponse.json({ invoices });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as CreateInvoiceBody;
  if (
    !body.address ||
    !body.amountMinor ||
    !body.currency ||
    !body.debtorName ||
    !body.dueDate ||
    !body.invoiceNumber ||
    !body.signature ||
    !isHash(body.commitment) ||
    !isCiphertext(body.encryptedBlob)
  ) {
    return NextResponse.json({ error: "invalid invoice payload" }, { status: 400 });
  }
  if (!TEE_URL || !DIRECT_API_KEY) {
    return NextResponse.json(
      { error: "confidential delivery is not configured" },
      { status: 503 },
    );
  }

  const {
    amountMinor: amountValue,
    commitment,
    currency,
    debtorName,
    dueDate: dueDateValue,
    encryptedBlob,
    invoiceNumber,
    signature,
  } = body;

  let address: `0x${string}`;
  let amountMinor: bigint;
  let dueDate: Date;
  try {
    address = getAddress(body.address);
    amountMinor = BigInt(amountValue);
    dueDate = new Date(dueDateValue);
    if (amountMinor <= 0n || Number.isNaN(dueDate.getTime())) {
      throw new Error("invalid terms");
    }
    const valid = await verifyMessage({
      address,
      message: invoiceAuthorizationMessage({
        amountMinor: amountValue,
        commitment,
        currency,
        debtorName,
        dueDate: dueDateValue,
        encryptedBlob,
        invoiceNumber,
      }),
      signature,
    });
    if (!valid) {
      return NextResponse.json({ error: "invalid borrower signature" }, { status: 401 });
    }
  } catch {
    return NextResponse.json(
      { error: "invalid invoice terms or signature" },
      { status: 400 },
    );
  }

  try {
    const direct = await fetch(`${TEE_URL.replace(/\/$/, "")}/direct`, {
      body: JSON.stringify({
        message: encryptedBlob,
        opCommand: stringToHex("SEAL", { size: 32 }),
        opType: stringToHex("CLEAT", { size: 32 }),
      }),
      headers: {
        "content-type": "application/json",
        "x-api-key": DIRECT_API_KEY,
      },
      method: "POST",
      signal: AbortSignal.timeout(10000),
    });
    if (!direct.ok) {
      const detail = await direct.text();
      throw new Error(`confidential delivery ${direct.status}: ${detail.slice(0, 160)}`);
    }

    const invoice = await prisma.$transaction(async (database) => {
      const borrower = await database.user.upsert({
        create: { address, role: "BORROWER" },
        update: {},
        where: { address },
      });
      return database.invoice.upsert({
        where: {
          borrowerId_invoiceNumber: {
            borrowerId: borrower.id,
            invoiceNumber: invoiceNumber.trim(),
          },
        },
        update: {
          amountMinor,
          currency: currency.toUpperCase(),
          debtorName: debtorName.trim(),
          dueDate,
          commitments: {
            create: {
              commitment: commitment.toLowerCase(),
              encryptedBlob: Buffer.from(encryptedBlob.slice(2), "hex"),
            },
          },
        },
        create: {
          amountMinor,
          borrowerId: borrower.id,
          commitments: {
            create: {
              commitment: commitment.toLowerCase(),
              encryptedBlob: Buffer.from(encryptedBlob.slice(2), "hex"),
            },
          },
          currency: currency.toUpperCase(),
          debtorName: debtorName.trim(),
          dueDate,
          invoiceNumber: invoiceNumber.trim(),
        },
      });
    });

    return NextResponse.json({ id: invoice.id, ok: true }, { status: 201 });
  } catch (error) {
    console.error("invoice sealing failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "invoice sealing failed" },
      { status: 502 },
    );
  }
}
