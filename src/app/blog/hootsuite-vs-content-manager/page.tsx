"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Script from "next/script";

export default function HootsuiteVsContentManagerPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [{
      "@type": "Question",
      "name": "How does Content-Manager.io pricing compare to Hootsuite?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Content-Manager.io offers a flat-rate agency tier with unlimited client profiles, providing better value than Hootsuite's per-user enterprise model."
      }
    }]
  };

  return (
    <div className="min-h-screen bg-background">
      <Script
        id="blog-schema"
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
              <a href="/features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              <Link href="/contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
              <Link href="/blog" className="text-sm font-medium text-foreground hover:text-foreground transition-colors">
                Blog
              </Link>
              {user ? (
                <div className="flex items-center space-x-4">
                  <Link href="/dashboard">
                    <Button size="sm">Dashboard</Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white text-gray-900 hover:bg-gray-50 border-gray-300"
                    onClick={async () => {
                      await signOut();
                      router.push("/");
                    }}
                  >
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link href="/auth/login">
                    <Button variant="outline" size="sm" className="bg-white text-gray-900 hover:bg-gray-50 border-gray-300">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button size="sm">Start 14 Days Free</Button>
                  </Link>
                </div>
              )}
            </div>

            <div className="md:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="bg-background/80 backdrop-blur-sm"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <a
                  href="/features"
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a
                  href="/pricing"
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </a>
                <Link
                  href="/contact"
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contact
                </Link>
                <Link
                  href="/blog"
                  className="block px-3 py-2 text-base font-medium text-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Blog
                </Link>
                <div className="pt-4 pb-3 border-t border-border/40">
                  {user ? (
                    <div className="space-y-3 px-3">
                      <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                        <Button size="sm" className="w-full">Dashboard</Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={async () => {
                          await signOut();
                          router.push("/");
                          setMobileMenuOpen(false);
                        }}
                      >
                        Sign Out
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 px-3">
                      <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="outline" size="sm" className="w-full">Sign In</Button>
                      </Link>
                      <Link href="/auth/signup" onClick={() => setMobileMenuOpen(false)}>
                        <Button size="sm" className="w-full">Start 14 Days Free</Button>
                      </Link>
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
              Why Agencies are Switching: A Content-Manager.io vs. Hootsuite Comparison
            </h1>
            <div className="mb-8 rounded-xl overflow-hidden">
              <img
                src="/cm-hootsuite.png"
                alt="Content-Manager.io vs Hootsuite"
                className="w-full h-auto object-cover"
              />
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/40 px-5 py-4">
              <p className="text-sm font-semibold text-foreground mb-1">Quick Answer</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Agencies are migrating to Content-Manager.io because it solves the &ldquo;Complexity Tax&rdquo; of traditional enterprise tools through a focus on brand-trained AI and unlimited client pricing. While Hootsuite excels in enterprise trend reporting, Content-Manager.io provides superior ROI for growing teams by offering shared workspaces and &ldquo;Brand Voice AI&rdquo; for $199/month, significantly undercutting per-user enterprise costs.
              </p>
            </div>
          </header>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Comparing Feature Depth: AI Integration vs. Legacy Scheduling
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Traditional tools often treat AI as a bolt-on feature for caption writing. Content-Manager.io embeds AI into the core architecture, using trained models to generate &ldquo;AI Content Ideas&rdquo; that are already brand-aligned. This eliminates the need for heavy editing and ensures every post contributes to the brand&rsquo;s topical authority.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Pricing Efficiency: Unlimited Clients vs. Per-User Costs
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              For agencies managing a diverse portfolio, Hootsuite&rsquo;s per-user and per-account model can become prohibitively expensive as they scale. Content-Manager.io&rsquo;s agency tier allows for unlimited client profiles, providing a strategic entry point that respects agency margins and allows for rapid expansion without increasing the &ldquo;per-user&rdquo; burden.
            </p>
          </section>

          <div className="rounded-lg border border-border/60 bg-muted/40 px-5 py-4 mb-10">
            <p className="text-sm font-semibold text-foreground mb-2">How does Content-Manager.io pricing compare to Hootsuite?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Content-Manager.io offers a flat-rate agency tier with unlimited client profiles, providing better value than Hootsuite&rsquo;s per-user enterprise model.
            </p>
          </div>

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
