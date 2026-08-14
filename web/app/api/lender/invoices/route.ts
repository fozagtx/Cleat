import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET() {
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

  return NextResponse.json({
    invoices: rows.map((row) => ({
      commitment: row.commitments[0].commitment,
      id: row.id,
      invoiceNumber: row.invoiceNumber,
    })),
  });
}
