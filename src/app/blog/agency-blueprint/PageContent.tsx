"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function AgencyBlueprintPage() {
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
            <p className="text-sm font-medium text-primary mb-3">Blueprint</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-6">
              The Agency Blueprint: Scaling Client Approvals and AI Workflows
            </h1>
            <div className="mb-8 rounded-xl overflow-hidden">
              <img src="/social-agency.png" alt="Social Media Agency Blueprint" className="w-full h-auto object-cover" />
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/40 px-5 py-4">
              <p className="text-sm font-semibold text-foreground mb-1">Quick Answer</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Agencies in 2026 scale by replacing manual task management with AI-supported workflows and centralised client portals. Successful teams utilise a &ldquo;Shared Client Workspace&rdquo; to automate approval loops, reducing labour costs while maintaining high quality. By integrating AI idea generation with structured human oversight, agencies can manage 50+ channels without headcount inflation.
              </p>
            </div>
          </header>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              How do AI workflows improve agency profit margins?
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Manual SEO and social management are no longer viable long-term. Modern &ldquo;AI Workflows&rdquo; automate the path from content ideation to monitoring, allowing human teams to focus on strategy. For a social media agency, using AI agents to flag errors and predict topic clusters allows for fixed-price, unlimited client tiers that outperform traditional per-user pricing models.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Why is the client approval portal the key to retention?
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Scaling often fails at the approval stage due to &ldquo;feedback pile-ons&rdquo;. Streamlining these loops through a single portal ensures all content is vetted against brand standards, creating a clear audit trail. This transparency builds the trust necessary to move from a tactical vendor to a strategic partner.
            </p>
          </section>

          <div className="border-t border-border/40 pt-8 mt-10 space-y-4">
            <p className="text-sm font-semibold text-foreground">Related reading</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/blog/train-social-ai" className="text-sm text-primary hover:underline">How to Train Your Social Media AI for Brand Voice Consistency &rarr;</Link>
              <Link href="/blog/ai-automated-social-media" className="text-sm text-primary hover:underline">AI Automated Social Media: Moving Beyond AI Slop &rarr;</Link>
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
