import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

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

    // Send email notification to cam@oneonethree.co.nz
    try {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Contact Form Submission</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <div style="background: white; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                <h2 style="margin-top: 0; color: #111827; font-size: 18px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
                  Contact Details
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #374151; width: 120px;">Name:</td>
                    <td style="padding: 8px 0; color: #111827;">${escapeHtml(name)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #374151;">Email:</td>
                    <td style="padding: 8px 0; color: #111827;">
                      <a href="mailto:${escapeHtml(email)}" style="color: #3b82f6; text-decoration: none;">${escapeHtml(email)}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #374151;">Subject:</td>
                    <td style="padding: 8px 0; color: #111827;">${escapeHtml(subject)}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background: white; padding: 20px; border-radius: 6px;">
                <h2 style="margin-top: 0; color: #111827; font-size: 18px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
                  Message
                </h2>
                <div style="color: #111827; white-space: pre-wrap; line-height: 1.8;">
                  ${escapeHtml(message).replace(/\n/g, '<br>')}
                </div>
              </div>
              
              <div style="margin-top: 20px; padding: 15px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px;">
                  <strong>Timestamp:</strong> ${new Date().toLocaleString('en-US', { 
                    dateStyle: 'long', 
                    timeStyle: 'short',
                    timeZone: 'UTC'
                  })}
                </p>
              </div>
              
              <div style="margin-top: 20px; text-align: center;">
                <a href="mailto:${escapeHtml(email)}?subject=Re: ${encodeURIComponent(subject)}" 
                   style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Reply to ${escapeHtml(name)}
                </a>
              </div>
            </div>
            <div style="margin-top: 20px; text-align: center; color: #6b7280; font-size: 12px;">
              <p>This email was sent from the Content Manager contact form.</p>
            </div>
          </body>
        </html>
      `;

      const emailResult = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Content Manager <onboarding@resend.dev>',
        to: 'cam@oneonethree.co.nz',
        replyTo: email,
        subject: `Contact Form: ${subject}`,
        html: emailHtml,
      });

      logger.info('Contact form email sent successfully', {
        emailId: emailResult.id,
        to: 'cam@oneonethree.co.nz',
        from: email,
      });
    } catch (emailError) {
      // Log email error but don't fail the request
      logger.error('Failed to send contact form email', {
        error: emailError,
        name,
        email,
        subject,
      });
      
      // If Resend API key is not configured, log a warning but continue
      if (!process.env.RESEND_API_KEY) {
        logger.warn('RESEND_API_KEY not configured. Email notification skipped.');
      }
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

// Helper function to escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

