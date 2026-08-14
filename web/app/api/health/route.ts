import { NextResponse } from "next/server";
import { TEE_URL } from "@/lib/server/cleat";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      database: true,
      ok: true,
      product: "cleat",
      protocolAuthority: "coston2",
      teeConfigured: Boolean(TEE_URL),
    });
  } catch {
    return NextResponse.json(
      {
        database: false,
        ok: false,
        product: "cleat",
        protocolAuthority: "coston2",
        teeConfigured: Boolean(TEE_URL),
      },
      { status: 503 },
    );
  }
}
