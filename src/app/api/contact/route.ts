import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { sendContactFormNotification } from '@/lib/emails';

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

    if (
      String(name).length > 200 ||
      String(email).length > 320 ||
      String(subject).length > 300 ||
      String(message).length > 10000
    ) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
    }

    // Notify the team inbox (SUPPORT_EMAIL); reply-to is the sender. No
    // auto-reply to the sender — this form is unauthenticated, so that would
    // let anyone use us to send mail to arbitrary addresses.
    const result = await sendContactFormNotification({
      name: String(name),
      email: String(email),
      subject: String(subject),
      message: String(message),
    });
    if (!result.success) {
      logger.error('Contact form notification failed', { error: result.error });
      return NextResponse.json(
        { error: 'Failed to send your message. Please try again later.' },
        { status: 500 }
      );
    }

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

