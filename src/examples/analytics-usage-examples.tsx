/**
 * Analytics Usage Examples
 * 
 * This file contains examples of how to use the GTM tracking utilities
 * throughout your application. These are NOT meant to be imported directly,
 * but rather serve as a reference for implementing tracking in your components.
 */

'use client';

import { 
  trackEvent, 
  trackPageView, 
  trackLogin, 
  trackSignup, 
  trackPurchase,
  pushToDataLayer 
} from '@/lib/gtm';

// ============================================================================
// EXAMPLE 1: Track Button Clicks
// ============================================================================

export function ExampleButtonTracking() {
  const handleCreateContent = () => {
    trackEvent('button_click', {
      button_name: 'create_content',
      button_location: 'dashboard',
      timestamp: new Date().toISOString()
    });
    
    // Your button logic here
    console.log('Creating content...');
  };

  return (
    <button onClick={handleCreateContent}>
      Create Content
    </button>
  );
}

// ============================================================================
// EXAMPLE 2: Track Form Submissions
// ============================================================================

export function ExampleFormTracking() {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    trackEvent('form_submission', {
      form_name: 'contact_form',
      form_location: 'contact_page'
    });
    
    // Your form submission logic here
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="name" placeholder="Name" />
      <input type="email" name="email" placeholder="Email" />
      <button type="submit">Submit</button>
    </form>
  );
}

// ============================================================================
// EXAMPLE 3: Track User Authentication
// ============================================================================

export function ExampleAuthTracking() {
  const handleLogin = async (email: string, password: string) => {
    try {
      // Your login logic here
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      const { userId } = await response.json();
      
      // Track the login
      trackLogin('email', userId);
      
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleSignup = async (email: string, password: string) => {
    try {
      // Your signup logic here
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      const { userId } = await response.json();
      
      // Track the signup
      trackSignup('email', userId);
      
    } catch (error) {
      console.error('Signup failed:', error);
    }
  };

  return (
    <div>
      <button onClick={() => handleLogin('test@example.com', 'password')}>
        Login
      </button>
      <button onClick={() => handleSignup('test@example.com', 'password')}>
        Sign Up
      </button>
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: Track E-commerce/Purchases
// ============================================================================

export function ExamplePurchaseTracking() {
  const handlePurchase = async (packageId: string, amount: number) => {
    try {
      // Your purchase logic here
      const response = await fetch('/api/purchase', {
        method: 'POST',
        body: JSON.stringify({ packageId, amount })
      });
      
      const { transactionId } = await response.json();
      
      // Track the purchase
      trackPurchase(
        transactionId,
        amount,
        'USD',
        [
          {
            id: packageId,
            name: 'AI Credits Package',
            quantity: 1,
            price: amount
          }
        ]
      );
      
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  };

  return (
    <button onClick={() => handlePurchase('credits_100', 29.99)}>
      Buy 100 Credits - $29.99
    </button>
  );
}

// ============================================================================
// EXAMPLE 5: Track Content Creation
// ============================================================================

export function ExampleContentTracking() {
  const handleContentCreate = async (contentType: string, platform: string) => {
    try {
      // Your content creation logic here
      const response = await fetch('/api/content/create', {
        method: 'POST',
        body: JSON.stringify({ contentType, platform })
      });
      
      const { contentId, creditsUsed } = await response.json();
      
      // Track the content creation
      pushToDataLayer({
        event: 'content_created',
        content_type: contentType,
        platform: platform,
        content_id: contentId,
        ai_credits_used: creditsUsed,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Content creation failed:', error);
    }
  };

  return (
    <button onClick={() => handleContentCreate('social_post', 'instagram')}>
      Create Instagram Post
    </button>
  );
}

// ============================================================================
// EXAMPLE 6: Track Navigation/Page Views
// ============================================================================

export function ExamplePageViewTracking() {
  const handleNavigation = (page: string, title: string) => {
    // Track the page view
    trackPageView(page, title);
    
    // Your navigation logic here
    console.log(`Navigating to ${page}`);
  };

  return (
    <nav>
      <button onClick={() => handleNavigation('/dashboard', 'Dashboard')}>
        Dashboard
      </button>
      <button onClick={() => handleNavigation('/clients', 'Clients')}>
        Clients
      </button>
      <button onClick={() => handleNavigation('/settings', 'Settings')}>
        Settings
      </button>
    </nav>
  );
}

// ============================================================================
// EXAMPLE 7: Track Modal/Dialog Interactions
// ============================================================================

export function ExampleModalTracking() {
  const handleModalOpen = (modalName: string) => {
    trackEvent('modal_open', {
      modal_name: modalName,
      timestamp: new Date().toISOString()
    });
  };

  const handleModalClose = (modalName: string, timeSpent: number) => {
    trackEvent('modal_close', {
      modal_name: modalName,
      time_spent_seconds: timeSpent,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <button onClick={() => handleModalOpen('create_content_modal')}>
      Open Create Content Modal
    </button>
  );
}

// ============================================================================
// EXAMPLE 8: Track Search/Filter Actions
// ============================================================================

export function ExampleSearchTracking() {
  const handleSearch = (searchTerm: string, filters: Record<string, any>) => {
    trackEvent('search', {
      search_term: searchTerm,
      filters: JSON.stringify(filters),
      timestamp: new Date().toISOString()
    });
    
    // Your search logic here
  };

  return (
    <input
      type="text"
      placeholder="Search..."
      onChange={(e) => handleSearch(e.target.value, { category: 'all' })}
    />
  );
}

// ============================================================================
// EXAMPLE 9: Track Video/Media Interactions
// ============================================================================

export function ExampleMediaTracking() {
  const handleVideoPlay = (videoId: string, videoTitle: string) => {
    trackEvent('video_play', {
      video_id: videoId,
      video_title: videoTitle,
      timestamp: new Date().toISOString()
    });
  };

  const handleVideoComplete = (videoId: string, watchTime: number) => {
    trackEvent('video_complete', {
      video_id: videoId,
      watch_time_seconds: watchTime,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <video
      onPlay={() => handleVideoPlay('video123', 'Tutorial Video')}
      onEnded={() => handleVideoComplete('video123', 120)}
    >
      <source src="/video.mp4" type="video/mp4" />
    </video>
  );
}

// ============================================================================
// EXAMPLE 10: Track Errors
// ============================================================================

export function ExampleErrorTracking() {
  const handleError = (errorType: string, errorMessage: string) => {
    trackEvent('error', {
      error_type: errorType,
      error_message: errorMessage,
      page_location: window.location.pathname,
      timestamp: new Date().toISOString()
    });
  };

  const handleApiCall = async () => {
    try {
      const response = await fetch('/api/some-endpoint');
      if (!response.ok) {
        throw new Error('API call failed');
      }
    } catch (error) {
      handleError('api_error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <button onClick={handleApiCall}>
      Make API Call
    </button>
  );
}

