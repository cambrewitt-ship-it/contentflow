import type { Metadata } from 'next';

// Shared client reports are private links: keep them out of search engines.
export const metadata: Metadata = {
  title: 'Social media report',
  robots: { index: false, follow: false },
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
