# Content Manager - AI-Powered Social Media Management

A modern SaaS landing page for Content Manager, an AI-powered social media management platform designed for marketing agencies and marketing managers.

## Features

- **Modern Design**: Clean, professional layout with blue/gray color scheme
- **Responsive**: Mobile-first design that works on all devices
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Utility-first CSS framework for rapid development
- **Shadcn/ui**: Modern component library for consistent UI
- **Inter Font**: Professional typography using Inter font family

## Tech Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: Modern component library
- **Inter Font**: Professional typography
- **Supabase**: Database and authentication
- **Meta Graph API**: Facebook and Instagram integration

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file with the following variables:
   ```bash
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_SUPABASE_SERVICE_ROLE=your_supabase_service_role_key
   
   # Meta API Configuration
   META_APP_ID=your_meta_app_id
   META_APP_SECRET=your_meta_app_secret
   META_PAGE_ID=your_facebook_page_id
   META_ACCESS_TOKEN=your_meta_access_token
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── api/                 # API routes
│   │   ├── ai/              # AI integration
│   │   ├── schedulePost/    # Post scheduling to Supabase
│   │   └── publishToMeta/   # Meta API integration
│   ├── dashboard/           # Client dashboard and scheduler
│   ├── globals.css          # Global styles and CSS variables
│   ├── layout.tsx           # Root layout with metadata
│   └── page.tsx             # Main landing page
├── components/
│   └── ui/                  # Shadcn/ui components
│       ├── button.tsx
│       └── card.tsx
└── lib/
    ├── store.ts             # Zustand state management
    └── utils.ts             # Utility functions
```

## Meta API Integration

The application includes a complete Meta API integration for scheduling posts to Facebook and Instagram:

### **API Endpoint**: `/api/publishToMeta`

**Supported Platforms**:
- **Instagram**: Creates media containers and schedules posts
- **Facebook**: Schedules posts directly to page feed
- **Both**: Schedules to both platforms simultaneously

**Required Environment Variables**:
- `META_APP_ID`: Your Meta App ID
- `META_APP_SECRET`: Your Meta App Secret
- `META_PAGE_ID`: Your Facebook Page ID
- `META_ACCESS_TOKEN`: Your Meta Access Token

**API Request Format**:
```json
{
  "postId": "string",
  "platform": "instagram" | "facebook" | "both",
  "caption": "string",
  "imageUrl": "string",
  "scheduledTime": "ISO string"
}
```

**Features**:
- ✅ Automatic media container creation for Instagram
- ✅ Scheduled publishing with Unix timestamp conversion
- ✅ Comprehensive error handling and logging
- ✅ Support for single platform or dual platform posting
- ✅ Detailed success/failure responses

## Landing Page Sections

1. **Navigation**: Clean header with logo and navigation links
2. **Hero Section**: Main headline, subheadline, and call-to-action buttons
3. **Features Section**: Three key features with detailed descriptions
4. **CTA Section**: Final call-to-action for conversion
5. **Footer**: Company information and legal links

## Design Features

- **Blue/Gray Color Scheme**: Professional and trustworthy
- **Inter Font**: Modern, readable typography
- **Smooth Animations**: Hover effects and transitions
- **Mobile Responsive**: Optimized for all screen sizes
- **Accessibility**: WCAG compliant design

## Customization

The landing page is built with customization in mind:

- **Colors**: Easily modify the color scheme in `globals.css`
- **Content**: Update text content in `page.tsx`
- **Components**: Add new Shadcn/ui components as needed
- **Styling**: Modify Tailwind classes for different looks

## Deployment

This project can be deployed to any platform that supports Next.js:

- **Vercel**: Recommended for Next.js applications
- **Netlify**: Static site generation
- **AWS Amplify**: Full-stack deployment
- **Railway**: Simple deployment

## License

This project is created for demonstration purposes.
# Force Vercel rebuild
# Force Vercel deployment
