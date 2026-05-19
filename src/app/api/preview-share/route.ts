import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseServer'
import logger from '@/lib/logger'

function generateToken(): string {
  // 10-char alphanumeric token from UUID bits
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10)
}

async function uploadImageToStorage(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  base64DataUrl: string,
  token: string,
  slot: 'image' | 'logo'
): Promise<string | null> {
  try {
    const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!matches) return null

    const mimeType = matches[1]
    const base64Data = matches[2]
    const buffer = Buffer.from(base64Data, 'base64')
    const ext = mimeType.split('/')[1]?.split('+')[0] || 'jpg'
    const path = `${token}/${slot}.${ext}`

    const { error } = await supabase.storage
      .from('preview-shares')
      .upload(path, buffer, { contentType: mimeType, upsert: true })

    if (error) {
      logger.error('Storage upload error:', error)
      return null
    }

    const { data } = supabase.storage.from('preview-shares').getPublicUrl(path)
    return data.publicUrl
  } catch (err) {
    logger.error('Image upload failed:', err)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      businessName,
      caption,
      headline,
      isAdvert,
      ctaText,
      selectedPlatform,
      postImage,
      logoPreview,
    } = body

    const supabase = createSupabaseAdmin()
    const token = generateToken()

    const [imageUrl, logoUrl] = await Promise.all([
      postImage ? uploadImageToStorage(supabase, postImage, token, 'image') : Promise.resolve(null),
      logoPreview ? uploadImageToStorage(supabase, logoPreview, token, 'logo') : Promise.resolve(null),
    ])

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const { error } = await supabase.from('preview_shares').insert({
      share_token: token,
      business_name: businessName || null,
      caption: caption || null,
      headline: headline || null,
      is_advert: isAdvert ?? false,
      cta_text: ctaText || 'Shop Now',
      selected_platform: selectedPlatform || 'facebook',
      image_url: imageUrl,
      logo_url: logoUrl,
      expires_at: expiresAt.toISOString(),
    })

    if (error) {
      logger.error('preview_shares insert error:', error)
      return NextResponse.json({ error: 'Failed to create share' }, { status: 500 })
    }

    return NextResponse.json({ token })
  } catch (err) {
    logger.error('POST /api/preview-share error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('preview_shares')
      .select('*')
      .eq('share_token', token)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Share not found or expired' }, { status: 404 })
    }

    return NextResponse.json({
      businessName: data.business_name,
      caption: data.caption,
      headline: data.headline,
      isAdvert: data.is_advert,
      ctaText: data.cta_text,
      selectedPlatform: data.selected_platform,
      imageUrl: data.image_url,
      logoUrl: data.logo_url,
    })
  } catch (err) {
    logger.error('GET /api/preview-share error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
