"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Loader2, 
  Plus,
  ArrowLeft, 
  Globe, 
  CheckCircle, 
  AlertCircle,
  Upload,
  X
} from "lucide-react";
import Link from "next/link";

// Types copied from BrandInformationPanel
interface BrandDocument {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  file_type: string;
  processing_status: string;
  created_at: string;
}

interface WebsiteScrape {
  id: string;
  url: string;
  page_title: string;
  meta_description: string;
  scraped_content: string;
  scrape_status: string;
  scraped_at: string;
}

export default function NewClientPageV2() {
  const { getAccessToken } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    company_description: "",
    website_url: "",
    brand_tone: "",
    target_audience: "",
    value_proposition: "",
    caption_dos: "",
    caption_donts: "",
    brand_voice_examples: "",
    region: "",
    brand_color: "#4ade80" // Default green color for LATE profile
  });
  
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'idle' | 'creating' | 'setting-up-social' | 'uploading-logo' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [brandDocuments] = useState<BrandDocument[]>([]);
  const [websiteScrapes] = useState<WebsiteScrape[]>([]);
  const isSubmittingRef = useRef(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFileData, setLogoFileData] = useState<{ base64: string; filename: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Client name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Client name must be at least 2 characters";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildClientPayload = () => {
    const payload: Record<string, string> = {
      name: formData.name.trim(),
      brand_color: formData.brand_color,
    };

    const optionalTextFields = [
      'company_description',
      'brand_tone',
      'target_audience',
      'value_proposition',
      'caption_dos',
      'caption_donts',
      'brand_voice_examples',
    ] as const;

    optionalTextFields.forEach((field) => {
      const value = formData[field].trim();
      if (value) {
        payload[field] = value;
      }
    });

    const websiteUrl = formData.website_url.trim();
    if (websiteUrl) {
      payload.website_url = websiteUrl;
    }

    return payload;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
    // Clear submit error when user makes any changes
    if (errors.submit) {
      setErrors(prev => ({ ...prev, submit: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission using both state and ref
    if (loading || isSubmittingRef.current) {
      console.log('⚠️ Form already submitting, ignoring duplicate submission');
      return;
    }
    
    console.log('🚀 Form submission started');
    console.log('📋 Form data:', formData);
    
    if (!validateForm()) {
      console.log('❌ Form validation failed');
      return;
    }

    console.log('✅ Form validation passed, starting client creation...');
    
    // Clear previous errors and messages
    setErrors({});
    setMessage(null);
    
    setLoading(true);
    setLoadingStage('creating');
    isSubmittingRef.current = true;
    
    try {
      // Always create a new client when user clicks "Create New Client" button
      // This ensures LATE profile creation happens even if there was a temporary client from scraping
      console.log('🆕 Creating new client with LATE profile integration');
      setLoadingStage('setting-up-social');

      const payload = buildClientPayload();
      console.log('📦 Client payload:', payload);
      
      const response = await fetch("/api/clients/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken() || ''}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Client creation failed:", errorData);
        
        // Handle plan limit errors specifically
        if (response.status === 403 && errorData.current && errorData.max) {
          setErrors({
            submit: `${errorData.error} You currently have ${errorData.current} clients out of ${errorData.max} allowed.`
          });
        } else {
          // Handle other API errors
          setErrors({
            submit: errorData.error || "Failed to create client"
          });
        }
        return; // Don't throw, just return early
      }

      const { clientId: newClientId, lateProfileId, lateProfileCreated } = await response.json();
      const clientId = newClientId;
      console.log('✅ New client created:', clientId);
      console.log('🎯 LATE profile created:', lateProfileCreated, lateProfileId);

      let finalMessageType: 'success' | 'error' = 'success';
      let finalMessageText = lateProfileCreated
        ? 'Client created successfully! Social media profile is ready with LATE integration.'
        : 'Client created successfully! Note: Social media profile setup encountered an issue but client was saved.';

      if (logoFileData) {
        try {
          await uploadLogoForCreatedClient(clientId);
          finalMessageText += ' Logo uploaded successfully.';
        } catch (logoError) {
          console.error('❌ Logo upload failed after client creation:', logoError);
          finalMessageType = 'error';
          finalMessageText = `Client created but failed to upload logo: ${logoError instanceof Error ? logoError.message : 'Unknown error'}`;
        }
      }

      setMessage({
        type: finalMessageType,
        text: finalMessageText
      });

      // Clear the form after successful creation
      setFormData({
        name: "",
        company_description: "",
        website_url: "",
        brand_tone: "",
        target_audience: "",
        value_proposition: "",
        caption_dos: "",
        caption_donts: "",
        brand_voice_examples: "",
        region: "",
        brand_color: "#4ade80"
      });
      
      if (finalMessageType === 'success') {
        // Redirect after a short delay to show the success message
        setTimeout(() => {
          // Trigger sidebar refresh by dispatching a custom event
          window.dispatchEvent(new CustomEvent('clientCreated', { detail: { clientId } }));
          
          // Redirect to the client's dashboard
          router.push(`/dashboard/client/${clientId}`);
        }, 2000);
      }
      
    } catch (error) {
      console.error("❌ Unexpected error creating client:", error);
      setErrors({
        submit: "An unexpected error occurred. Please try again."
      });
    } finally {
      setLoading(false);
      setLoadingStage('idle');
      isSubmittingRef.current = false;
    }
  };
  const handleLogoSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLogoError(null);

    if (!file.type.startsWith('image/')) {
      setLogoError('Please select an image file.');
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLogoError('File size must be less than 5MB.');
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      return;
    }

    const validateSquareImage = (fileToValidate: File): Promise<boolean> => {
      return new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          resolve(img.width === img.height);
        };
        img.onerror = () => resolve(false);
        img.src = URL.createObjectURL(fileToValidate);
      });
    };

    setUploadingLogo(true);

    try {
      const isSquare = await validateSquareImage(file);
      if (!isSquare) {
        setLogoError('Logo must be a square image (equal width and height).');
        setUploadingLogo(false);
        if (logoInputRef.current) {
          logoInputRef.current.value = '';
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        setLogoPreview(base64Data);
        setLogoFileData({ base64: base64Data, filename: file.name });
        setUploadingLogo(false);
        if (logoInputRef.current) {
          logoInputRef.current.value = '';
        }
      };
      reader.onerror = () => {
        setLogoError('Failed to read the selected image.');
        setUploadingLogo(false);
        if (logoInputRef.current) {
          logoInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('❌ Error processing logo:', error);
      setLogoError('Failed to process the selected image. Please try again.');
      setUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleLogoRemove = () => {
    setLogoPreview(null);
    setLogoFileData(null);
    setLogoError(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const uploadLogoForCreatedClient = async (clientId: string) => {
    if (!logoFileData) return;

    setLoadingStage('uploading-logo');

    const response = await fetch(`/api/clients/${clientId}/logo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken() || ''}`,
      },
      body: JSON.stringify({
        imageData: logoFileData.base64,
        filename: logoFileData.filename,
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to upload logo';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (parseError) {
        console.error('❌ Failed to parse logo upload error response:', parseError);
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ Logo uploaded for new client:', data.logoUrl);

    setLogoPreview(null);
    setLogoFileData(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleWebsiteScrape = async () => {
    if (!formData.website_url) {
      setMessage({ type: 'error', text: 'Please enter a website URL first' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setScraping(true);
    
    try {
      console.log('🔍 Starting website scraping using temp route...');
      
      // Use the temp scraping route directly - no need to create a temporary client
      const scrapeResponse = await fetch('/api/clients/temp/scrape-website', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken() || ''}`,
        },
        body: JSON.stringify({ url: formData.website_url })
      });

      console.log('📡 Scrape response status:', scrapeResponse.status);

      if (!scrapeResponse.ok) {
        let errorData;
        try {
          errorData = await scrapeResponse.json();
        } catch (parseError) {
          console.error('❌ Failed to parse error response:', parseError);
          errorData = { error: 'Failed to scrape website', details: 'Invalid response format' };
        }
        
        console.error('❌ Scrape failed:', {
          status: scrapeResponse.status,
          statusText: scrapeResponse.statusText,
          errorData
        });
        
        // Extract meaningful error message
        const errorMessage = errorData?.error || errorData?.message || 'Failed to scrape website';
        const errorDetails = errorData?.details ? ` (${errorData.details})` : '';
        
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      const scrapeData = await scrapeResponse.json();
      console.log('✅ Scrape data received:', scrapeData);
      
      if (scrapeData.success && scrapeData.data) {
        // Now analyze the scraped content with AI using the temp route
        console.log('🤖 Starting AI analysis...');
        const analysisResponse = await fetch('/api/clients/temp/analyze-website', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAccessToken() || ''}`,
          },
          body: JSON.stringify({ scrapeData: scrapeData.data })
        });

        console.log('📡 Analysis response status:', analysisResponse.status);

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          console.log('✅ Analysis data received:', analysisData);
          
          // Auto-fill the form fields with AI analysis results (including company name)
          setFormData(prev => ({
            ...prev,
            name: analysisData.analysis.company_name,
            company_description: analysisData.analysis.company_description,
            target_audience: analysisData.analysis.target_audience,
            value_proposition: analysisData.analysis.value_proposition,
            brand_tone: analysisData.analysis.brand_tone
          }));

          setMessage({ type: 'success', text: 'Website analyzed and form auto-filled successfully! Click "Create New Client" to save.' });
          setTimeout(() => setMessage(null), 3000);
        } else {
          let errorData;
          try {
            errorData = await analysisResponse.json();
          } catch (parseError) {
            console.error('❌ Failed to parse analysis error response:', parseError);
            errorData = { error: 'Failed to analyze website content', details: 'Invalid response format' };
          }
          
          console.error('❌ Analysis failed:', {
            status: analysisResponse.status,
            statusText: analysisResponse.statusText,
            errorData
          });
          
          const errorMessage = errorData?.error || errorData?.message || 'Failed to analyze website content';
          const errorDetails = errorData?.details ? ` (${errorData.details})` : '';
          
          throw new Error(`${errorMessage}${errorDetails}`);
        }
      } else {
        throw new Error('No scrape data received');
      }

    } catch (error) {
      console.error('❌ Website processing failed:', error);
      
      // Determine user-friendly error message
      let errorMessage = 'Failed to process website';
      
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          errorMessage = 'Website not found. Please check the URL and try again.';
        } else if (error.message.includes('403')) {
          errorMessage = 'Access denied. The website may be blocking automated requests.';
        } else if (error.message.includes('429')) {
          errorMessage = 'Rate limited. Please wait a moment and try again.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. The website may be slow or unreachable.';
        } else if (error.message.includes('unreachable') || error.message.includes('ENOTFOUND')) {
          errorMessage = 'Website is unreachable. Please check the URL and try again.';
        } else if (error.message.includes('Invalid URL')) {
          errorMessage = 'Invalid URL format. Please enter a valid website URL.';
        } else {
          errorMessage = `Failed to process website: ${error.message}`;
        }
      } else {
        errorMessage = 'An unexpected error occurred while processing the website.';
      }
      
      setMessage({ type: 'error', text: errorMessage });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setScraping(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-green-200 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New Client</h1>
          <p className="text-gray-600 mt-2">
            Add a new client with full brand information and web scraping capabilities
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-md ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 mr-2" />
              )}
              {message.text}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Brand Information Card - Copied from BrandInformationPanel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Brand Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* AI Brand Info Generation Card */}
                <div className="lg:col-span-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    💡 AI Brand Info Generation
                  </h3>
                  <p className="text-blue-800 text-sm mb-4">
                    Enter your website URL below and our AI will analyze your business to pre-fill your brand profile. Review and edit any details to ensure accuracy.
                  </p>
                  
                  {/* Website URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website URL
                    </label>
                    {true ? (
                      <div className="flex gap-2">
                        <Input
                          value={formData.website_url}
                          onChange={(e) => handleInputChange('website_url', e.target.value)}
                          placeholder="https://example.com"
                          type="url"
                        />
                        <Button
                          onClick={handleWebsiteScrape}
                          disabled={scraping || !formData.website_url}
                          size="sm"
                        >
                          {scraping ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Globe className="w-4 h-4 mr-2" />
                          )}
                          Scrape
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                        {formData.website_url || 'No website URL provided'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Client Logo Upload Card */}
                <div className="lg:col-span-1 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                    Client Logo
                  </h3>

                  <div className="flex flex-col items-center gap-3">
                    <div className="relative h-24 w-24">
                      {logoPreview ? (
                        <>
                          <img
                            src={logoPreview}
                            alt="Client logo preview"
                            className="h-24 w-24 rounded-full object-cover border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={handleLogoRemove}
                            disabled={loading}
                            aria-label="Remove logo"
                            className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <div className="h-24 w-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm">
                          Logo
                        </div>
                      )}
                    </div>

                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={handleLogoSelection}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo || loading}
                      className="w-32 justify-center"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {logoPreview ? 'Change' : 'Upload'}
                    </Button>

                  </div>

                  {logoError && (
                    <p className="text-sm text-red-600 mt-3">{logoError}</p>
                  )}
                </div>
              </div>

              {/* Client Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Name <span className="text-red-500">*</span>
                </label>
                {true ? (
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter client name"
                    className={errors.name ? "border-red-500" : ""}
                    disabled={loading}
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                    {formData.name || 'No client name provided'}
                  </p>
                )}
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              {/* Company Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Description
                </label>
                {true ? (
                  <Textarea
                    value={formData.company_description}
                    onChange={(e) => handleInputChange('company_description', e.target.value)}
                    placeholder="Detailed description of the company, mission, and values"
                    rows={3}
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                    {formData.company_description || 'No company description provided'}
                  </p>
                )}
              </div>


              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Audience
                </label>
                {true ? (
                  <Textarea
                    value={formData.target_audience}
                    onChange={(e) => handleInputChange('target_audience', e.target.value)}
                    placeholder="Describe your target audience"
                    rows={2}
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                    {formData.target_audience || 'No target audience specified'}
                  </p>
                )}
              </div>

              {/* Value Proposition */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Value Proposition
                </label>
                {true ? (
                  <Textarea
                    value={formData.value_proposition}
                    onChange={(e) => handleInputChange('value_proposition', e.target.value)}
                    placeholder="Your unique selling point or main benefit"
                    rows={2}
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                    {formData.value_proposition || 'No value proposition specified'}
                  </p>
                )}
              </div>

              {/* Brand Color - Hidden from UI but kept for LATE profile functionality */}
              <div className="hidden">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Color (for LATE profile)
                </label>
                {true ? (
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={formData.brand_color}
                      onChange={(e) => handleInputChange('brand_color', e.target.value)}
                      className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <Input
                      value={formData.brand_color}
                      onChange={(e) => handleInputChange('brand_color', e.target.value)}
                      placeholder="#4ade80"
                      className="flex-1"
                    />
                  </div>
                ) : (
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                    {formData.brand_color || '#4ade80'}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  This color will be used for the LATE profile associated with this client
                </p>
              </div>

            </CardContent>
          </Card>

          {/* Do's & Don'ts Card - Copied from BrandInformationPanel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Caption Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Set concrete rules for AI caption generation. These will take high priority over other brand information.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Do's */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ✅ Do&apos;s
                  </label>
                  {true ? (
                    <Textarea
                      value={formData.caption_dos}
                      onChange={(e) => handleInputChange('caption_dos', e.target.value)}
                      placeholder="e.g., Always mention pricing, Use emojis, Include call-to-action"
                      rows={4}
                      className="border-green-300 focus:ring-green-500 focus:border-green-500"
                    />
                  ) : (
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-md min-h-[80px]">
                      {formData.caption_dos || 'No Do\'s specified'}
                    </p>
                  )}
                  <p className="text-green-600 text-sm mt-1">
                    What the AI MUST include in captions
                  </p>
                </div>

                {/* Don'ts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ❌ Don&apos;ts
                  </label>
                  {true ? (
                    <Textarea
                      value={formData.caption_donts}
                      onChange={(e) => handleInputChange('caption_donts', e.target.value)}
                      placeholder="e.g., Never use slang, Avoid technical jargon, Don't mention competitors"
                      rows={4}
                      className="border-red-300 focus:ring-red-500 focus:border-red-500"
                    />
                  ) : (
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-md min-h-[80px]">
                      {formData.caption_donts || 'No Don\'ts specified'}
                    </p>
                  )}
                  <p className="text-red-600 text-sm mt-1">
                    What the AI MUST NOT include in captions
                  </p>
                </div>
              </div>

              {/* Brand Voice Examples */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Voice Examples
                </label>
                {true ? (
                  <div>
                    <Textarea
                      value={formData.brand_voice_examples}
                      onChange={(e) => setFormData({...formData, brand_voice_examples: e.target.value})}
                      placeholder="Paste examples of your brand's voice from website content, social media posts, or brand documents. These will help AI understand your writing style and tone."
                      rows={4}
                      className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-gray-600 text-sm mt-2">
                      Choose 5-10 of your best captions - quality over quantity. These examples will guide AI copy generation to match your brand&apos;s voice.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-md min-h-[80px]">
                      {formData.brand_voice_examples || "No brand voice examples provided yet."}
                    </p>
                    <p className="text-blue-600 text-sm mt-1">
                      💡 Include snippets from your website, social media, or brand documents that show how your brand should sound
                    </p>
                  </div>
                )}
              </div>

              {/* Region */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Region *
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Select your client&apos;s region to ensure content ideas only reference relevant regional holidays and events.
                </p>
                <select
                  value={formData.region}
                  onChange={(e) => handleInputChange('region', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">-- Select Region --</option>
                  <optgroup label="New Zealand">
                    <option value="New Zealand - Wellington">New Zealand - Wellington</option>
                    <option value="New Zealand - Auckland">New Zealand - Auckland</option>
                    <option value="New Zealand - Christchurch">New Zealand - Christchurch</option>
                    <option value="New Zealand - Dunedin">New Zealand - Dunedin</option>
                    <option value="New Zealand - Nelson">New Zealand - Nelson</option>
                    <option value="New Zealand - Taranaki">New Zealand - Taranaki</option>
                    <option value="New Zealand - Otago">New Zealand - Otago</option>
                    <option value="New Zealand - Tasman">New Zealand - Tasman</option>
                    <option value="New Zealand - Southland">New Zealand - Southland</option>
                    <option value="New Zealand - Other">New Zealand - Other</option>
                  </optgroup>
                  <optgroup label="Australia">
                    <option value="Australia - New South Wales">Australia - New South Wales</option>
                    <option value="Australia - Victoria">Australia - Victoria</option>
                    <option value="Australia - Queensland">Australia - Queensland</option>
                    <option value="Australia - Western Australia">Australia - Western Australia</option>
                    <option value="Australia - South Australia">Australia - South Australia</option>
                    <option value="Australia - Tasmania">Australia - Tasmania</option>
                    <option value="Australia - Northern Territory">Australia - Northern Territory</option>
                    <option value="Australia - Australian Capital Territory">Australia - Australian Capital Territory</option>
                    <option value="Australia - Other">Australia - Other</option>
                  </optgroup>
                  <optgroup label="United States">
                    <option value="USA - California">USA - California</option>
                    <option value="USA - New York">USA - New York</option>
                    <option value="USA - Texas">USA - Texas</option>
                    <option value="USA - Florida">USA - Florida</option>
                    <option value="USA - Illinois">USA - Illinois</option>
                    <option value="USA - Pennsylvania">USA - Pennsylvania</option>
                    <option value="USA - Ohio">USA - Ohio</option>
                    <option value="USA - Georgia">USA - Georgia</option>
                    <option value="USA - North Carolina">USA - North Carolina</option>
                    <option value="USA - Michigan">USA - Michigan</option>
                    <option value="USA - Other">USA - Other</option>
                  </optgroup>
                  <optgroup label="United Kingdom">
                    <option value="UK - England">UK - England</option>
                    <option value="UK - Scotland">UK - Scotland</option>
                    <option value="UK - Wales">UK - Wales</option>
                    <option value="UK - Northern Ireland">UK - Northern Ireland</option>
                    <option value="UK - Other">UK - Other</option>
                  </optgroup>
                  <optgroup label="Canada">
                    <option value="Canada - Ontario">Canada - Ontario</option>
                    <option value="Canada - Quebec">Canada - Quebec</option>
                    <option value="Canada - British Columbia">Canada - British Columbia</option>
                    <option value="Canada - Alberta">Canada - Alberta</option>
                    <option value="Canada - Other">Canada - Other</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="International - General">International - General</option>
                    <option value="Other">Other (Please specify)</option>
                  </optgroup>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Create Client Button */}
          <div className="flex justify-end">
            <Button 
              onClick={(e) => {
                console.log('🖱️ Create Client button clicked');
                console.log('🔄 Loading state:', loading);
                console.log('🔄 Loading stage:', loadingStage);
                console.log('🔄 Is submitting ref:', isSubmittingRef.current);
                
                // Additional protection against double clicks
                if (loading || isSubmittingRef.current) {
                  console.log('⚠️ Button click ignored - already submitting');
                  return;
                }
                
                handleSubmit(e);
              }}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {loadingStage === 'creating' ? 'Creating client...' : 
                   loadingStage === 'setting-up-social' ? 'Setting up social media...' : 
                   loadingStage === 'uploading-logo' ? 'Uploading logo...' :
                   'Creating...'}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Client
                </>
              )}
            </Button>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-red-800 font-medium">Error creating client</p>
                  <p className="text-red-700 text-sm mt-1">{errors.submit}</p>
                  {errors.submit.includes('upgrade your plan') && (
                    <div className="mt-3">
                      <a 
                        href="/settings/billing" 
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Upgrade Plan
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
