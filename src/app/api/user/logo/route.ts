import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Get the authorization token from the request headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user's subscription tier (only allow professional and agency)
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('subscription_tier')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'Unable to verify subscription' },
        { status: 403 }
      );
    }

    if (!['professional', 'agency'].includes(subscription.subscription_tier)) {
      return NextResponse.json(
        { error: 'Company logo upload is only available for Freelancer and Agency plans. Upgrade your plan to access this feature.' },
        { status: 403 }
      );
    }

    const { imageData, filename } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Convert base64 to buffer and upload to Supabase Storage
    const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `company-logos/${user.id}-${Date.now()}-${safeName}`;

    const admin = createSupabaseAdmin();
    const { error: storageError } = await admin.storage
      .from('logos')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (storageError) {
      logger.error('❌ Storage upload failed:', storageError);
      return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
    }

    const { data: { publicUrl } } = admin.storage.from('logos').getPublicUrl(storagePath);

    // Update the user profile with the logo URL
    const { data: updatedProfile, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        company_logo_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      logger.error('❌ Error updating user profile with logo URL:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile with logo URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      logoUrl: publicUrl,
      profile: updatedProfile
    });
  } catch (error) {
    logger.error('❌ Error uploading company logo:', error);
    return NextResponse.json(
      { error: 'Failed to upload company logo' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get the authorization token from the request headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user's subscription tier (only allow professional and agency)
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('subscription_tier')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'Unable to verify subscription' },
        { status: 403 }
      );
    }

    if (!['professional', 'agency'].includes(subscription.subscription_tier)) {
      return NextResponse.json(
        { error: 'Company logo upload is only available for Freelancer and Agency plans.' },
        { status: 403 }
      );
    }

    // Update the user profile to remove the logo URL
    const { data: updatedProfile, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        company_logo_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      logger.error('❌ Error removing logo URL from profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to remove logo from profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile
    });
  } catch (error) {
    logger.error('❌ Error removing company logo:', error);
    return NextResponse.json(
      { error: 'Failed to remove company logo' },
      { status: 500 }
    );
  }
}

