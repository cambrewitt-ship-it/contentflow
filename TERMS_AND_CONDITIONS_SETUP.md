# Terms and Conditions Setup

This document explains the terms and conditions implementation and optional database tracking.

## ✅ What's Been Implemented

1. **Terms and Conditions Page** (`/src/app/terms/page.tsx`)
   - Accessible at `/terms`
   - Clean, readable format with all standard sections
   - Can be customized with your specific terms

2. **Signup Form Validation** (`/src/app/auth/signup/page.tsx`)
   - Required checkbox to accept terms before signup
   - Links to terms page (opens in new tab)
   - Frontend validation prevents signup without acceptance

3. **UI Components** (`/src/components/ui/checkbox.tsx`)
   - Professional checkbox component using Radix UI
   - Accessible and styled to match your app

## 📝 Customizing Your Terms

To update the terms and conditions with your specific content:

1. Open `/src/app/terms/page.tsx`
2. Edit the content sections to match your requirements
3. Update the "Last updated" date
4. Add your company-specific information

## 🗄️ Optional: Database Tracking

If you want to track when users accept terms in your database:

### Step 1: Run the Migration

Execute the SQL migration file:

```bash
# Run this in your Supabase SQL editor or via CLI
psql -f add-terms-acceptance-column.sql
```

Or manually run:
```sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;
```

### Step 2: Update AuthContext

Modify `/src/contexts/AuthContext.tsx` to track acceptance:

```typescript
// Update the signUp function
const signUp = async (email: string, password: string, acceptedTerms?: boolean) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: {
        terms_accepted_at: acceptedTerms ? new Date().toISOString() : null,
      },
    },
  });
  // ... rest of the code
};
```

### Step 3: Update Signup Page

Pass the acceptance status to signUp:

```typescript
// In /src/app/auth/signup/page.tsx
const { error } = await signUp(email, password, acceptedTerms);
```

### Step 4: Update Database Trigger

Modify the `handle_new_user()` function in your database:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, terms_accepted_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data->>'full_name',
    (NEW.raw_user_meta_data->>'terms_accepted_at')::TIMESTAMP WITH TIME ZONE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 🎨 Styling Customization

The terms page and checkbox use your app's existing design system:
- Tailwind CSS for styling
- Dark mode support via your theme
- Matches your card/button components

## 🔗 Additional Pages to Consider

You may also want to create:
- **Privacy Policy** (`/src/app/privacy/page.tsx`)
- **Cookie Policy** (`/src/app/cookies/page.tsx`)
- **Acceptable Use Policy** (`/src/app/acceptable-use/page.tsx`)

Simply duplicate the terms page structure and update the content accordingly.

## 📱 Testing

1. Navigate to `/auth/signup`
2. Try to submit without checking the box → Should show error
3. Check the box → Should allow submission
4. Click "Terms and Conditions" link → Should open terms page in new tab

## 🚀 Going Live

Before launching:
1. Review and customize all terms content
2. Consult with legal counsel to ensure compliance
3. Update the last modified date
4. Consider adding version tracking for terms changes
5. Implement email notifications for terms updates (if needed)

