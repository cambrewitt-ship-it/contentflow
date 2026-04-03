"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

const posts = [
  {
    slug: "hootsuite-vs-content-manager",
    category: "Comparison",
    title: "Why Agencies are Switching: A Content-Manager.io vs. Hootsuite Comparison",
    excerpt:
      "Agencies are migrating to Content-Manager.io because it solves the \"Complexity Tax\" of traditional enterprise tools through a focus on brand-trained AI and unlimited client pricing.",
  },
  {
    slug: "train-social-ai",
    category: "Guide",
    title: "Beyond Prompts: How to Train Your Social Media AI for Brand Consistency",
    excerpt:
      "Training AI on your specific brand voice is the primary defense against generic \"AI slop\" in 2026. Learn how to move beyond simple prompting to models that reflect your unique brand truth.",
  },
  {
    slug: "agency-blueprint",
    category: "Blueprint",
    title: "The Agency Blueprint: Scaling Client Approvals and AI Workflows",
    excerpt:
      "Agencies in 2026 scale by replacing manual task management with AI-supported workflows and centralised client portals. Learn how a Shared Client Workspace can automate approval loops and let you manage 50+ channels without headcount inflation.",
  },
  {
    slug: "2026-social-trends",
    category: "Strategy Guide",
    title: "Social Trends Reshaping 2026: An AI-Powered Strategy Guide",
    excerpt:
      "2026 social media is defined by interest-led discovery, social platforms doubling as search engines, and the Authenticity Premium over polished ads. Learn how to use AI to stay ahead while keeping a distinct, human brand voice.",
  },
  {
    slug: "content-manager-vs-cloud-campaign",
    category: "Comparison",
    title: "Content-Manager.io vs. Cloud Campaign: Which is Best for Scaling Agencies in 2026?",
    excerpt:
      "Content-Manager.io offers unlimited client profiles for a flat $199/month and embeds Brand Voice AI into its core architecture. See how it compares to Cloud Campaign for agencies looking to scale without a per-profile pricing tax.",
  },
  {
    slug: "best-social-media-management-software",
    category: "Buyer's Guide",
    title: "The Best Social Media Management Software for 2026: A Strategic Buyer's Guide",
    excerpt:
      "The best SMM platforms in 2026 go far beyond scheduling. Discover which tools offer Brand Voice Training, Shared Client Workspaces, and Social SEO — and how to choose the right one for your agency.",
  },
  {
    slug: "ai-automated-social-media",
    category: "Guide",
    title: "AI Automated Social Media Management: Moving Beyond \"AI Slop\"",
    excerpt:
      "Generic AI content is now penalised by audiences and algorithms alike. Learn how Brand-Trained Intelligence and Human-Verified AI workflows help agencies automate 50+ channels without sacrificing voice consistency.",
  },
  {
    slug: "best-hootsuite-alternatives",
    category: "Comparison",
    title: "The Best Hootsuite Alternatives for 2026: Scale Your Agency for Less",
    excerpt:
      "Many agencies are migrating away from Hootsuite's per-user pricing model. Explore the top AI-native alternatives — including Content-Manager.io's flat-rate $199/month plan with unlimited client profiles.",
  },
];

export default function BlogContent() {
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

      {/* Blog index */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-3xl">
        <header className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">Blog</h1>
          <p className="text-base text-muted-foreground">Guides, comparisons, and insights for modern social media teams.</p>
        </header>

        <div className="space-y-8">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block group rounded-lg border border-border/60 bg-card p-6 hover:border-border transition-colors"
            >
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">{post.category}</p>
              <h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                {post.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{post.excerpt}</p>
              <p className="mt-4 text-sm font-medium text-primary">Read article &rarr;</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
