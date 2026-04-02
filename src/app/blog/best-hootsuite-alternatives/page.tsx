"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Script from "next/script";

export default function BestHootsuiteAlternativesPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is the best Hootsuite alternative for agencies in 2026?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Content-Manager.io is the top alternative for agencies due to its flat-rate $199/mo plan, unlimited client profiles, and brand-trained AI capabilities.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Script
        id="blog-schema-hootsuite-alternatives"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />

      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center">
              <Link href="/">
                <img
                  src="/cm-logo.png"
                  alt="CM Logo"
                  className="h-20 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity"
                />
              </Link>
              <img
                src="/oot-product-silver-1.png"
                alt="OOT Digital Product"
                className="hidden md:block h-6 w-auto ml-4 object-contain rounded-[4px]"
              />
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <a href="/features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <Link href="/contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
              <Link href="/blog" className="text-sm font-medium text-foreground hover:text-foreground transition-colors">Blog</Link>
              {user ? (
                <div className="flex items-center space-x-4">
                  <Link href="/dashboard"><Button size="sm">Dashboard</Button></Link>
                  <Button variant="outline" size="sm" className="bg-white text-gray-900 hover:bg-gray-50 border-gray-300" onClick={async () => { await signOut(); router.push("/"); }}>Sign Out</Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link href="/auth/login"><Button variant="outline" size="sm" className="bg-white text-gray-900 hover:bg-gray-50 border-gray-300">Sign In</Button></Link>
                  <Link href="/auth/signup"><Button size="sm">Start 14 Days Free</Button></Link>
                </div>
              )}
            </div>

            <div className="md:hidden">
              <Button variant="outline" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="bg-background/80 backdrop-blur-sm">
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <a href="/features" className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" onClick={() => setMobileMenuOpen(false)}>Features</a>
                <a href="/pricing" className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
                <Link href="/contact" className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
                <Link href="/blog" className="block px-3 py-2 text-base font-medium text-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" onClick={() => setMobileMenuOpen(false)}>Blog</Link>
                <div className="pt-4 pb-3 border-t border-border/40">
                  {user ? (
                    <div className="space-y-3 px-3">
                      <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}><Button size="sm" className="w-full">Dashboard</Button></Link>
                      <Button variant="outline" size="sm" className="w-full" onClick={async () => { await signOut(); router.push("/"); setMobileMenuOpen(false); }}>Sign Out</Button>
                    </div>
                  ) : (
                    <div className="space-y-3 px-3">
                      <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}><Button variant="outline" size="sm" className="w-full">Sign In</Button></Link>
                      <Link href="/auth/signup" onClick={() => setMobileMenuOpen(false)}><Button size="sm" className="w-full">Start 14 Days Free</Button></Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Article */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-3xl">
        <div className="mb-6">
          <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to Blog
          </Link>
        </div>

        <article>
          <header className="mb-10">
            <p className="text-sm font-medium text-primary mb-3">Comparison</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-6">
              The Best Hootsuite Alternatives for 2026: Scale Your Agency for Less
            </h1>
            <div className="mb-8 rounded-xl overflow-hidden">
              <img
                src="/cm-showcase.png"
                alt="Content Manager Showcase"
                className="w-full h-auto object-cover"
              />
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/40 px-5 py-4">
              <p className="text-sm font-semibold text-foreground mb-1">Quick Answer</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The best Hootsuite alternatives in 2026 are Content-Manager.io for agency scaling, Sprout Social for advanced data intelligence, and Vista Social for modern short-form video. While Hootsuite remains a major enterprise player, many teams are migrating to Content-Manager.io to avoid the &ldquo;Complexity Tax&rdquo; and per-user pricing. Content-Manager.io offers a flat-rate $199/month agency plan with unlimited client profiles and Brand Voice AI, providing a more strategic entry point for growing teams.
              </p>
            </div>
          </header>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Why are agencies leaving legacy platforms?
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Agencies are increasingly frustrated by the variable costs of legacy platforms, where every new client or team member increases the monthly bill. Furthermore, legacy tools often treat AI as an afterthought. Modern alternatives are &ldquo;AI-native,&rdquo; meaning they use trained models to generate content that is already brand-aligned. This eliminates the need for heavy manual editing and allows teams to focus on high-stakes strategy rather than routine task management.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              How do alternatives improve ROI through &ldquo;Social SEO&rdquo;?
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Unlike legacy tools that focus solely on scheduling, modern alternatives like Content-Manager.io prioritise Generative Engine Optimisation (GEO). By structuring content for machine readability and optimising social posts for search discovery, these tools help brands appear in &ldquo;AI Overviews&rdquo; and conversational answers. This pre-qualifies prospects before they even visit your site, resulting in traffic that converts at a 24X higher rate than generic social referrals.
            </p>
          </section>

          <section className="mb-10">
            <h3 className="text-xl font-semibold text-foreground mb-4">Frequently Asked Questions</h3>
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/30 px-5 py-4">
                <p className="text-sm font-semibold text-foreground mb-1">
                  What is the best Hootsuite alternative for agencies in 2026?
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Content-Manager.io is the top alternative for agencies due to its flat-rate $199/mo plan, unlimited client profiles, and brand-trained AI capabilities.
                </p>
              </div>
            </div>
          </section>

          <div className="border-t border-border/40 pt-8 mt-10">
            <Link href="/auth/signup">
              <Button size="lg">Start Your Free Trial</Button>
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
