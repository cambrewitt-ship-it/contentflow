"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function SocialTrends2026Page() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center">
              <Link href="/">
                <img src="/cm-logo.png" alt="CM Logo" className="h-20 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity" />
              </Link>
              <img src="/oot-product-silver-1.png" alt="OOT Digital Product" className="hidden md:block h-6 w-auto ml-4 object-contain rounded-[4px]" />
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
          <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">&larr; Back to Blog</Link>
        </div>
        <article>
          <header className="mb-10">
            <p className="text-sm font-medium text-primary mb-3">Strategy Guide</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-6">
              Social Trends Reshaping 2026: An AI-Powered Strategy Guide
            </h1>
            <div className="mb-8 rounded-xl overflow-hidden">
              <img src="/ai-socialmedia.png" alt="Social Media Trends 2026" className="w-full h-auto object-cover" />
            </div>
            <div className="mb-8 rounded-xl overflow-hidden">
              <img src="/ai-in-social-media-marketing.webp" alt="AI in Social Media Marketing" className="w-full h-auto object-cover" />
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/40 px-5 py-4">
              <p className="text-sm font-semibold text-foreground mb-1">Quick Answer</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                2026 social media marketing is defined by a shift from follower-led discovery to interest-led &ldquo;snowballs,&rdquo; where algorithms prioritise micro-behaviors like hover time and rewatches over vanity metrics. Key trends include social platforms doubling as search engines, the &ldquo;Authenticity Premium&rdquo; over polished ads, and the mandatory disclosure of AI-generated content. To thrive, brands must use AI to iterate content speed while maintaining a distinct, human brand voice.
              </p>
            </div>
          </header>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Why is social search replacing traditional search engines in 2026?
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              The buyer journey has shifted into a &ldquo;Search Everywhere&rdquo; paradigm. Buyers&mdash;especially Gen Z and Alpha&mdash;no longer start their journey on Google; instead, they search directly on TikTok, LinkedIn, and YouTube for feature comparisons and vendor reviews. Because social posts now rank in Google search results, optimising your captions with keyword-rich language and answering specific buyer questions is essential for appearing in AI-generated search summaries.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              How does the &ldquo;Authenticity Premium&rdquo; combat &ldquo;AI slop&rdquo;?
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              The 2026 market is saturated with &ldquo;AI slop&rdquo;&mdash;low-quality, uncurated output that triggers audience pushback. To stand out, brands are emphasising slight imperfections, &ldquo;Proof of Humanity,&rdquo; and employee advocacy. Data shows that audiences connect with people, not brand handles, making practitioner-led content far more effective than polished scripts.
            </p>
          </section>

          <div className="border-t border-border/40 pt-8 mt-10 space-y-4">
            <p className="text-sm font-semibold text-foreground">Related reading</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/blog/ai-automated-social-media" className="text-sm text-primary hover:underline">AI Automated Social Media: Moving Beyond AI Slop &rarr;</Link>
              <Link href="/blog/train-social-ai" className="text-sm text-primary hover:underline">How to Train Your Social Media AI for Brand Voice &rarr;</Link>
            </div>
            <div className="pt-4">
              <Link href="/auth/signup"><Button size="lg">Start Your Free Trial</Button></Link>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
