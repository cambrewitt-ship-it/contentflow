import { NextResponse } from 'next/server';

export async function GET() {
  console.log('=== PROJECTS TEST ENDPOINT CALLED ===');
  
  return NextResponse.json({ 
    success: true, 
    message: 'Projects API routing is working',
    timestamp: new Date().toISOString(),
    endpoint: '/api/projects/test'
  });
}
