import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    activity: rows.map((row) => ({
      at: row.createdAt.toISOString(),
      commitment: row.commitment,
      event: row.event,
      id: row.id,
      result: row.result,
      txHash: row.txHash,
    })),
  });
}
