import { NextRequest, NextResponse } from "next/server";
import {
  COMMAND_SELECTORS,
  INSTRUCTION_SENDER,
  isHash,
  rpc,
} from "@/lib/server/cleat";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    command?: string;
    commitment?: string;
    txHash?: string;
  };
  const command = body.command?.toLowerCase() as
    | keyof typeof COMMAND_SELECTORS
    | undefined;
  if (!command || !(command in COMMAND_SELECTORS)) {
    return NextResponse.json({ error: "unknown command" }, { status: 400 });
  }
  if (!isHash(body.commitment) || !isHash(body.txHash)) {
    return NextResponse.json(
      { error: "commitment and txHash must be bytes32 values" },
      { status: 400 },
    );
  }

  try {
    let transaction: { input: string; to: string } | null = null;
    let receipt: { status: string } | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      [transaction, receipt] = await Promise.all([
        rpc<{ input: string; to: string }>("eth_getTransactionByHash", [body.txHash]),
        rpc<{ status: string }>("eth_getTransactionReceipt", [body.txHash]),
      ]);
      if (transaction && receipt) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
    if (!transaction || !receipt) {
      return NextResponse.json({ error: "Coston2 has not published this transaction yet" }, { status: 409 });
    }
    const expectedInput =
      `${COMMAND_SELECTORS[command]}${body.commitment.slice(2)}`.toLowerCase();
    const to = transaction.to?.toLowerCase() ?? "";
    const input = (transaction.input ?? "").toLowerCase();
    if (receipt.status !== "0x1") {
      return NextResponse.json({ error: "instruction reverted on Coston2" }, { status: 422 });
    }
    if (to !== INSTRUCTION_SENDER || input !== expectedInput) {
      return NextResponse.json(
        { error: "transaction does not match a successful Cleat instruction" },
        { status: 422 },
      );
    }

    const txHash = body.txHash.toLowerCase();
    const existing = await prisma.auditEvent.findFirst({ where: { txHash } });
    if (!existing) {
      await prisma.auditEvent.create({
        data: {
          commitment: body.commitment.toLowerCase(),
          event: command.toUpperCase(),
          result: "SUBMITTED",
          txHash,
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Coston2 transaction verification failed", error);
    return NextResponse.json(
      { error: "could not verify Coston2 transaction" },
      { status: 502 },
    );
  }
}
