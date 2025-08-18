import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ key: process.env.LATE_API_KEY || "missing" });
}
