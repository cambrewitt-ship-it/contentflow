import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ width: string; height: string }> }
) {
  try {
    const { width, height } = await params;
    const w = parseInt(width) || 100;
    const h = parseInt(height) || 100;
    
    const svg = `
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af" text-anchor="middle" dy=".3em">
          ${w}×${h}
        </text>
      </svg>
    `;
    
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    logger.error('Error generating placeholder:', error);
    return NextResponse.json({ error: 'Failed to generate placeholder' });
  }
}
