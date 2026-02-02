"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { useAuth } from '../../../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

function SignupForm() {
  const searchParams = useSearchParams();
  const emailParam = searchParams?.get('email') || '';
  const priceId = searchParams?.get('priceId') || '';
  const redirectTo = searchParams?.get('redirectTo') || searchParams?.get('redirect') || '';
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { signUp, getAccessToken } = useAuth();
  const router = useRouter();

  // Update email when URL parameter changes
  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  // Password validation
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasUppercase && hasLowercase && hasNumber && password.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!isPasswordValid) {
      setError('Password must contain an uppercase letter, a lowercase letter, and a number');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!acceptedTerms) {
      setError('You must accept the Terms and Conditions to sign up');
      setLoading(false);
      return;
    }

    const { user, session, error } = await signUp(email, password, { firstName, lastName });
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (user) {
      // Account successfully created - fire GTM conversion tracking
      if (typeof window !== 'undefined' && window.dataLayer) {
        window.dataLayer.push({
          'event': 'signup_success',
          'user_id': user?.id, // optional: include sanitized user ID
          'signup_method': 'email' // or whatever method they used
        });
      }
      
      if (session) {
        // User is auto-confirmed and logged in
        // If priceId is present, start checkout automatically
        if (priceId) {
          setMessage('Account created successfully! Starting checkout...');
          try {
            const accessToken = getAccessToken();
            if (!accessToken) {
              throw new Error('No access token available');
            }

            const response = await fetch('/api/stripe/checkout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ priceId }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Failed to create checkout session');
            }

            // Redirect to Stripe Checkout
            if (data.url) {
              window.location.href = data.url;
              return;
            }
          } catch (checkoutError) {
            console.error('Checkout error:', checkoutError);
            setError('Account created, but failed to start checkout. Please try again from the pricing page.');
            setLoading(false);
            return;
          }
        } else {
          // No priceId, redirect normally
          setMessage('Account created successfully! Redirecting...');
          router.push(redirectTo || '/dashboard');
        }
      } else {
        // Email confirmation required
        setMessage('Check your email for a confirmation link!');
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>
            Sign up for Content Manager to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium">
                  First Name
                </label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium">
                  Last Name
                </label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Create a password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {/* Password Requirements */}
            <div className="text-xs space-y-0.5 px-2 py-1.5 bg-muted/30 rounded border border-muted">
              <p className="font-medium text-muted-foreground mb-1 text-xs">Password must contain:</p>
              <div className="space-y-0.5">
                <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <span className="text-sm">{hasUppercase ? '✓' : '○'}</span>
                  <span>Uppercase character</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLowercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <span className="text-sm">{hasLowercase ? '✓' : '○'}</span>
                  <span>Lowercase character</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <span className="text-sm">{hasNumber ? '✓' : '○'}</span>
                  <span>Number</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                className="mt-1"
              />
              <label
                htmlFor="terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I accept the{' '}
                <Link 
                  href="/terms" 
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  Terms and Conditions
                </Link>
              </label>
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
            {message && (
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                {message}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link 
              href={priceId ? `/auth/login?priceId=${encodeURIComponent(priceId)}&redirectTo=${encodeURIComponent(redirectTo || '/pricing')}` : '/auth/login'} 
              className="text-primary hover:underline"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
