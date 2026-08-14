import { NextResponse } from "next/server";
import { replayStoredSeals } from "@/lib/server/replay-seals";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  await replayStoredSeals();

  const rows = await prisma.invoice.findMany({
    include: {
      commitments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    where: { commitments: { some: {} } },
  });

  const invoices = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const invoiceNumber = row.invoiceNumber.trim();
    if (seen.has(invoiceNumber) || !row.commitments[0]) continue;
    seen.add(invoiceNumber);
    invoices.push({
      commitment: row.commitments[0].commitment,
      id: row.id,
      invoiceNumber,
    });
  }

  return NextResponse.json({ invoices });
}
