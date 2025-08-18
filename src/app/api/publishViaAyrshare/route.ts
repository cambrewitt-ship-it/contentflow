// src/app/api/publishViaAyrshare/route.ts
// Replaced Ayrshare integration with LATE API for scheduling.
// TODO: later rename file to publishViaLate and remove Ayrshare libs.

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const LATE_KEY = process.env.LATE_API_KEY;
    if (!LATE_KEY) {
      return NextResponse.json({ error: "Missing LATE_API_KEY" }, { status: 500 });
    }

    const lateResp = await fetch("https://getlate.dev/api/v1/posts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await lateResp.json();
    return NextResponse.json(data, { status: lateResp.status });
  } catch (err: unknown) {
    console.error("publishViaLate error", err);
    return NextResponse.json(
      { error: "server error", details: String(err) },
      { status: 500 }
    );
  }
}
