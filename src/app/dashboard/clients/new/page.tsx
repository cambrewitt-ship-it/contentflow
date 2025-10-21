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
  FileText
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
    brand_color: "#4ade80" // Default green color for LATE profile
  });
  
  const [uploading, setUploading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'idle' | 'creating' | 'setting-up-social' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [brandDocuments] = useState<BrandDocument[]>([]);
  const [websiteScrapes] = useState<WebsiteScrape[]>([]);
  const [lateProfileCreated, setLateProfileCreated] = useState(false);
  const isSubmittingRef = useRef(false);
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
      
      const response = await fetch("/api/clients/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken() || ''}`,
        },
        body: JSON.stringify(formData),
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
      
      // Show success message with LATE profile status
      if (lateProfileCreated) {
        setMessage({ 
          type: 'success', 
          text: `Client created successfully! Social media profile is ready with LATE integration.` 
        });
      } else {
        setMessage({ 
          type: 'success', 
          text: `Client created successfully! Note: Social media profile setup encountered an issue but client was saved.` 
        });
      }
      
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
        brand_color: "#4ade80"
      });
      
      // Redirect after a short delay to show the success message
      setTimeout(() => {
        // Trigger sidebar refresh by dispatching a custom event
        window.dispatchEvent(new CustomEvent('clientCreated', { detail: { clientId } }));
        
        // Redirect to the client's dashboard
        router.push(`/dashboard/client/${clientId}`);
      }, 2000);
      
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


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);

      // For new client, we'll use a temporary upload approach
      // This would need to be implemented in the backend
      setMessage({ type: 'error', text: 'File upload not yet implemented for new clients. Please create the client first, then upload documents.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to upload document' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setUploading(false);
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
        const errorData = await scrapeResponse.json();
        console.error('❌ Scrape failed:', errorData);
        throw new Error(errorData.error || 'Failed to scrape website');
      }

      const scrapeData = await scrapeResponse.json();
      console.log('✅ Scrape data received:', scrapeData);
      
      if (scrapeData.success && scrapeData.data && scrapeData.data.id) {
        // Now analyze the scraped content with AI using the temp route
        console.log('🤖 Starting AI analysis...');
        const analysisResponse = await fetch('/api/clients/temp/analyze-website', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAccessToken() || ''}`,
          },
          body: JSON.stringify({ scrapeId: scrapeData.data.id })
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
          const errorData = await analysisResponse.json();
          console.error('❌ Analysis failed:', errorData);
          throw new Error(errorData.error || 'Failed to analyze website content');
        }
      } else {
        throw new Error('No scrape data received');
      }

    } catch (error) {
      console.error('❌ Website processing failed:', error);
      setMessage({ type: 'error', text: `Failed to process website: ${error instanceof Error ? error.message : 'Unknown error'}` });
      setTimeout(() => setMessage(null), 3000);
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
            <CardContent className="space-y-4">
              {/* AI Brand Info Generation Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
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
