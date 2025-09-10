# Brand Information System - Content Manager

## Overview
The Brand Information System enhances Content Manager by allowing AI to generate more contextual and on-brand captions based on client brand guidelines, company information, and website content analysis.

## Features Implemented

### 1. Enhanced Client Information
- **Company Description**: Detailed company mission, values, and business description
- **Website URL**: Client website for content analysis
- **Brand Tone**: Predefined tone options (professional, casual, luxury, etc.)
- **Target Audience**: Specific audience demographics and characteristics
- **Industry**: Business sector classification
- **Brand Keywords**: Key terms and concepts associated with the brand

### 2. Brand Document Management
- **File Upload**: Support for PDF, Word documents (.doc, .docx), and text files
- **File Processing**: Automatic text extraction and storage
- **Status Tracking**: Processing status (pending, processing, completed, failed)
- **Storage**: Secure file storage in Supabase Storage

### 3. Website Content Analysis
- **Web Scraping**: Automatic extraction of website content
- **Content Analysis**: Page titles, meta descriptions, and main content
- **Caching**: 24-hour cache for repeated analysis
- **Error Handling**: Graceful failure handling and status tracking

### 4. AI Integration Ready
- **Brand Insights**: Database structure for AI-generated brand analysis
- **Context Awareness**: All brand information available for AI caption generation
- **Scalable**: Easy to extend with additional AI features

## Database Schema

### New Tables Created
1. **brand_documents**: Stores uploaded brand materials
2. **website_scrapes**: Stores scraped website content
3. **brand_insights**: Stores AI-generated brand analysis

### Enhanced Tables
1. **clients**: Added brand information fields

## API Endpoints

### Client Management
- `POST /api/clients/create` - Enhanced with brand fields
- `GET /api/clients/[clientId]` - Returns brand information
- `PUT /api/clients/[clientId]` - Updates brand information

### Brand Documents
- `POST /api/clients/[clientId]/brand-documents` - Upload documents
- `GET /api/clients/[clientId]/brand-documents` - List documents

### Website Scraping
- `POST /api/clients/[clientId]/scrape-website` - Scrape website
- `GET /api/clients/[clientId]/scrape-website` - List scrapes

## Setup Instructions

### 1. Database Setup
Run the SQL commands in `brand-information-schema.sql`:
```bash
# Connect to your Supabase database and run:
\i brand-information-schema.sql
```

### 2. Supabase Storage
Create a new storage bucket called `brand-documents`:
```sql
-- In Supabase dashboard or SQL editor:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand-documents', 'brand-documents', true);
```

### 3. Storage Policies
Ensure proper RLS policies are in place for the storage bucket.

### 4. Environment Variables
No additional environment variables required beyond existing Supabase setup.

## Usage

### 1. Create New Client
When creating a new client, fill in the brand information fields:
- Company description
- Website URL
- Brand tone selection
- Target audience
- Industry
- Brand keywords

### 2. Upload Brand Documents
- Navigate to client dashboard
- Use the file upload area in the Brand Documents section
- Supported formats: PDF, DOC, DOCX, TXT
- Maximum file size: 10MB

### 3. Analyze Website
- Enter website URL in the brand information
- Click "Scrape" button to analyze website content
- Content is automatically extracted and stored

### 4. View Brand Information
All brand information is displayed in an organized panel:
- Editable brand fields
- Document management
- Website analysis results

## Next Steps for AI Integration

### 1. Document Processing
- Implement background processing for text extraction
- Add support for more document formats
- Implement OCR for image-based documents

### 2. AI Enhancement
- Integrate brand information into AI caption generation
- Create brand-aware content suggestions
- Implement brand consistency scoring

### 3. Advanced Features
- Brand guideline versioning
- Competitor analysis
- Brand performance metrics

## Technical Notes

### File Processing
Currently, documents are uploaded and stored but not automatically processed. Text extraction will be implemented in the next phase.

### Web Scraping
Uses basic HTML parsing for content extraction. More sophisticated parsing can be added later.

### Performance
- Website scraping is cached for 24 hours
- File uploads are limited to 10MB
- Database queries are optimized with proper indexing

## Troubleshooting

### Common Issues
1. **File Upload Fails**: Check file size and format
2. **Website Scraping Errors**: Verify URL accessibility and format
3. **Database Errors**: Ensure schema is properly applied

### Debug Information
Check browser console and server logs for detailed error information.

## Contributing
This system is designed to be extensible. New brand information fields, document types, and AI features can be easily added following the existing patterns.
