"use client";

import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
  ThreadsIcon,
} from "@/components/social-icons";
import { Plug, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string;
  company_name: string;
  role: string;
}

export default function FeaturesPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching profile:", error);
        }
        setProfile(data || null);
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    }

    fetchProfile();
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background">
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
              <a
                href="/#features"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </a>
              <a
                href="/pricing"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Pricing
              </a>
              <Link
                href="/contact"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Contact
              </Link>
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground">
                    Welcome, {profile?.username || profile?.full_name || user.email}
                  </span>
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white text-gray-900 hover:bg-gray-50 border-gray-300"
                    >
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button size="sm">Get Started FREE</Button>
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
                  href="/#features"
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

                <div className="pt-4 pb-3 border-t border-border/40">
                  {user ? (
                    <div className="space-y-3">
                      <div className="px-3 py-2">
                        <p className="text-sm text-muted-foreground">
                          Welcome, {profile?.username || profile?.full_name || user.email}
                        </p>
                      </div>
                      <div className="px-3">
                        <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                          <Button size="sm" className="w-full">
                            Dashboard
                          </Button>
                        </Link>
                      </div>
                      <div className="px-3">
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
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="px-3">
                        <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full bg-white text-gray-900 hover:bg-gray-50 border-gray-300"
                          >
                            Sign In
                          </Button>
                        </Link>
                      </div>
                      <div className="px-3">
                        <Link href="/auth/signup" onClick={() => setMobileMenuOpen(false)}>
                          <Button size="sm" className="w-full">
                            Get Started FREE
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      <section className="py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="text-center text-foreground">
              <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
                Features
              </h1>
              <h2 className="mt-4 text-4xl sm:text-5xl font-extrabold">
                Create, Approve & Schedule Content - Faster.
              </h2>
              <p className="mt-4 text-xl sm:text-2xl text-muted-foreground">
                Explore Content Manager&apos;s features
              </p>
            </div>

            <div className="relative mt-10">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-3xl" />
              <div className="relative bg-card border border-border rounded-3xl p-4 sm:p-6 shadow-2xl">
                <div className="flex flex-col lg:flex-row items-center lg:items-center gap-6 sm:gap-10">
                  <div className="w-full lg:max-w-md">
                    <div className="flex items-center justify-center lg:justify-start gap-4">
                      <div className="flex items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary/10 text-primary">
                        <Plug className="h-6 w-6 sm:h-7 sm:w-7" />
                      </div>
                      <h3 className="text-3xl sm:text-4xl font-semibold text-foreground leading-tight text-center lg:text-left">
                        Plug in Your Brand
                        <span className="block">Info and Voice</span>
                      </h3>
                    </div>
                  </div>
                  <img
                    src="/brand-info.png"
                    alt="Brand info configuration"
                    className="w-full lg:w-1/2 max-w-xl rounded-2xl shadow-xl"
                  />
                </div>
              </div>
            </div>

            <p className="mt-6 text-xl sm:text-2xl text-muted-foreground text-center max-w-3xl mx-auto">
              Enter in your brand&apos;s information, tone of voice, key messages and style guide. Our AI is trained on this - so every caption and idea feels authentically you.
            </p>

            <div className="mt-12 text-center text-foreground">
              <h2 className="text-4xl sm:text-5xl font-extrabold">
                Branded AI Copy Writer
              </h2>
              <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
                Upload an image and any relevant notes or instructions. Our AI copy writer will produce social media captions or email copy - specific to your content and tailored to your brand voice.
              </p>
              <p className="mt-2 text-base sm:text-lg text-muted-foreground">
                Your Branded AI Copy Writer is fully customizable.
              </p>
            </div>

            <div className="relative mt-10">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-3xl" />
              <div className="relative bg-card border border-border rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-2xl">
                <img
                  src="/content-suite-screenshot.png"
                  alt="Content Suite Screenshot"
                  className="w-full h-auto rounded-lg max-w-5xl mx-auto"
                />
              </div>
            </div>

            <div className="mt-12 text-center text-foreground">
              <h2 className="text-4xl sm:text-5xl font-extrabold">
                Branded Content Ideas Generator
              </h2>
              <p className="mt-4 text-xl leading-8 text-muted-foreground max-w-3xl mx-auto">
                Stuck on “What to post?” Generate post ideas instantly, aligned to your context and seasonality. Writer’s block becomes a thing of the past.
              </p>
            </div>

            <div className="relative mt-6">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-3xl" />
              <div className="relative bg-card border border-border rounded-2xl px-3 sm:px-4 py-3 sm:py-4 shadow-2xl">
                <img
                  src="/ideas-generator.png"
                  alt="Content Ideas Screenshot"
                  className="w-full h-auto rounded-lg max-w-4xl mx-auto"
                />
              </div>
            </div>

            <div className="mt-12">
              <div className="mx-auto max-w-4xl text-center">
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
                  One Click, Multi-Channel Scheduling
                </h2>
                <p className="text-lg sm:text-xl text-muted-foreground mb-8">
                  With one click, publish your social posts across Facebook, Instagram, Twitter/X, LinkedIn, TikTok, YouTube — all from one calendar. Spend less time posting, more time creating.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-8 items-center justify-items-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center transition-transform hover:scale-110">
                      <FacebookIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Facebook</span>
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center transition-transform hover:scale-110">
                      <InstagramIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Instagram</span>
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-black dark:bg-gray-800 flex items-center justify-center transition-transform hover:scale-110">
                      <TwitterIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Twitter</span>
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-blue-700 flex items-center justify-center transition-transform hover:scale-110">
                      <LinkedInIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">LinkedIn</span>
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-black dark:bg-gray-800 flex items-center justify-center transition-transform hover:scale-110">
                      <TikTokIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">TikTok</span>
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center transition-transform hover:scale-110">
                      <YouTubeIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">YouTube</span>
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-black dark:bg-gray-800 flex items-center justify-center transition-transform hover:scale-110">
                      <ThreadsIcon size={32} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Threads</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 text-center text-foreground">
              <h2 className="text-4xl sm:text-5xl font-bold">
                Shared Client Workspace
              </h2>
              <p className="mt-4 text-xl text-muted-foreground max-w-3xl mx-auto">
                Introducing our Client Portal - this provides a two-way workspace between you and your client, updated in real time.
              </p>
              <p className="mt-3 text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
                Build content calendars, get feedback and approval, and see fresh client content uploads - nothing gets lost in the email chain.
              </p>
            </div>

            <div className="relative mt-6">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-3xl" />
              <div className="relative bg-card border border-border rounded-2xl px-3 sm:px-4 py-3 sm:py-4 shadow-2xl">
                <img
                  src="/client-portal-screenshot.png"
                  alt="Client Portal Screenshot"
                  className="w-full h-auto rounded-lg max-w-5xl mx-auto"
                />
              </div>
            </div>

            <div className="mt-12 text-center text-foreground">
              <h2 className="text-3xl sm:text-5xl font-bold">
                Client Dashboard
              </h2>
              <p className="mt-4 text-xl text-muted-foreground max-w-3xl mx-auto">
                Keep on top of every client with their own dedicated dashboard.
              </p>
              <p className="mt-3 text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
                See real time updates from your client, review upcoming posts and store client specific information.
              </p>
            </div>

            <div className="relative mt-6">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-3xl" />
              <div className="relative bg-card border border-border rounded-2xl px-3 sm:px-4 py-3 sm:py-4 shadow-2xl">
                <img
                  src="/client-dashboard.png"
                  alt="Client Dashboard Screenshot"
                  className="w-full h-auto rounded-lg max-w-5xl mx-auto"
                />
              </div>
            </div>

            <div className="mt-20">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Ready to transform your social media workflow?
                </h2>
                <div className="mt-10 max-w-2xl mx-auto px-4">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full sm:flex-1 px-4 py-3 text-base rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
                    />
                    <Button
                      size="lg"
                      className="w-full sm:w-auto px-8 py-3 text-base whitespace-nowrap"
                      onClick={() => {
                        if (user) {
                          router.push("/dashboard");
                        } else {
                          const signupUrl = email
                            ? `/auth/signup?email=${encodeURIComponent(email)}`
                            : "/auth/signup";
                          router.push(signupUrl);
                        }
                      }}
                    >
                      Get Started FREE
                    </Button>
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-3">
                    Free forever. No credit card required.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-foreground">Content Manager</h3>
            </div>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </a>
              <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Support
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border/40">
            <div className="flex flex-col md:flex-row items-center md:justify-between gap-4">
              <p className="text-sm text-muted-foreground text-center md:text-left">
                © 2024 Content Manager. All rights reserved.
              </p>
              <img
                src="/oot-product-silver-1.png"
                alt="OOT Digital Product"
                className="h-16 w-auto object-contain rounded-[4px]"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

