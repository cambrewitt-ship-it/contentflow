# AI Credit Tracking Analysis

## 📋 Files Where Credits Are Tracked or Modified

### 1. **Main Credit Tracking Functions**

#### `src/lib/subscriptionMiddleware.ts`
- **Function:** `trackAICreditUsage(userId: string, creditsUsed: number = 1)`
- **Purpose:** Increments `ai_credits_used_this_month` in subscriptions table
- **How it works:**
  1. Fetches current subscription to get current `ai_credits_used_this_month` value
  2. Updates subscription with: `ai_credits_used_this_month + creditsUsed`
  3. Uses Supabase admin client for write access

**Code Location:** Lines 310-339

```typescript
export async function trackAICreditUsage(userId: string, creditsUsed: number = 1) {
  // Get current subscription
  const { data: subscription, error: fetchError } = await supabaseAdmin
    .from('subscriptions')
    .select('ai_credits_used_this_month')
    .eq('user_id', userId)
    .single();

  if (fetchError || !subscription) {
    console.error('Error fetching subscription for AI credit tracking:', fetchError);
    return;
  }

  // Increment credits
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      ai_credits_used_this_month: subscription.ai_credits_used_this_month + creditsUsed
    })
    .eq('user_id', userId);
}
```

#### `src/lib/subscriptionHelpers.ts`
- **Function:** `incrementUsage(userId: string, usageType: 'clients' | 'posts' | 'ai_credits', amount: number = 1)`
- **Purpose:** Generic function to increment various usage types, including AI credits
- **How it works:**
  1. Gets current subscription
  2. Updates the appropriate usage counter based on `usageType`
  3. For AI credits: `updateData.ai_credits_used_this_month = subscription.ai_credits_used_this_month + amount`

**Code Location:** Lines 149-186

#### `src/lib/utils/credits.ts`
- **Function:** `checkAndDeductCredit(userId: string, actionType: string)`
- **Purpose:** Uses database RPC function `deduct_credit` to check and deduct credits atomically
- **How it works:**
  1. Calls Supabase RPC: `deduct_credit(user_uuid, action)`
  2. Returns `{ success: boolean, creditsRemaining: number, error?: string }`
  3. Handles `INSUFFICIENT_CREDITS` error code

**Code Location:** Lines 16-68

```typescript
export async function checkAndDeductCredit(
  userId: string,
  actionType: string
): Promise<DeductCreditResponse> {
  const { data, error } = await supabase.rpc<DeductCreditResultPayload>(
    'deduct_credit',
    {
      user_uuid: userId,
      action: actionType
    }
  );
  // ... error handling
}
```

---

### 2. **API Routes That Use Credit Tracking**

#### `src/app/api/ai/route.ts` ⭐ **MAIN CREDIT DEDUCTION POINT**
- **Credit Check:** Line 105 - Uses `withAICreditCheck(request, 1)` before processing
- **Credit Tracking:** Line 204 - Calls `trackAICreditUsage(userId, 1)` after successful generation
- **Usage:** 
  - Checks credits BEFORE processing AI request
  - Tracks usage AFTER successful completion (status 200)
  - Used for: `analyze_image`, `generate_captions`, `remix_caption` actions

**Key Code Sections:**

1. **Credit Check (Lines 104-123):**
```typescript
// Check AI credit limits BEFORE processing
const subscriptionCheck = await withAICreditCheck(request, 1);

if (!subscriptionCheck.allowed) {
  return NextResponse.json({ 
    error: subscriptionCheck.error || 'AI credit limit reached',
  }, { status: 403 });
}

const userId = subscriptionCheck.userId;
```

2. **Credit Tracking (Lines 202-205):**
```typescript
// Track AI credit usage if request was successful
if (result?.status === 200) {
  await trackAICreditUsage(userId, 1);
}
```

3. **Content Ideas Generation (Lines 711-718):**
```typescript
// Uses different credit system (checkAndDeductCredit via RPC)
const creditResult = await checkAndDeductCredit(userId, 'content_generation');

if (!creditResult.success) {
  return NextResponse.json({
    success: false,
    error: { code: 'INSUFFICIENT_CREDITS', showUpgradeModal: true },
    creditsRemaining: creditResult.creditsRemaining ?? 0
  });
}
```

---

### 3. **Helper Functions**

#### `src/lib/subscriptionMiddleware.ts` - Credit Checking
- **Function:** `checkAICreditsPermission(request: NextRequest, creditsNeeded: number = 1)`
- **Purpose:** Validates if user has enough credits BEFORE allowing request
- **Logic:** 
  - Calculates: `remainingCredits = max_ai_credits_per_month - ai_credits_used_this_month`
  - Returns `{ allowed: boolean, subscription?: Subscription, error?: string }`
  - Handles unlimited credits (max_ai_credits_per_month === -1)

**Code Location:** Lines 124-214

#### `src/lib/contexts/CreditsContext.tsx`
- **Purpose:** Reads credit balance for UI display
- **Fetches:** `ai_credits_used_this_month` from subscriptions table
- **Calculates:** `remainingCredits = 10 - ai_credits_used_this_month`

**Code Location:** Lines 57-78

---

## 🔄 Current Credit Deduction Logic Flow

### **Standard AI Generation Flow (analyze_image, generate_captions, remix_caption):**

```
1. User makes request → /api/ai route
2. Credit Check: withAICreditCheck(request, 1)
   ├─ Validates user authentication
   ├─ Fetches subscription from subscriptions table
   ├─ Calculates: remaining = max_ai_credits_per_month - ai_credits_used_this_month
   └─ Returns { allowed: boolean, userId }
3. If NOT allowed → Return 403 error
4. If allowed → Process AI request
5. If result.status === 200 → Track credit usage
   └─ trackAICreditUsage(userId, 1)
      ├─ Fetch current: ai_credits_used_this_month
      └─ Update: ai_credits_used_this_month = current + 1
6. Return result to user
```

### **Content Ideas Generation Flow:**

```
1. User requests content ideas → /api/ai?action=generate_content_ideas
2. Credit Check & Deduct: checkAndDeductCredit(userId, 'content_generation')
   ├─ Calls database RPC: deduct_credit(user_uuid, action)
   ├─ Database handles check + deduction atomically
   └─ Returns { success: boolean, creditsRemaining: number }
3. If NOT success → Return error with creditsRemaining
4. If success → Process content ideas generation
5. Return result with creditsRemaining
```

---

## 📊 Database Operations

### **Read Operations:**
- `subscriptions` table → `SELECT ai_credits_used_this_month WHERE user_id = ?`

### **Write Operations:**
- `subscriptions` table → `UPDATE ai_credits_used_this_month = current + 1 WHERE user_id = ?`
- RPC function → `deduct_credit(user_uuid, action)` (for content ideas)

---

## 🎯 Key Takeaways

1. **Primary Deduction Method:** `trackAICreditUsage()` in `subscriptionMiddleware.ts`
2. **Main Entry Point:** `/api/ai` route handles credit checking and tracking
3. **Credit Check Flow:** Check BEFORE → Process → Track AFTER success
4. **Two Systems:** 
   - Standard: `trackAICreditUsage()` (increment after success)
   - Content Ideas: `checkAndDeductCredit()` (atomic check + deduct via RPC)

---

## 📝 Files Summary

| File | Function | Purpose |
|------|----------|---------|
| `src/lib/subscriptionMiddleware.ts` | `trackAICreditUsage()` | Increments `ai_credits_used_this_month` |
| `src/lib/subscriptionMiddleware.ts` | `checkAICreditsPermission()` | Validates credit availability |
| `src/lib/subscriptionHelpers.ts` | `incrementUsage()` | Generic increment function (supports AI credits) |
| `src/lib/utils/credits.ts` | `checkAndDeductCredit()` | Atomic check + deduct via RPC |
| `src/app/api/ai/route.ts` | POST handler | Main API route that checks and tracks credits |
| `src/lib/contexts/CreditsContext.tsx` | `refreshCredits()` | Reads credit balance for UI display |

