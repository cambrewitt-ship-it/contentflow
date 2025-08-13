# ContentFlow V2 - AI-Powered Social Media Management

A modern SaaS landing page for ContentFlow, an AI-powered social media management platform designed for marketing agencies and marketing managers.

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

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── globals.css          # Global styles and CSS variables
│   ├── layout.tsx           # Root layout with metadata
│   └── page.tsx             # Main landing page
├── components/
│   └── ui/                  # Shadcn/ui components
│       ├── button.tsx
│       └── card.tsx
└── lib/
    └── utils.ts             # Utility functions
```

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
