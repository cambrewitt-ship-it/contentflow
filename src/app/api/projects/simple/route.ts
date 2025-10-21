import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Simple projects test route working',
    timestamp: new Date().toISOString()

}
