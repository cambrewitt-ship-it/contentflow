import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const type = searchParams.get('type')
  
  if (!token || !type) {
    return NextResponse.redirect(new URL('/login?error=missing_token', request.url))
  }
  
  // Redirect to Supabase verification endpoint with your domain as redirect
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${token}&type=${type}&redirect_to=https://content-manager.io/`
  
  return NextResponse.redirect(verifyUrl)
}