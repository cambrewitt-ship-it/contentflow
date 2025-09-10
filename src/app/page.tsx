import { Button } from "components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-foreground">Content Manager</h1>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              AI-Powered Social Media Management
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-3xl mx-auto">
              Upload content, generate captions with AI, and schedule posts across all platforms. 
              Built specifically for marketing agencies managing multiple clients.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">

              <Button size="lg" className="px-8 py-3 text-base" asChild>
                <a href="/dashboard">Get Started</a>
              </Button>
              <Button variant="outline" size="lg" className="px-8 py-3 text-base">
                Watch Demo
              </Button>
            </div>
          </div>
          
          {/* Hero Image/Illustration */}
          <div className="mt-16 mx-auto max-w-4xl">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-3xl"></div>
              <div className="relative bg-card border border-border rounded-2xl p-8 shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div className="h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                      <div className="text-blue-600 text-4xl">📸</div>
                    </div>
                    <div className="h-20 bg-muted rounded-lg"></div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                      <div className="text-green-600 text-2xl">✨</div>
                    </div>
                    <div className="h-32 bg-muted rounded-lg"></div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-20 bg-muted rounded-lg"></div>
                    <div className="h-32 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                      <div className="text-purple-600 text-4xl">📅</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything you need to manage social media content
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Streamline your social media workflow with AI-powered tools designed for marketing agencies.
            </p>
          </div>
          
          <div className="mt-16 mx-auto max-w-4xl">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <Card className="border-border/50 hover:border-border transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-blue-600 text-2xl">🤖</div>
                  </div>
                  <CardTitle>AI Caption Generation</CardTitle>
                  <CardDescription>
                    Automatically generate engaging captions for any image or video with our advanced AI technology.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Context-aware caption suggestions</li>
                    <li>• Brand voice customization</li>
                    <li>• Multiple caption variations</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/50 hover:border-border transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-green-600 text-2xl">👥</div>
                  </div>
                  <CardTitle>Client Management</CardTitle>
                  <CardDescription>
                    Organize content campaigns by client with brand-specific guidelines and approval workflows.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Client-specific brand guidelines</li>
                    <li>• Approval workflow management</li>
                    <li>• Content organization by client</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/50 hover:border-border transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-purple-600 text-2xl">📅</div>
                  </div>
                  <CardTitle>Smart Scheduling</CardTitle>
                  <CardDescription>
                    Drag-and-drop calendar scheduling across Instagram, Facebook, and LinkedIn with optimal timing.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Visual calendar interface</li>
                    <li>• Optimal posting times</li>
                    <li>• Multi-platform scheduling</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Ready to transform your social media workflow?
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Join thousands of marketing agencies using Content Manager to streamline their social media management.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button size="lg" className="px-8 py-3 text-base" asChild>
                <a href="/dashboard">Start Free Trial</a>
              </Button>
              <Button variant="outline" size="lg" className="px-8 py-3 text-base">
                Schedule Demo
              </Button>
            </div>
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
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Support
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border/40">
            <p className="text-sm text-muted-foreground text-center">
              © 2024 Content Manager. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
