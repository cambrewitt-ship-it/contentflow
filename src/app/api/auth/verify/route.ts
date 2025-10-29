import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_VERIFY_URL = 'https://limpakrfkywxiitvgvwh.supabase.co/auth/v1/verify';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Extract query parameters
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const redirectTo = searchParams.get('redirect_to');

    // Build the Supabase verification URL with query parameters
    const verifyUrl = new URL(SUPABASE_VERIFY_URL);
    
    if (token) {
      verifyUrl.searchParams.set('token', token);
    }
    
    if (type) {
      verifyUrl.searchParams.set('type', type);
    }
    
    if (redirectTo) {
      verifyUrl.searchParams.set('redirect_to', redirectTo);
    }

    // Redirect to Supabase verification endpoint
    return NextResponse.redirect(verifyUrl.toString());
  } catch (error) {
    // If anything goes wrong, redirect to a safe location (could be login page)
    console.error('Email verification redirect error:', error);
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}

