import { NextResponse } from "next/server";
import { getPrices } from "@/lib/prices";

export async function GET() {
  const prices = getPrices();
  return NextResponse.json(prices);
}
