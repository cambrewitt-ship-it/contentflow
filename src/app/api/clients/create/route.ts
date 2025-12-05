import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiRequest } from '../../../../lib/validationMiddleware';
import { createClientSchema } from '../../../../lib/validators';
import { withClientLimitCheck, trackClientCreation } from '../../../../lib/subscriptionMiddleware';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';

// Function to create LATE profile
async function createLateProfile(clientName: string, brandInfo: {
  brand_color?: string;
  company_description?: string;
  brand_tone?: string;
  target_audience?: string;
  value_proposition?: string;
  website_url?: string;
}) {
  try {
    const lateApiKey = process.env.LATE_API_KEY;
    if (!lateApiKey) {
      throw new Error('LATE API key not configured');
    }

    // Build a comprehensive description using brand information
    let description = `Social media profile for ${clientName}`;
    
    if (brandInfo.company_description) {
      description += `\n\nAbout: ${brandInfo.company_description}`;
    }
    
    if (brandInfo.value_proposition) {
      description += `\n\nValue Proposition: ${brandInfo.value_proposition}`;
    }
    
    if (brandInfo.target_audience) {
      description += `\n\nTarget Audience: ${brandInfo.target_audience}`;
    }
    
    if (brandInfo.brand_tone) {
      description += `\n\nBrand Tone: ${brandInfo.brand_tone}`;
    }
    
    if (brandInfo.website_url) {
      description += `\n\nWebsite: ${brandInfo.website_url}`;
    }

    const requestBody = {
      name: clientName,
      description: description,
      color: brandInfo.brand_color || "#4ade80"
    };

const response = await fetch('https://getlate.dev/api/v1/profiles', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lateApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('LATE API error:', { status: response.status, statusText: response.statusText });
      throw new Error(`LATE API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Handle the nested response structure
    const profileId = data._id || data.profile?._id;

    if (!profileId) {
      logger.error('LATE API response missing _id field');
      throw new Error('LATE API response missing _id field');
    }

    return profileId;
  } catch (error) {
    logger.error('Error creating LATE profile:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    // SUBSCRIPTION: Check client limits
    const subscriptionCheck = await withClientLimitCheck(req);
    
    // Check if subscription check failed
    if (!subscriptionCheck.allowed) {
      logger.error('Subscription check failed:', subscriptionCheck.error);
      return NextResponse.json({ 
        error: subscriptionCheck.error || 'Client limit reached',
        details: subscriptionCheck.error
      }, { status: 403 });
    }
    
    // Validate that userId exists
    if (!subscriptionCheck.userId) {
      logger.error('User ID not found in subscription check');
      return NextResponse.json({ 
        error: 'User identification failed',
        details: 'Could not identify user for client creation'
      }, { status: 401 });
    }
    
    const userId = subscriptionCheck.userId;
    
    // SECURITY: Comprehensive input validation with Zod
    const validation = await validateApiRequest(req, {
      body: createClientSchema.extend({
        brand_color: z.string().optional(), // For LATE profile
        skipLateProfile: z.union([z.boolean(), z.string()]).optional().transform(v => v === 'true' || v === true), // Flag to skip LATE profile creation
      }),
      checkAuth: true, // Automatically validates auth token
      maxBodySize: 5 * 1024 * 1024, // 5MB limit for client creation
    });

    if (!validation.success) {
      logger.error('Validation failed');
      return validation.response;
    }

    const { body } = validation.data;
    if (!body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { 
      name, 
      company_description, 
      website_url, 
      brand_tone, 
      target_audience, 
      value_proposition, 
      caption_dos, 
      caption_donts,
      brand_voice_examples, // Add brand voice examples field
      region,
      timezone, // Add timezone field
      brand_color, // Add brand color field for LATE profile
      skipLateProfile // Flag to skip LATE profile creation for temp clients
    } = body as {
      name: string;
      company_description?: string;
      website_url?: string;
      brand_tone?: string;
      target_audience?: string;
      value_proposition?: string;
      caption_dos?: string;
      caption_donts?: string;
      brand_voice_examples?: string;
      region?: string;
      timezone?: string;
      brand_color?: string;
      skipLateProfile?: boolean;
    }
    
    // Try to create LATE profile first (unless skipped for temp clients)
    let lateProfileId = null;
    if (!skipLateProfile) {
      try {
        lateProfileId = await createLateProfile(name.trim(), {
          brand_color: brand_color,
          company_description: company_description,
          brand_tone: brand_tone,
          target_audience: target_audience,
          value_proposition: value_proposition,
          website_url: website_url
        });

      } catch (lateError) {
        logger.error('Failed to create LATE profile, continuing with client creation:', {
          error: lateError instanceof Error ? lateError.message : String(lateError)
        });

        // Don't fail the entire operation if LATE fails
      }
    }

    // Insert the new client with LATE profile ID and user association
    const { data: client, error: insertError } = await supabase
      .from('clients')
      .insert([
        {
          name: name.trim(),
          company_description: company_description?.trim() || null,
          website_url: website_url?.trim() || null,
          brand_tone: brand_tone || null,
          target_audience: target_audience?.trim() || null,
          value_proposition: value_proposition?.trim() || null,
          caption_dos: caption_dos?.trim() || null,
          caption_donts: caption_donts?.trim() || null,
          brand_voice_examples: brand_voice_examples || null, // Preserve formatting (line breaks, spacing) for brand voice examples
          region: region?.trim() || null, // Add region
          timezone: timezone || 'Pacific/Auckland', // Add timezone with default
          late_profile_id: lateProfileId, // Add LATE profile ID
          user_id: user.id, // Associate with authenticated user
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (insertError) {
      logger.error('Failed to create client:', { error: insertError.message });
      return NextResponse.json({ 
        error: 'Failed to create client', 
        details: insertError.message 
      }, { status: 500 });
    }

    // Track client creation for subscription usage
    await trackClientCreation(userId);

    return NextResponse.json({
      success: true,
      clientId: client.id,
      client: client,
      lateProfileId: lateProfileId, // Include LATE profile ID in response
      lateProfileCreated: !!lateProfileId // Boolean indicating if LATE profile was created
    });

  } catch (error: unknown) {
    logger.error('Error in clients/create route:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}