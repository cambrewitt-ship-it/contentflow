/**
 * Content for the platform-specific preview landing pages that live under
 * /social-preview/<slug>. Each entry drives metadata, on-page copy, the
 * JSON-LD (FAQPage + HowTo + BreadcrumbList) and the sitemap.
 *
 * Specs are the publicly documented values from each platform's own creative
 * guidelines. Keep them accurate — these pages get cited by AI assistants.
 */

export interface Spec {
  label: string
  value: string
}

export interface Faq {
  q: string
  a: string
}

export interface Bullet {
  t: string
  d: string
}

export interface Section {
  h2: string
  body?: string
  bullets?: Bullet[]
}

export interface PlatformPage {
  slug: string
  /** Tab id inside SocialPreviewTool */
  platformId: string
  /** Open the tool in paid-ad mode */
  isAdvert: boolean
  /** Short label used in breadcrumbs and cross-links */
  shortName: string
  title: string
  description: string
  h1: string
  intro: string
  /** 40–60 word direct answer. Targets AI Overviews and featured snippets. */
  answer: string
  specsHeading: string
  specs: Spec[]
  sections: Section[]
  faqs: Faq[]
  /** Slugs of sibling pages to cross-link */
  related: string[]
}

const SHARED_TRIAL_FAQ: Faq = {
  q: 'Is the preview tool really free?',
  a: 'Yes. The social media post preview tool is free and requires no account, no credit card and no sign-up. Nothing you upload is published anywhere. Content Manager is the paid product behind it — a social media management platform for agencies — but the preview tool works on its own.',
}

const SHARED_PRIVACY_FAQ: Faq = {
  q: 'Are my images stored or published anywhere?',
  a: 'No. Your image and caption stay in your browser while you build the preview and nothing is posted to any social network. A preview is only stored on our servers if you click Share, which creates a private link you can send to a client or teammate.',
}

export const PLATFORM_PAGES: PlatformPage[] = [
  // ───────────────────────────────────────────────────────── Facebook (organic)
  {
    slug: 'facebook-post-preview',
    platformId: 'facebook',
    isAdvert: false,
    shortName: 'Facebook post',
    title: 'Free Facebook Post Preview Tool — See Your Post Before You Publish',
    description:
      'Preview exactly how your Facebook post will look in the news feed — image crop, caption truncation, page name and engagement bar. Free, no account needed.',
    h1: 'Free Facebook Post Preview Tool',
    intro:
      'Upload your image, write your caption and see your post rendered as a real Facebook news feed post before you publish. No account, no cost.',
    answer:
      'A Facebook post preview tool renders your image and caption inside a mock news feed post so you can check the image crop, where the caption truncates behind "See more", and how your page name and profile picture appear. Use it before publishing to catch layout problems no scheduling tool shows you.',
    specsHeading: 'Facebook post specs at a glance',
    specs: [
      { label: 'Landscape / link image', value: '1200 × 630 px (1.91:1)' },
      { label: 'Square image', value: '1080 × 1080 px (1:1)' },
      { label: 'Portrait image', value: '1080 × 1350 px (4:5)' },
      { label: 'Caption truncation', value: 'Around 125 characters before "See more"' },
      { label: 'Maximum caption length', value: '63,206 characters' },
      { label: 'Recommended file type', value: 'JPG or PNG, under 30 MB' },
    ],
    sections: [
      {
        h2: 'Why preview a Facebook post before publishing?',
        body:
          'Facebook rarely shows your image the way you designed it. Landscape images get letterboxed on mobile, square images dominate the feed, and anything taller than 4:5 is cropped. Captions are cut off at roughly 125 characters, so a hook buried in the second sentence is invisible to most people scrolling past. Previewing takes ten seconds and catches all three problems before the post is live — or worse, before a client sees it published wrong.',
      },
      {
        h2: 'What this Facebook preview shows you',
        bullets: [
          { t: 'Page identity', d: 'Your business name and logo in the position and size Facebook renders them, so you can check a logo that gets cropped inside the circular avatar.' },
          { t: 'Caption truncation', d: 'Where your text stops and the "See more" link takes over, so your hook lands above the fold.' },
          { t: 'Image crop', d: 'How your uploaded image is fitted into the feed container at Facebook’s aspect ratio.' },
          { t: 'Engagement bar', d: 'The Like, Comment and Share row underneath the post, so mockups you send clients look like the real thing.' },
          { t: 'Ad format toggle', d: 'Switch to advert mode to add a headline, a call-to-action button and the Sponsored label.' },
        ],
      },
      {
        h2: 'How to preview a Facebook post',
        body:
          'Enter your business name and upload your logo on the left. Upload the post image and paste your caption in the middle column. The preview on the right updates live. Toggle between Organic and Advert to check both formats, and use the Share button to send a client a link to the mockup without giving them an account.',
      },
    ],
    faqs: [
      {
        q: 'How long can a Facebook post caption be?',
        a: 'A Facebook post can technically contain up to 63,206 characters, but only around 125 characters show in the feed before the text is collapsed behind a "See more" link. Put your hook and any call to action in the first line.',
      },
      {
        q: 'What image size should I use for a Facebook post?',
        a: 'Use 1200 × 630 px for landscape or link posts, 1080 × 1080 px for square, and 1080 × 1350 px for portrait. Portrait 4:5 takes up the most vertical space in the mobile feed, which is why it usually performs best for organic reach.',
      },
      {
        q: 'Can I preview a Facebook post without a Facebook account?',
        a: 'Yes. This tool renders a mock Facebook feed post in your browser from the image and caption you provide. You do not need to log in to Facebook, connect a page, or create a Content Manager account.',
      },
      SHARED_PRIVACY_FAQ,
      SHARED_TRIAL_FAQ,
    ],
    related: ['facebook-ad-preview', 'facebook-story-preview', 'instagram-post-preview'],
  },

  // ──────────────────────────────────────────────────────── Instagram (organic)
  {
    slug: 'instagram-post-preview',
    platformId: 'instagram',
    isAdvert: false,
    shortName: 'Instagram post',
    title: 'Free Instagram Post Preview Tool — See Your Post Before You Post',
    description:
      'See how your Instagram post will look in the feed before you publish — image crop, caption truncation, username and engagement icons. Free, no login required.',
    h1: 'Free Instagram Post Preview Tool',
    intro:
      'Check your image crop and caption line breaks in a real Instagram feed layout before you publish. Free, no Instagram login required.',
    answer:
      'An Instagram post preview tool shows your image and caption inside a mock Instagram feed post, so you can check the square or 4:5 crop, where the caption is cut off after roughly 125 characters, and how your handle and profile picture read. It works without connecting an Instagram account.',
    specsHeading: 'Instagram post specs at a glance',
    specs: [
      { label: 'Square image', value: '1080 × 1080 px (1:1)' },
      { label: 'Portrait image', value: '1080 × 1350 px (4:5)' },
      { label: 'Landscape image', value: '1080 × 566 px (1.91:1)' },
      { label: 'Caption truncation', value: 'Around 125 characters before "more"' },
      { label: 'Maximum caption length', value: '2,200 characters' },
      { label: 'Hashtag limit', value: '30 per post' },
    ],
    sections: [
      {
        h2: 'Why preview an Instagram post first?',
        body:
          'Instagram is the least forgiving feed for crops. Anything wider than 1.91:1 or taller than 4:5 is cut, and the part that survives is not always the part you cared about. Captions collapse after about 125 characters, so line breaks and emoji spacing you carefully arranged in a notes app often disappear behind "more". Seeing the post in situ is the only reliable way to catch this.',
      },
      {
        h2: 'What this Instagram preview shows you',
        bullets: [
          { t: 'Feed crop', d: 'How your image is fitted to Instagram’s feed container, so you can spot a subject or logo that gets cut off.' },
          { t: 'Handle and avatar', d: 'Your business name and profile picture rendered at the real size — useful for checking a logo that turns unreadable when shrunk.' },
          { t: 'Caption cut-off', d: 'Where the visible caption ends and "more" begins.' },
          { t: 'Engagement row', d: 'Like, comment, share and save icons, so client mockups look authentic.' },
          { t: 'Ad mode', d: 'Toggle to a sponsored post with a headline and a call-to-action button.' },
        ],
      },
      {
        h2: 'How to preview an Instagram post',
        body:
          'Add your business name and logo, upload the image you plan to post and paste the caption. The Instagram tab on the right renders the post live as you type. Switch to the IG Stories tab to check the same creative in the vertical story format, or hit Share to send the mockup to a client for sign-off.',
      },
    ],
    faqs: [
      {
        q: 'What is the best image size for an Instagram post?',
        a: 'Use 1080 × 1350 px (4:5 portrait) for maximum space in the feed, or 1080 × 1080 px if you want a clean square grid. Landscape images should be 1080 × 566 px. Anything outside the 1.91:1 to 4:5 range will be cropped.',
      },
      {
        q: 'How many characters of an Instagram caption are visible?',
        a: 'Around 125 characters show in the feed before the caption is truncated with a "more" link. The full caption can be up to 2,200 characters, and you can use up to 30 hashtags.',
      },
      {
        q: 'Can I preview an Instagram post without logging in to Instagram?',
        a: 'Yes. The preview is generated in your browser from the image and caption you upload. No Instagram account, connection or permission is needed.',
      },
      SHARED_PRIVACY_FAQ,
      SHARED_TRIAL_FAQ,
    ],
    related: ['instagram-story-preview', 'instagram-ad-preview', 'facebook-post-preview'],
  },

  // ───────────────────────────────────────────────────────── LinkedIn (organic)
  {
    slug: 'linkedin-post-preview',
    platformId: 'linkedin',
    isAdvert: false,
    shortName: 'LinkedIn post',
    title: 'Free LinkedIn Post Preview Tool — Check Your Post Before You Share',
    description:
      'Preview how your LinkedIn post will appear in the feed — image crop, "see more" truncation, company page name and reactions row. Free, no sign-in needed.',
    h1: 'Free LinkedIn Post Preview Tool',
    intro:
      'See how your company page post renders in the LinkedIn feed — including where the text collapses behind "see more" — before you publish.',
    answer:
      'A LinkedIn post preview tool renders your image and post text inside a mock LinkedIn feed post so you can check the image crop, the company page name and logo, and where LinkedIn truncates your text behind "see more" — roughly 140 characters on mobile and 210 on desktop.',
    specsHeading: 'LinkedIn post specs at a glance',
    specs: [
      { label: 'Recommended image', value: '1200 × 627 px (1.91:1)' },
      { label: 'Square image', value: '1200 × 1200 px (1:1)' },
      { label: 'Company logo', value: '300 × 300 px' },
      { label: 'Text truncation', value: 'Around 140 characters on mobile, 210 on desktop' },
      { label: 'Maximum post length', value: '3,000 characters' },
      { label: 'Single image ad headline', value: '70 characters recommended' },
    ],
    sections: [
      {
        h2: 'Why preview a LinkedIn post?',
        body:
          'LinkedIn truncates aggressively and inconsistently — the cut-off sits at roughly 140 characters on mobile and about 210 on desktop. A post that reads well on your laptop can lose its point entirely on a phone. Image treatment differs too: 1.91:1 renders cleanly, squares take more feed space, and logos that look fine on a website often turn to mush inside LinkedIn’s small page avatar.',
      },
      {
        h2: 'What this LinkedIn preview shows you',
        bullets: [
          { t: 'Company page identity', d: 'Page name and logo at the real rendered size.' },
          { t: '"See more" cut-off', d: 'Where the visible text ends, so your hook survives the collapse.' },
          { t: 'Image crop', d: 'How the image sits in the feed container.' },
          { t: 'Reactions and reposts row', d: 'The engagement bar beneath the post for realistic client mockups.' },
          { t: 'Sponsored content mode', d: 'Switch to advert mode for a single-image ad with the Promoted label, headline card and CTA button.' },
        ],
      },
      {
        h2: 'How to preview a LinkedIn post',
        body:
          'Enter your company name, upload your logo, add the image and paste your post text. Select the LinkedIn tab in the preview column. Toggle Advert to check a sponsored single-image ad, then share a link to the mockup for approval.',
      },
    ],
    faqs: [
      {
        q: 'How much of a LinkedIn post is visible before "see more"?',
        a: 'Roughly 140 characters on mobile and around 210 on desktop before LinkedIn collapses the rest behind a "see more" link. Write the hook and any key claim in that first line.',
      },
      {
        q: 'What image size works best for LinkedIn posts?',
        a: 'Use 1200 × 627 px (1.91:1) for the standard feed image or 1200 × 1200 px for a square that occupies more vertical space. Company logos should be 300 × 300 px.',
      },
      {
        q: 'Can I preview a LinkedIn sponsored ad?',
        a: 'Yes. Switch the Post Type toggle to Advert and the preview renders a single-image sponsored post, including the Promoted label, the headline card beneath the image and your chosen call-to-action button.',
      },
      SHARED_PRIVACY_FAQ,
      SHARED_TRIAL_FAQ,
    ],
    related: ['linkedin-ad-preview', 'facebook-post-preview', 'twitter-x-post-preview'],
  },

  // ─────────────────────────────────────────────────────────── Twitter / X post
  {
    slug: 'twitter-x-post-preview',
    platformId: 'twitter',
    isAdvert: false,
    shortName: 'X (Twitter) post',
    title: 'Free X (Twitter) Post Preview Tool — See Your Tweet Before You Send',
    description:
      'Preview how your post on X will look — image crop, handle, character count and engagement row — before you publish. Free tweet preview tool, no login.',
    h1: 'Free X (Twitter) Post Preview Tool',
    intro:
      'See your post on X rendered in the real timeline layout — image crop, display name, handle and engagement icons — before you send it.',
    answer:
      'An X (Twitter) post preview tool shows your text and image inside a mock timeline post, so you can check the 16:9 image crop, your display name and handle, and whether the text fits the 280-character limit before you publish.',
    specsHeading: 'X (Twitter) post specs at a glance',
    specs: [
      { label: 'In-timeline image', value: '1600 × 900 px (16:9)' },
      { label: 'Square image', value: '1200 × 1200 px (1:1)' },
      { label: 'Profile picture', value: '400 × 400 px' },
      { label: 'Character limit', value: '280 characters on a free account' },
      { label: 'Images per post', value: 'Up to 4' },
      { label: 'Recommended file type', value: 'JPG, PNG or GIF' },
    ],
    sections: [
      {
        h2: 'Why preview a post on X?',
        body:
          'X crops in-timeline images to roughly 16:9, which decapitates anything designed as a square or a portrait. The 280-character limit also bites harder than it looks once links and handles are counted. A quick preview shows both the crop and the finished layout — display name, handle, body text and engagement row — in the shape people will actually see.',
      },
      {
        h2: 'What this X preview shows you',
        bullets: [
          { t: 'Timeline crop', d: 'How your image is cropped to the in-timeline aspect ratio.' },
          { t: 'Name and handle', d: 'Your display name and avatar as rendered in the timeline.' },
          { t: 'Live character count', d: 'A running count as you type, so you can see when you are over 280.' },
          { t: 'Engagement row', d: 'Reply, repost, like and share icons for realistic mockups.' },
        ],
      },
      {
        h2: 'How to preview a post on X',
        body:
          'Add your business name and logo, upload the image and write your post. Choose the Twitter / X tab in the preview column and the timeline post renders live. Use Share to send the mockup to a client or a colleague.',
      },
    ],
    faqs: [
      {
        q: 'What is the character limit on X?',
        a: 'Posts on a free X account are limited to 280 characters. Paid subscription tiers allow considerably longer posts, but the timeline still collapses long text behind a "Show more" link, so the opening line still does the work.',
      },
      {
        q: 'What image size should I use for X?',
        a: 'Use 1600 × 900 px (16:9) for a single in-timeline image. Square images at 1200 × 1200 px also work but will be cropped in the timeline view and expand when tapped.',
      },
      {
        q: 'Is this a tweet preview tool?',
        a: 'Yes — "tweet preview" and "X post preview" are the same thing. The tool renders your text and image in the current X timeline layout.',
      },
      SHARED_PRIVACY_FAQ,
      SHARED_TRIAL_FAQ,
    ],
    related: ['facebook-post-preview', 'linkedin-post-preview', 'instagram-post-preview'],
  },

  // ───────────────────────────────────────────────────────────────── TikTok post
  {
    slug: 'tiktok-post-preview',
    platformId: 'tiktok',
    isAdvert: false,
    shortName: 'TikTok post',
    title: 'Free TikTok Post Preview Tool — Check Your Caption and Safe Zones',
    description:
      'Preview how your TikTok post looks in the full-screen 9:16 feed — caption placement, username and the action buttons that cover your creative. Free, no login.',
    h1: 'Free TikTok Post Preview Tool',
    intro:
      'See your creative in TikTok’s full-screen vertical feed, with the caption and action buttons overlaid exactly where they cover your content.',
    answer:
      'A TikTok post preview tool shows your creative in the full-screen 9:16 feed with the username, caption and right-hand action buttons overlaid, so you can see which parts of your design are covered by TikTok’s interface before you publish.',
    specsHeading: 'TikTok post specs at a glance',
    specs: [
      { label: 'Aspect ratio', value: '9:16 vertical (1080 × 1920 px)' },
      { label: 'Caption limit', value: '2,200 characters' },
      { label: 'Caption visible in feed', value: 'Around 100 characters before "more"' },
      { label: 'Right-side UI overlay', value: 'Approximately 140 px from the right edge' },
      { label: 'Bottom UI overlay', value: 'Approximately 480 px of the lower frame' },
      { label: 'Profile picture', value: '200 × 200 px' },
    ],
    sections: [
      {
        h2: 'Why preview a TikTok post?',
        body:
          'TikTok covers a serious amount of your frame. The username and caption sit along the bottom, the follow, like, comment, save and share buttons run up the right edge, and the whole thing is full-screen so nothing is letterboxed out of harm’s way. Text you burned into the lower third of your creative will be hidden. A preview shows the overlay in place so you can move it.',
      },
      {
        h2: 'What this TikTok preview shows you',
        bullets: [
          { t: 'Full-screen 9:16 frame', d: 'Your creative rendered at TikTok’s vertical ratio.' },
          { t: 'Safe zones', d: 'Where the right-side action buttons and bottom caption block sit over your design.' },
          { t: 'Caption placement', d: 'How your caption wraps and where it truncates.' },
          { t: 'Username display', d: 'Your account name in the position TikTok renders it.' },
        ],
      },
      {
        h2: 'How to preview a TikTok post',
        body:
          'Upload the image or video frame you plan to post, add your caption and business name, then select the TikTok tab. The preview renders full-screen with the interface overlay, so you can immediately see whether anything important is buried behind it.',
      },
    ],
    faqs: [
      {
        q: 'How long can a TikTok caption be?',
        a: 'TikTok captions can be up to 2,200 characters, but only around the first 100 characters show in the feed before a "more" link. Keep the hook at the very front.',
      },
      {
        q: 'What are TikTok safe zones?',
        a: 'Safe zones are the parts of the 1080 × 1920 frame not covered by TikTok’s interface. Keep key text and logos clear of roughly 140 px on the right edge and around 480 px at the bottom, where the action buttons and caption sit.',
      },
      {
        q: 'Can I preview a TikTok video?',
        a: 'The tool previews a still frame in the TikTok feed layout. Export a key frame from your video and upload it to check the caption placement, safe zones and overall composition.',
      },
      SHARED_PRIVACY_FAQ,
      SHARED_TRIAL_FAQ,
    ],
    related: ['instagram-story-preview', 'instagram-post-preview', 'facebook-story-preview'],
  },

  // ──────────────────────────────────────────────────────────── Instagram Story
  {
    slug: 'instagram-story-preview',
    platformId: 'ig-stories',
    isAdvert: false,
    shortName: 'Instagram Story',
    title: 'Free Instagram Story Preview Tool — Check Your Story Safe Zones',
    description:
      'Preview your Instagram Story in the full-screen 9:16 format with the header, progress bar and reply bar in place. Check safe zones free, no login needed.',
    h1: 'Free Instagram Story Preview Tool',
    intro:
      'See your story at full-screen 9:16 with the progress bar, profile header and reply bar overlaid — so nothing important gets covered.',
    answer:
      'An Instagram Story preview tool renders your creative at 1080 × 1920 px with the progress bar, profile header and reply bar overlaid, so you can confirm that text and logos sit inside the safe zone — roughly 250 px clear at the top and 250 px at the bottom.',
    specsHeading: 'Instagram Story specs at a glance',
    specs: [
      { label: 'Dimensions', value: '1080 × 1920 px (9:16)' },
      { label: 'Top safe zone', value: 'Keep 250 px clear for the progress bar and header' },
      { label: 'Bottom safe zone', value: 'Keep 250 px clear for the reply bar' },
      { label: 'Maximum image duration', value: '5 seconds per story frame' },
      { label: 'Maximum video duration', value: '60 seconds per story frame' },
      { label: 'Recommended file type', value: 'JPG, PNG or MP4' },
    ],
    sections: [
      {
        h2: 'Why preview an Instagram Story?',
        body:
          'Stories are full-bleed, which means Instagram’s own interface sits directly on top of your creative. The progress bar, your handle and the close button occupy the top; the reply bar, share icon and any sticker prompts occupy the bottom. Designers routinely centre text vertically and find the bottom line buried under "Send message". Previewing the frame with the overlay in place is the fix.',
      },
      {
        h2: 'What this Instagram Story preview shows you',
        bullets: [
          { t: 'Progress bar and header', d: 'The Instagram gradient ring, handle and timestamp at the top of the frame.' },
          { t: 'Safe zones', d: 'Where the top and bottom interface elements cover your design.' },
          { t: 'Reply bar', d: 'The message bar at the foot of the story.' },
          { t: 'Full-bleed crop', d: 'How your image fills the 9:16 frame, including any unwanted cropping.' },
        ],
      },
      {
        h2: 'How to preview an Instagram Story',
        body:
          'Upload your story creative, add your business name and logo, and select the IG Stories tab in the preview column. Check that all text and logos sit inside the middle band of the frame, then share the mockup for client approval.',
      },
    ],
    faqs: [
      {
        q: 'What size is an Instagram Story?',
        a: 'Instagram Stories are 1080 × 1920 px, a 9:16 vertical ratio. Keep roughly 250 px clear at the top and 250 px at the bottom so the progress bar, header and reply bar do not cover your content.',
      },
      {
        q: 'What is the Instagram Story safe zone?',
        a: 'The safe zone is the central area of the 1080 × 1920 frame — approximately 1080 × 1420 px — where Instagram’s interface will not cover your text, logo or call to action.',
      },
      {
        q: 'Can I preview an Instagram Story without posting it?',
        a: 'Yes. The preview is rendered in your browser and nothing is uploaded to Instagram. You can check the layout as many times as you like before publishing.',
      },
      SHARED_PRIVACY_FAQ,
      SHARED_TRIAL_FAQ,
    ],
    related: ['facebook-story-preview', 'instagram-post-preview', 'tiktok-post-preview'],
  },

  // ───────────────────────────────────────────────────────────── Facebook Story
  {
    slug: 'facebook-story-preview',
    platformId: 'fb-stories',
    isAdvert: false,
    shortName: 'Facebook Story',
    title: 'Free Facebook Story Preview Tool — Check Safe Zones Before Posting',
    description:
      'Preview your Facebook Story at full-screen 9:16 with the progress bar and reply bar in place, so your text and logo stay inside the safe zone. Free tool.',
    h1: 'Free Facebook Story Preview Tool',
    intro:
      'Check your Facebook Story creative at 9:16 with the interface overlay in place, so nothing important disappears behind it.',
    answer:
      'A Facebook Story preview tool renders your creative at 1080 × 1920 px with the progress bar, page header and reply bar overlaid, letting you confirm that headlines, logos and calls to action sit inside the safe zone before you publish.',
    specsHeading: 'Facebook Story specs at a glance',
    specs: [
      { label: 'Dimensions', value: '1080 × 1920 px (9:16)' },
      { label: 'Top safe zone', value: 'Keep around 250 px clear' },
      { label: 'Bottom safe zone', value: 'Keep around 250 px clear' },
      { label: 'Maximum image duration', value: '5 seconds per story frame' },
      { label: 'Maximum video duration', value: '60 seconds per story frame' },
      { label: 'Recommended file type', value: 'JPG, PNG or MP4' },
    ],
    sections: [
      {
        h2: 'Why preview a Facebook Story?',
        body:
          'Facebook Stories are full-screen, so the platform’s own interface sits on top of your creative rather than beside it. The progress bar and page name cover the top of the frame, the reply bar covers the bottom. Any text placed near either edge is effectively invisible. Previewing the frame with the overlay in place is a ten-second check that saves a reshoot.',
      },
      {
        h2: 'What this Facebook Story preview shows you',
        bullets: [
          { t: 'Progress bar and page header', d: 'Your page name and logo in the top strip of the story.' },
          { t: 'Safe zones', d: 'Exactly where the interface covers your design at the top and bottom.' },
          { t: 'Reply bar', d: 'The message bar at the foot of the frame.' },
          { t: 'Full-bleed crop', d: 'How your creative fills the vertical frame.' },
        ],
      },
      {
        h2: 'How to preview a Facebook Story',
        body:
          'Upload your creative, add your page name and logo, then select the FB Stories tab. Confirm your text sits in the central band of the frame and share a link to the mockup if a client needs to sign it off.',
      },
    ],
    faqs: [
      {
        q: 'What size is a Facebook Story?',
        a: 'Facebook Stories are 1080 × 1920 px at a 9:16 vertical ratio — the same dimensions as Instagram Stories, so one creative covers both.',
      },
      {
        q: 'Where do Facebook Stories get cut off?',
        a: 'The progress bar and page name cover roughly the top 250 px and the reply bar covers roughly the bottom 250 px. Keep headlines, logos and calls to action inside the central area.',
      },
      {
        q: 'Can I use the same creative for Facebook and Instagram Stories?',
        a: 'Yes — both use 1080 × 1920 px at 9:16 with similar safe zones. Use the FB Stories and IG Stories tabs to confirm the same file works in both before publishing.',
      },
      SHARED_PRIVACY_FAQ,
      SHARED_TRIAL_FAQ,
    ],
    related: ['instagram-story-preview', 'facebook-post-preview', 'tiktok-post-preview'],
  },

  // ──────────────────────────────────────────────────────────────── Facebook ad
  {
    slug: 'facebook-ad-preview',
    platformId: 'facebook',
    isAdvert: true,
    shortName: 'Facebook ad',
    title: 'Free Facebook Ad Preview Tool — Mock Up an Ad Without Ads Manager',
    description:
      'Preview a Facebook ad with headline, CTA button and Sponsored label before you build it in Ads Manager. Free mockup tool for agencies and media buyers.',
    h1: 'Free Facebook Ad Preview Tool',
    intro:
      'Mock up a Facebook feed ad — image, primary text, headline, Sponsored label and call-to-action button — without touching Ads Manager or spending a cent.',
    answer:
      'A Facebook ad preview tool renders your creative, primary text, headline and call-to-action button as a Sponsored feed ad, so you can review or present the ad before building it in Ads Manager. It requires no ad account, no campaign and no budget.',
    specsHeading: 'Facebook feed ad specs at a glance',
    specs: [
      { label: 'Image size', value: '1080 × 1080 px (1:1) or 1200 × 628 px (1.91:1)' },
      { label: 'Primary text', value: '125 characters recommended' },
      { label: 'Headline', value: '27 characters recommended, 40 maximum' },
      { label: 'Description', value: '27 characters recommended' },
      { label: 'Text on image', value: 'Keep under 20% of the image area' },
      { label: 'Call-to-action button', value: 'Shop Now, Learn More, Sign Up, Book Now and others' },
    ],
    sections: [
      {
        h2: 'Why mock up a Facebook ad outside Ads Manager?',
        body:
          'Ads Manager only shows a preview once you have an ad account, a campaign structure and a draft ad — which is far too much friction for a first client conversation or an internal creative review. This tool renders the same layout in seconds: Sponsored label, primary text with its truncation point, the image, the headline card and the CTA button. It is built for agencies putting concepts in front of a client before any budget is committed.',
      },
      {
        h2: 'What this Facebook ad preview shows you',
        bullets: [
          { t: 'Sponsored label', d: 'The ad marker under your page name, so the mockup reads as a real ad.' },
          { t: 'Primary text truncation', d: 'Where your copy collapses behind "See more" at around 125 characters.' },
          { t: 'Headline card', d: 'The headline strip beneath the image, where the 27-character recommendation matters most.' },
          { t: 'Call-to-action button', d: 'Pick from Shop Now, Learn More, Sign Up, Book Now, Get Offer and more.' },
          { t: 'Creative crop', d: 'How your ad image is cropped into the feed placement.' },
        ],
      },
      {
        h2: 'How to preview a Facebook ad',
        body:
          'Enter your business name and logo, upload the ad creative and write your primary text. Set the Post Type toggle to Advert, add a headline and choose a call to action. The preview renders live on the right. Use Share to send the client a link they can review without an account.',
      },
    ],
    faqs: [
      {
        q: 'Can I preview a Facebook ad without an ad account?',
        a: 'Yes. This tool renders the ad layout in your browser from the creative, primary text, headline and CTA you supply. No Meta ad account, campaign or spend is required.',
      },
      {
        q: 'How long should Facebook ad primary text and headlines be?',
        a: 'Meta recommends around 125 characters of primary text and 27 characters for the headline, with a 40-character headline maximum. Anything longer risks being truncated in the feed placement.',
      },
      {
        q: 'Does this replace the Ads Manager preview?',
        a: 'No — always check the live preview in Ads Manager before a campaign goes live, because it reflects your exact placements. This tool is for the stage before that: concepting, internal review and client sign-off.',
      },
      SHARED_PRIVACY_FAQ,
      SHARED_TRIAL_FAQ,
    ],
    related: ['instagram-ad-preview', 'linkedin-ad-preview', 'facebook-post-preview'],
  },

  // ─────────────────────────────────────────────────────────────── Instagram ad
  {
    slug: 'instagram-ad-preview',
    platformId: 'instagram',
    isAdvert: true,
    shortName: 'Instagram ad',
    title: 'Free Instagram Ad Preview Tool — Mock Up a Sponsored Post Instantly',
    description:
      'Preview an Instagram ad with Sponsored label, headline and CTA button before building it in Ads Manager. Free mockup tool for agencies and media buyers.',
    h1: 'Free Instagram Ad Preview Tool',
    intro:
      'Build a realistic Instagram sponsored post mockup — creative, caption, headline and call-to-action button — with no ad account required.',
    answer:
      'An Instagram ad preview tool renders your creative, caption, headline and call-to-action as a Sponsored Instagram feed post, so you can review the ad or present it to a client before building it in Meta Ads Manager.',
    specsHeading: 'Instagram feed ad specs at a glance',
    specs: [
      { label: 'Square creative', value: '1080 × 1080 px (1:1)' },
      { label: 'Portrait creative', value: '1080 × 1350 px (4:5)' },
      { label: 'Story ad creative', value: '1080 × 1920 px (9:16)' },
      { label: 'Primary text', value: '125 characters recommended' },
      { label: 'Headline', value: '27 characters recommended, 40 maximum' },
      { label: 'Text on image', value: 'Keep under 20% of the image area' },
    ],
    sections: [
      {
        h2: 'Why mock up an Instagram ad first?',
        body:
          'Instagram ads live or die on the crop. A 4:5 creative that looks perfect in Figma can lose its call to action once the caption, Sponsored label and CTA button are stacked around it. Mocking up the whole unit — not just the creative — is the only way to see whether the message survives the layout. And because no ad account is involved, you can do it in the first ten minutes of a client conversation.',
      },
      {
        h2: 'What this Instagram ad preview shows you',
        bullets: [
          { t: 'Sponsored label', d: 'The ad marker under your handle.' },
          { t: 'Creative crop', d: 'How your 1:1 or 4:5 creative fits the feed placement.' },
          { t: 'Caption truncation', d: 'Where the primary text collapses behind "more".' },
          { t: 'Call-to-action button', d: 'The CTA bar with your chosen action.' },
          { t: 'Story ad format', d: 'Switch to the IG Stories tab to check the same creative as a 9:16 story ad.' },
        ],
      },
      {
        h2: 'How to preview an Instagram ad',
        body:
          'Add your business name and logo, upload the creative and write your caption. Switch Post Type to Advert, add the headline and pick a call to action, then select the Instagram tab. Share the link with your client for sign-off before anything is built in Ads Manager.',
      },
    ],
    faqs: [
      {
        q: 'Can I preview an Instagram ad without Ads Manager?',
        a: 'Yes. The mockup is rendered in your browser from the creative and copy you provide — no Meta ad account, campaign or budget needed.',
      },
      {
        q: 'What size should an Instagram ad be?',
        a: 'Use 1080 × 1080 px for square feed ads, 1080 × 1350 px for 4:5 portrait feed ads and 1080 × 1920 px for story ads. Keep text on the image under about 20% of the area.',
      },
      {
        q: 'How long should Instagram ad copy be?',
        a: 'Meta recommends around 125 characters of primary text and a headline of about 27 characters. Instagram feed captions truncate at roughly 125 characters, so lead with the offer.',
      },
      SHARED_PRIVACY_FAQ,
      SHARED_TRIAL_FAQ,
    ],
    related: ['facebook-ad-preview', 'instagram-post-preview', 'instagram-story-preview'],
  },

  // ──────────────────────────────────────────────────────────────── LinkedIn ad
  {
    slug: 'linkedin-ad-preview',
    platformId: 'linkedin',
    isAdvert: true,
    shortName: 'LinkedIn ad',
    title: 'Free LinkedIn Ad Preview Tool — Mock Up Sponsored Content Fast',
    description:
      'Preview a LinkedIn single image ad with the Promoted label, headline card and CTA button before building it in Campaign Manager. Free, no ad account needed.',
    h1: 'Free LinkedIn Ad Preview Tool',
    intro:
      'Mock up a LinkedIn single image ad — creative, intro text, headline and CTA button — without opening Campaign Manager.',
    answer:
      'A LinkedIn ad preview tool renders your creative, intro text, headline and call-to-action as a sponsored single image ad with the Promoted label, so you can review or present it before building the campaign in LinkedIn Campaign Manager.',
    specsHeading: 'LinkedIn single image ad specs at a glance',
    specs: [
      { label: 'Recommended creative', value: '1200 × 627 px (1.91:1)' },
      { label: 'Square creative', value: '1200 × 1200 px (1:1)' },
      { label: 'Intro text', value: '150 characters recommended to avoid truncation' },
      { label: 'Headline', value: '70 characters recommended, 200 maximum' },
      { label: 'Company logo', value: '300 × 300 px' },
      { label: 'Maximum file size', value: '5 MB' },
    ],
    sections: [
      {
        h2: 'Why mock up a LinkedIn ad first?',
        body:
          'LinkedIn Campaign Manager only previews an ad once the campaign shell exists, which is a lot of setup for a concept that may not survive the client meeting. Intro text truncates at around 150 characters and the headline card sits beneath the creative at a size that punishes long copy. Seeing the finished unit early tells you whether the message works before anyone builds a campaign around it.',
      },
      {
        h2: 'What this LinkedIn ad preview shows you',
        bullets: [
          { t: 'Promoted label', d: 'The sponsored marker beneath your company page name.' },
          { t: 'Intro text truncation', d: 'Where the copy collapses, so the hook lands in the visible line.' },
          { t: 'Headline card', d: 'The headline strip under the creative where the 70-character guidance matters.' },
          { t: 'Call-to-action button', d: 'The CTA button at the right of the headline card.' },
          { t: 'Reactions and reposts row', d: 'The engagement bar that makes a client mockup look real.' },
        ],
      },
      {
        h2: 'How to preview a LinkedIn ad',
        body:
          'Enter your company name and logo, upload the creative and write the intro text. Set Post Type to Advert, add a headline and pick a call to action, then choose the LinkedIn tab. Share the mockup link for approval before building anything in Campaign Manager.',
      },
    ],
    faqs: [
      {
        q: 'What size should a LinkedIn single image ad be?',
        a: 'Use 1200 × 627 px (1.91:1) as the default, or 1200 × 1200 px for a square that takes more feed space. Keep files under 5 MB.',
      },
      {
        q: 'How long should LinkedIn ad copy be?',
        a: 'Keep intro text to around 150 characters to avoid truncation and headlines to around 70 characters. Headlines can technically run to 200 characters but will be cut in most placements.',
      },
      {
        q: 'Can I preview a LinkedIn ad without Campaign Manager?',
        a: 'Yes. The mockup renders in your browser from the creative and copy you enter — no LinkedIn ad account or campaign required.',
      },
      SHARED_PRIVACY_FAQ,
      SHARED_TRIAL_FAQ,
    ],
    related: ['facebook-ad-preview', 'linkedin-post-preview', 'instagram-ad-preview'],
  },
]

export const PLATFORM_SLUGS = PLATFORM_PAGES.map((p) => p.slug)

export function getPlatformPage(slug: string): PlatformPage | undefined {
  return PLATFORM_PAGES.find((p) => p.slug === slug)
}
