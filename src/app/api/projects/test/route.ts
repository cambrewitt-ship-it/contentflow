import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function GET() {

  return NextResponse.json({ 
    success: true, 
    message: 'Projects API routing is working',
    timestamp: new Date().toISOString(),
    endpoint: '/api/projects/test'
  });
}
