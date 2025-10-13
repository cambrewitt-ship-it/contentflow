#!/bin/bash

# Test Authentication Protection
# This script helps verify that routes are properly protected

echo "🔐 Testing Authentication Protection"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="${1:-http://localhost:3000}"

echo "Testing against: $BASE_URL"
echo ""

# Test 1: Public routes should return 200
echo "✅ Test 1: Public routes (should be accessible)"
echo "---------------------------------------------"

PUBLIC_ROUTES=(
  "/"
  "/auth/login"
  "/auth/signup"
  "/pricing"
)

for route in "${PUBLIC_ROUTES[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" -L "$BASE_URL$route")
  if [ "$status" = "200" ]; then
    echo -e "${GREEN}✓${NC} $route - $status"
  else
    echo -e "${RED}✗${NC} $route - $status (Expected 200)"
  fi
done

echo ""
echo "⛔ Test 2: Protected routes (should redirect to login)"
echo "-------------------------------------------------------"

PROTECTED_ROUTES=(
  "/dashboard"
  "/profile"
  "/settings/profile"
  "/settings/billing"
  "/admin/migrate-images"
)

for route in "${PROTECTED_ROUTES[@]}"; do
  # Follow redirects and check final URL
  final_url=$(curl -s -L -o /dev/null -w "%{url_effective}" "$BASE_URL$route")
  
  if [[ "$final_url" == *"/auth/login"* ]]; then
    echo -e "${GREEN}✓${NC} $route - Redirected to login"
  else
    echo -e "${RED}✗${NC} $route - Did NOT redirect to login (went to: $final_url)"
  fi
done

echo ""
echo "🔑 Test 3: API routes (should return 401 without auth)"
echo "-------------------------------------------------------"

API_ROUTES=(
  "/api/clients"
  "/api/projects"
)

for route in "${API_ROUTES[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$route")
  if [ "$status" = "401" ]; then
    echo -e "${GREEN}✓${NC} $route - $status (Unauthorized as expected)"
  else
    echo -e "${YELLOW}⚠${NC} $route - $status (Expected 401)"
  fi
done

echo ""
echo "===================================="
echo "Test complete! ✨"
echo ""
echo "Manual test instructions:"
echo "1. Start your dev server: npm run dev"
echo "2. Log into your account"
echo "3. Copy your dashboard URL"
echo "4. Log out of your account"
echo "5. Try to access the dashboard URL you copied"
echo "6. You should be redirected to /auth/login"
echo "7. After logging in, you should be redirected back to the dashboard"

