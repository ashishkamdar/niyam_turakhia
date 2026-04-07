import { NextResponse } from "next/server";
import { getPrices } from "@/lib/prices";
import { seedSampleData } from "@/lib/sample-data";

export async function GET() {
  seedSampleData();
  const prices = getPrices();
  return NextResponse.json(prices);
}
