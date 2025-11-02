// AI Credit Package Configuration
// These are one-time payment packages for purchasing additional AI credits

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number; // in cents
  priceId: string; // Stripe Price ID
  description: string;
  popular?: boolean;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'small',
    name: 'Small Pack',
    credits: 50,
    price: 999, // $9.99
    priceId: process.env.NEXT_PUBLIC_STRIPE_CREDITS_50_PRICE_ID || '',
    description: 'Perfect for occasional use',
    popular: false,
  },
  {
    id: 'medium',
    name: 'Medium Pack',
    credits: 150,
    price: 2499, // $24.99
    priceId: process.env.NEXT_PUBLIC_STRIPE_CREDITS_150_PRICE_ID || '',
    description: 'Great value for regular users',
    popular: true,
  },
  {
    id: 'large',
    name: 'Large Pack',
    credits: 500,
    price: 7499, // $74.99
    priceId: process.env.NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID || '',
    description: 'Best for heavy users',
    popular: false,
  },
];

// Get package by ID
export function getCreditPackageById(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find(pkg => pkg.id === id);
}

// Get package by price ID
export function getCreditPackageByPriceId(priceId: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find(pkg => pkg.priceId === priceId);
}

// Format price for display
export function formatCreditPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

