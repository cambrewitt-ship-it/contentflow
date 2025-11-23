import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Log the contact form submission
    logger.info('Contact form submission received', {
      name,
      email,
      subject,
      messageLength: message.length,
      timestamp: new Date().toISOString(),
    });

    // TODO: Here you can add additional processing:
    // 1. Store in database (create a contact_submissions table)
    // 2. Send email notification using Resend, SendGrid, or similar
    // 3. Send to a CRM or ticketing system
    // 4. Add rate limiting to prevent spam

    // For now, we'll just log and return success
    // You can extend this to:
    // - Store in Supabase: const { data, error } = await supabase.from('contact_submissions').insert({...})
    // - Send email: await resend.emails.send({ from: '...', to: '...', subject: '...', html: '...' })

    return NextResponse.json(
      {
        success: true,
        message: 'Your message has been received. We will get back to you soon.',
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error processing contact form submission:', error);
    return NextResponse.json(
      { error: 'Failed to process your message. Please try again later.' },
      { status: 500 }
    );
  }
}

