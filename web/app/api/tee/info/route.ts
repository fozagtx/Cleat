import { NextResponse } from "next/server";
import { TEE_URL } from "@/lib/server/cleat";

export const runtime = "nodejs";

export async function GET() {
  if (!TEE_URL) {
    return NextResponse.json({ error: "TEE not configured" }, { status: 503 });
  }

  try {
    const response = await fetch(`${TEE_URL.replace(/\/$/, "")}/info`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`proxy ${response.status}`);

    const payload = (await response.json()) as {
      machineData?: {
        codeHash?: string;
        platform?: string;
        publicKey?: { x?: string; y?: string };
      };
    };
    const publicKey = payload.machineData?.publicKey;
    if (!publicKey?.x || !publicKey.y) {
      throw new Error("TEE public key missing");
    }

    return NextResponse.json({
      codeHash: payload.machineData?.codeHash,
      platform: payload.machineData?.platform,
      publicKey,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TEE info failed" },
      { status: 502 },
    );
  }
}
