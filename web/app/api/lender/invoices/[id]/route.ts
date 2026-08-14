import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const invoice = await prisma.invoice.findUnique({
    include: {
      commitments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    where: { id },
  });
  if (!invoice) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    commitment: invoice.commitments[0]?.commitment ?? null,
    disclosed: {
      amount: "NOT DISCLOSED",
      debtorName: "NOT DISCLOSED",
      invoiceNumber: "NOT DISCLOSED",
    },
    protocol: {
      eligible: null,
      reason: null,
      requestId: null,
      status: null,
      txHash: null,
    },
    termsShown: null,
  });
}
