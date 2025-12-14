import { NextResponse } from 'next/server';
import { generateCSRFToken } from '@/lib/csrfProtection';
import logger from '@/lib/logger';

/**
 * CSRF Token Generation Endpoint
 * 
 * Generates and returns a CSRF token for client-side use.
 * The token is also set as an httpOnly cookie for additional security.
 * 
 * Usage:
 * 1. Frontend fetches from this endpoint on app load
 * 2. Token is stored in memory (not localStorage)
 * 3. Token is sent with all state-changing requests (POST, PUT, DELETE, PATCH)
 */
export async function GET() {
  try {
    const token = generateCSRFToken();
    
    const response = NextResponse.json({ 
      csrfToken: token,
      success: true 
    });
    
    // Set CSRF token as httpOnly cookie for double-submit pattern
    response.cookies.set('csrf-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600, // 1 hour (matches token expiration)
      path: '/',
    });
    
    logger.info('CSRF token generated successfully');
    
    return response;
  } catch (error) {
    logger.error('Error generating CSRF token:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate CSRF token',
        success: false 
      },
      { status: 500 }
    );
  }
}

