'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Check } from 'lucide-react';
import { CREDIT_PACKAGES, formatCreditPrice } from '@/lib/creditPackages';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/lib/contexts/CreditsContext';
import { cn } from '@/lib/utils';

interface BuyCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyCreditsDialog({ open, onOpenChange }: BuyCreditsDialogProps) {
  const { getAccessToken } = useAuth();
  const { refreshCredits } = useCredits();
  const [loadingPackageId, setLoadingPackageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async (creditPackage: typeof CREDIT_PACKAGES[0]) => {
    try {
      setLoadingPackageId(creditPackage.id);
      setError(null);

      const accessToken = getAccessToken();
      if (!accessToken) {
        setError('Please log in to purchase credits');
        return;
      }

      const response = await fetch('/api/stripe/credits/checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId: creditPackage.priceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to create checkout session');
      }

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Purchase error:', err);
      setError(err instanceof Error ? err.message : 'Failed to purchase credits');
      setLoadingPackageId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Buy AI Credits
          </DialogTitle>
          <DialogDescription>
            Purchase additional AI credits to continue generating captions and content.
            Credits never expire and can be used anytime.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {CREDIT_PACKAGES.map((pkg) => {
            const isLoading = loadingPackageId === pkg.id;
            return (
              <Card
                key={pkg.id}
                className={cn(
                  'p-6 relative cursor-pointer transition-all hover:shadow-lg',
                  pkg.popular && 'ring-2 ring-purple-500'
                )}
              >
                {pkg.popular && (
                  <Badge className="absolute top-2 right-2 bg-purple-600">
                    Popular
                  </Badge>
                )}
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold mb-1">{pkg.credits}</div>
                  <div className="text-sm text-gray-600">Credits</div>
                  <div className="text-3xl font-bold mt-4 mb-2">
                    {formatCreditPrice(pkg.price)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatCreditPrice(Math.round(pkg.price / pkg.credits))} per credit
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-4 text-center">
                  {pkg.description}
                </div>
                <Button
                  className="w-full"
                  onClick={() => handlePurchase(pkg)}
                  disabled={isLoading || !pkg.priceId}
                  variant={pkg.popular ? 'default' : 'outline'}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Buy Now
                    </>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-gray-500 text-center">
            Credits are added to your monthly limit and never expire.
            You'll be redirected to Stripe for secure payment processing.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

