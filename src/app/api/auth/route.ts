import { NextRequest, NextResponse } from "next/server";

const PIN = "639263";
const COOKIE_NAME = "nt_session";
// 365 days in seconds
const MAX_AGE = 365 * 24 * 60 * 60;

export async function POST(req: NextRequest) {
  const { pin, action } = await req.json();

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return res;
  }

  if (pin === PIN) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, "authenticated", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    return res;
  }

  return NextResponse.json({ ok: false, error: "Wrong PIN" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const session = req.cookies.get(COOKIE_NAME);
  return NextResponse.json({ authenticated: session?.value === "authenticated" });
}
