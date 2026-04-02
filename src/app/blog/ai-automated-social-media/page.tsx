"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Script from "next/script";

export default function AIAutomatedSocialMediaPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Automate Social Media Without Losing Brand Voice",
    "step": [
      { "@type": "HowToStep", "text": "Train your AI model on historical brand content and style guides." },
      { "@type": "HowToStep", "text": "Use an AI Ideas Generator to create role-relevant topic clusters." },
      { "@type": "HowToStep", "text": "Implement a shared client portal for final human verification and approval." },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Script
        id="blog-schema-ai-automated"
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
            <p className="text-sm font-medium text-primary mb-3">Guide</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-6">
              AI Automated Social Media Management: Moving Beyond &ldquo;AI Slop&rdquo;
            </h1>
            <div className="mb-8 rounded-xl overflow-hidden">
              <img
                src="/ai-socialmedia.png"
                alt="AI Automated Social Media Management"
                className="w-full h-auto object-cover"
              />
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/40 px-5 py-4">
              <p className="text-sm font-semibold text-foreground mb-1">Quick Answer</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI automated social media management has evolved from generic text generation to Brand-Trained Intelligence. In 2026, the &ldquo;Authenticity Premium&rdquo; means that unedited, mass-produced content (&ldquo;AI slop&rdquo;) is rejected by audiences and algorithms. Leading platforms like Content-Manager.io solve this by training models on proprietary brand truth, allowing for high-speed content iteration that maintains human voice consistency. This &ldquo;Human-Verified AI&rdquo; approach ensures your content is accurate, citable, and trustworthy.
              </p>
            </div>
          </header>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              What is the &ldquo;Authenticity Premium&rdquo; in AI marketing?
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              As AI-generated articles now surpass human-written content in volume, audiences have developed &ldquo;scroll fatigue&rdquo; for polished, corporate output. The Authenticity Premium refers to the value algorithms and users place on content that feels real, practitioner-led, and imperfect. Automation must support, not replace, human storytelling. Tools that allow for &ldquo;Proof of Humanity&rdquo;&mdash;such as behind-the-scenes insights and employee advocacy&mdash;drive 5X higher conversion rates than generic AI feeds.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              How can agencies automate 50+ channels without headcount inflation?
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Scaling an agency requires moving from manual curation to Autonomous Marketing agents. By using a centralised platform with shared client portals, agencies can automate the path from content ideation to monitoring. This reduces labour costs by up to 40% while ensuring every post is vetted against brand standards. Integrated &ldquo;AI Content Ideas&rdquo; allow teams to maintain a 365-day content calendar that is automatically aligned with the client&rsquo;s unique voice and goals.
            </p>
          </section>

          <section className="mb-10">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              How to Automate Social Media Without Losing Brand Voice
            </h3>
            <ol className="space-y-3 list-decimal list-outside pl-5">
              <li className="text-base text-muted-foreground leading-relaxed">Train your AI model on historical brand content and style guides.</li>
              <li className="text-base text-muted-foreground leading-relaxed">Use an AI Ideas Generator to create role-relevant topic clusters.</li>
              <li className="text-base text-muted-foreground leading-relaxed">Implement a shared client portal for final human verification and approval.</li>
            </ol>
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
