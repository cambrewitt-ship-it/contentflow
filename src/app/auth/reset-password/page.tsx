"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { supabase } from '../../../lib/supabaseClient';
import { Eye, EyeOff } from 'lucide-react';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sessionEstablished, setSessionEstablished] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const hasAttemptedSession = useRef(false); // Prevent duplicate session attempts
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Prevent running this effect multiple times
    if (hasAttemptedSession.current) {
      console.log('⏭️ Session establishment already attempted, skipping');
      return;
    }
    
    hasAttemptedSession.current = true;
    
    // Check if we have the reset token in the hash fragment
    // Supabase sends password reset tokens in the URL hash (e.g., #type=recovery&access_token=...)
    const hash = window.location.hash;
    
    // Debug logging
    console.log('🔍 Password Reset Debug:');
    console.log('- Full URL:', window.location.href);
    console.log('- Hash:', hash || '(no hash found)');
    
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      console.log('- Type:', type || '(missing)');
      console.log('- Has Access Token:', !!accessToken);
      console.log('- Has Refresh Token:', !!refreshToken);
      
      // Store debug info for display
      setDebugInfo(`Hash found: ${!!hash}, Type: ${type || 'missing'}, Tokens: ${!!accessToken && !!refreshToken ? 'present' : 'missing'}`);

      if (type === 'recovery' && accessToken && refreshToken) {
        // We have valid recovery tokens - set the session
        const establishSession = async () => {
          try {
            console.log('🔐 Attempting to establish session...');
            
            // Clear the hash from URL BEFORE establishing session to prevent re-triggers
            window.history.replaceState(null, '', window.location.pathname);
            
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error('❌ Session establishment error:', sessionError);
              setError(`Failed to verify reset link: ${sessionError.message}`);
              setDebugInfo(`Error: ${sessionError.message}`);
              return;
            }

            if (data.session) {
              console.log('✅ Session established successfully');
              setSessionEstablished(true);
              setError('');
              setDebugInfo('Session established successfully');
            } else {
              console.error('❌ No session returned');
              setError('Invalid or expired reset link. Please request a new one.');
              setDebugInfo('No session returned from setSession');
            }
          } catch (err) {
            console.error('💥 Error establishing session:', err);
            setError('Failed to verify reset link. Please request a new one.');
            setDebugInfo(`Exception: ${err instanceof Error ? err.message : String(err)}`);
          }
        };

        establishSession();
      } else {
        // Invalid token format
        console.error('❌ Invalid token format');
        setError('Invalid or expired reset link. Please request a new one.');
        setDebugInfo(`Invalid format - Type: ${type}, Has tokens: ${!!accessToken && !!refreshToken}`);
      }
    } else {
      // No hash found - invalid or expired link
      console.error('❌ No hash fragment found in URL');
      setError('Invalid or expired reset link. Please request a new one.');
      setDebugInfo('No hash fragment in URL - did you click the link from the email?');
    }
  }, []);

  // Password validation
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasUppercase && hasLowercase && hasNumber && password.length >= 6;
  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!sessionEstablished) {
      setError('Please wait for the reset link to be verified.');
      setLoading(false);
      return;
    }

    if (!isPasswordValid) {
      setError('Password must be at least 6 characters and contain uppercase, lowercase, and a number');
      setLoading(false);
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Now update the password - session should already be established
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });
    
    if (updateError) {
      setError(updateError.message || 'Failed to update password. Please try again.');
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      // Sign out to clear the recovery session
      await supabase.auth.signOut();
      // Redirect to login after successful reset
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                Password updated successfully! Redirecting to login...
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter new password"
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
                {password && (
                  <div className="text-xs space-y-1">
                    <div className={hasUppercase ? 'text-green-600' : 'text-gray-500'}>
                      • Uppercase letter
                    </div>
                    <div className={hasLowercase ? 'text-green-600' : 'text-gray-500'}>
                      • Lowercase letter
                    </div>
                    <div className={hasNumber ? 'text-green-600' : 'text-gray-500'}>
                      • Number
                    </div>
                    <div className={password.length >= 6 ? 'text-green-600' : 'text-gray-500'}>
                      • At least 6 characters
                    </div>
                  </div>
                )}
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
                    placeholder="Confirm new password"
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
                {confirmPassword && passwordsMatch && (
                  <div className="text-xs text-green-600">
                    ✓ Passwords match
                  </div>
                )}
              </div>
              {error && (
                <div className="space-y-2">
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                    {error}
                  </div>
                  {process.env.NODE_ENV === 'development' && debugInfo && (
                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-md font-mono">
                      <strong>Debug:</strong> {debugInfo}
                    </div>
                  )}
                  {!sessionEstablished && (
                    <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-md">
                      <p className="font-semibold mb-2">How to test password reset:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Go to the login page</li>
                        <li>Click "Forgot your password?"</li>
                        <li>Enter your email and submit</li>
                        <li>Check your email inbox</li>
                        <li>Click the reset link in the email</li>
                      </ol>
                      <p className="mt-2 text-xs">Note: You cannot access this page directly without clicking the email link.</p>
                    </div>
                  )}
                </div>
              )}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !isPasswordValid || !passwordsMatch || !sessionEstablished}
              >
                {loading ? 'Updating...' : sessionEstablished ? 'Update Password' : 'Verifying link...'}
              </Button>
            </form>
          )}
          <div className="mt-6 text-center text-sm">
            <Link href="/auth/login" className="text-primary hover:underline">
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

