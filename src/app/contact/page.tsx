"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, X, Mail, Phone, MapPin } from "lucide-react";
import { useEffect } from "react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string;
  company_name: string;
  role: string;
}

export default function ContactPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

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

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/features"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/contact"
                className="text-sm font-medium text-foreground hover:text-foreground transition-colors"
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

            {/* Mobile Menu Button */}
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

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <Link
                  href="/features"
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="/pricing"
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link
                  href="/contact"
                  className="block px-3 py-2 text-base font-medium text-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
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

      {/* Main Content */}
      <section className="py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
                Contact Us
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                Have a question or need help? We&apos;d love to hear from you. Get in touch and we&apos;ll respond as soon as possible.
              </p>
            </div>

            {/* Contact Information */}
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Get in Touch</CardTitle>
                    <CardDescription>
                      We&apos;re here to help with any questions you may have.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <Mail className="h-5 w-5 text-primary mt-1" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Email</p>
                        <a
                          href="mailto:cam@oneonethree.co.nz"
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          cam@oneonethree.co.nz
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <Phone className="h-5 w-5 text-primary mt-1" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Response Time</p>
                        <p className="text-sm text-muted-foreground">
                          We typically respond within 24 hours
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <MapPin className="h-5 w-5 text-primary mt-1" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Support Hours</p>
                        <p className="text-sm text-muted-foreground">
                          Monday - Friday, 9 AM - 5 PM
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Marketing Solutions Link */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground">
              See more marketing solutions at{" "}
              <a
                href="https://www.oneonethree.co.nz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline transition-colors"
              >
                www.oneonethree.co.nz
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-foreground">Content Manager</h3>
            </div>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <a
                href="https://www.oneonethree.co.nz/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy
              </a>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Terms
              </Link>
              <Link
                href="/contact"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Support
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border/40">
            <div className="flex flex-col md:flex-row items-center md:justify-between gap-4">
              <p className="text-center text-sm text-muted-foreground md:text-left">
                © 2024 Content Manager. All rights reserved.
              </p>
              <div className="flex flex-col items-center gap-2">
                <img
                  src="/oot-product-silver-1.png"
                  alt="OOT Digital Product"
                  className="h-16 w-auto object-contain rounded-[4px]"
                />
                <a
                  href="https://www.oneonethree.co.nz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base text-muted-foreground hover:text-foreground transition-colors"
                >
                  www.oneonethree.co.nz
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

