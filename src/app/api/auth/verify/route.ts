import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_VERIFY_URL = 'https://limpakrfkywxiitvgvwh.supabase.co/auth/v1/verify';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Build the Supabase verification URL with all query parameters
    const verifyUrl = new URL(SUPABASE_VERIFY_URL);
    
    // Pass all query parameters to the Supabase URL
    searchParams.forEach((value, key) => {
      verifyUrl.searchParams.set(key, value);
    });

    // Redirect to Supabase verification endpoint
    return NextResponse.redirect(verifyUrl.toString());
  } catch (error) {
    // If anything goes wrong, redirect to a safe location (could be login page)
    console.error('Email verification redirect error:', error);
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}

