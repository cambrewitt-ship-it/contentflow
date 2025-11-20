import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to fetch image as base64
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    // Already base64 data URL
    if (imageUrl.startsWith('data:image')) {
      return imageUrl;
    }

    // Fetch HTTP/HTTPS URLs and convert to base64
    if (imageUrl.startsWith('http')) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error('Failed to fetch image:', imageUrl);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      
      // Detect image type from URL or content
      let mimeType = 'image/jpeg';
      if (imageUrl.toLowerCase().endsWith('.png')) {
        mimeType = 'image/png';
      } else if (imageUrl.toLowerCase().endsWith('.gif')) {
        mimeType = 'image/gif';
      } else if (imageUrl.toLowerCase().endsWith('.webp')) {
        mimeType = 'image/webp';
      }
      
      return `data:${mimeType};base64,${base64}`;
    }

    return null;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

// Helper function to format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Helper function to format time
function formatTime(timeString: string): string {
  if (!timeString) return '';
  
  const timeParts = timeString.split(':');
  const hours = parseInt(timeParts[0]);
  const minutes = timeParts[1] || '00';
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  
  return `${hour12}:${minutes} ${ampm}`;
}

export async function POST(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { postIds, clientId } = body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json(
        { error: 'Post IDs are required' },
        { status: 400 }
      );
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // Fetch client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('Error fetching client:', clientError);
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Fetch posts data
    const { data: posts, error: postsError } = await supabase
      .from('calendar_scheduled_posts')
      .select('*')
      .in('id', postIds)
      .eq('client_id', clientId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (postsError || !posts || posts.length === 0) {
      console.error('Error fetching posts:', postsError);
      return NextResponse.json(
        { error: 'Posts not found' },
        { status: 404 }
      );
    }

    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Add header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Content Calendar', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(client.name, pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 8;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`,
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    );
    
    yPosition += 8;
    
    // Add line separator
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(15, yPosition, pageWidth - 15, yPosition);
    
    yPosition += 10;

    // Group posts by date
    const postsByDate: { [key: string]: typeof posts } = {};
    posts.forEach(post => {
      const dateKey = post.scheduled_date || 'No Date';
      if (!postsByDate[dateKey]) {
        postsByDate[dateKey] = [];
      }
      postsByDate[dateKey].push(post);
    });

    // Render posts grouped by date
    for (const [date, datePosts] of Object.entries(postsByDate)) {
      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }

      // Date header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(formatDate(date), 15, yPosition);
      yPosition += 8;

      // Render each post
      for (const post of datePosts) {
        // Check if we need a new page for this post
        const estimatedPostHeight = 40; // Minimum height needed for a post
        if (yPosition > pageHeight - estimatedPostHeight) {
          doc.addPage();
          yPosition = 20;
        }

        const startY = yPosition;
        const boxX = 15;
        const boxWidth = pageWidth - 30;
        const imageSize = 25; // 25mm square
        const imageX = boxX + 5;
        const imageY = yPosition + 5;

        // Try to add image
        let imageAdded = false;
        if (post.image_url) {
          try {
            const imageBase64 = await fetchImageAsBase64(post.image_url);
            if (imageBase64) {
              // Determine image format
              let format: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG';
              if (imageBase64.includes('image/png')) {
                format = 'PNG';
              } else if (imageBase64.includes('image/webp')) {
                format = 'WEBP';
              }
              
              doc.addImage(imageBase64, format, imageX, imageY, imageSize, imageSize);
              imageAdded = true;
            }
          } catch (error) {
            console.error('Error adding image to PDF:', error);
            // Draw placeholder rectangle
            doc.setFillColor(240, 240, 240);
            doc.rect(imageX, imageY, imageSize, imageSize, 'F');
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('Image', imageX + imageSize / 2, imageY + imageSize / 2, { align: 'center' });
          }
        }

        if (!imageAdded) {
          // Draw placeholder if no image
          doc.setFillColor(240, 240, 240);
          doc.rect(imageX, imageY, imageSize, imageSize, 'F');
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text('No Image', imageX + imageSize / 2, imageY + imageSize / 2, { align: 'center' });
        }

        // Post details (right side of image)
        const textX = imageX + imageSize + 5;
        const textWidth = boxWidth - imageSize - 15;
        let textY = imageY;

        // Time and Platform
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        
        let detailsText = '';
        if (post.scheduled_time) {
          detailsText += `⏰ ${formatTime(post.scheduled_time)}`;
        }
        if (post.platform) {
          detailsText += detailsText ? ` • ${post.platform}` : post.platform;
        }
        
        if (detailsText) {
          doc.text(detailsText, textX, textY + 4);
          textY += 6;
        }

        // Caption
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        
        const captionText = post.caption || 'No caption';
        const maxCaptionLength = 200;
        const truncatedCaption =
          captionText.length > maxCaptionLength
            ? captionText.substring(0, maxCaptionLength) + '...'
            : captionText;

        const captionLines = doc.splitTextToSize(truncatedCaption, textWidth);
        doc.text(captionLines, textX, textY + 4);
        textY += captionLines.length * 4 + 2;

        // Approval status
        if (post.approval_status) {
          doc.setFontSize(8);
          const statusColors: { [key: string]: [number, number, number] } = {
            approved: [16, 185, 129],
            rejected: [239, 68, 68],
            pending: [245, 158, 11],
            needs_attention: [249, 115, 22],
          };
          const statusColor = statusColors[post.approval_status] || [100, 100, 100];
          doc.setTextColor(...statusColor);
          doc.text(`Status: ${post.approval_status}`, textX, textY + 4);
          textY += 5;
        }

        // Calculate box height
        const boxHeight = Math.max(imageSize + 10, textY - startY + 5);

        // Draw post border
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.rect(boxX, startY, boxWidth, boxHeight);

        yPosition = startY + boxHeight + 5;
      }

      yPosition += 5; // Extra space between date groups
    }

    // Add page numbers to all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Generate PDF as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="content-calendar-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

