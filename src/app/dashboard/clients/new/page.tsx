"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { Textarea } from "components/ui/textarea";
import { Loader2, Plus, ArrowLeft, Globe, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function NewClientPage() {
  const [formData, setFormData] = useState({
    name: "",
    company_description: "",
    website_url: "",
    brand_tone: "",
    target_audience: "",
    value_proposition: "",
    caption_dos: "",
    caption_donts: ""
  });
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch("/api/clients/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create client");
      }

      const { clientId } = await response.json();
      
      // Trigger sidebar refresh by dispatching a custom event
      window.dispatchEvent(new CustomEvent('clientCreated', { detail: { clientId } }));
      
      // Redirect to the new client's dashboard
      router.push(`/dashboard/client/${clientId}`);
      
    } catch (error) {
      console.error("Error creating client:", error);
      setErrors({
        submit: error instanceof Error ? error.message : "Failed to create client"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
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
      // Perform the actual web scraping (same logic as client dashboard)
      console.log('🔍 Fetching website content...');
      const response = await fetch(formData.website_url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentFlow/1.0)'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Extract basic information using regex (same as client dashboard)
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      
      const pageTitle = titleMatch ? titleMatch[1].trim() : '';
      const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';
      
      // Extract text content (remove HTML tags) - same as client dashboard
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
        .replace(/<[^>]+>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
        .substring(0, 5000); // Limit to first 5000 characters

      // Prepare content for AI analysis (same as client dashboard)
      const contentForAnalysis = `
Website: ${formData.website_url}
Title: ${pageTitle}
Meta Description: ${metaDescription}
Content: ${textContent}
      `.trim();

      // AI Analysis using API route (same as client dashboard)
      const analysisResponse = await fetch('/api/analyze-website-temp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentForAnalysis })
      });

      if (!analysisResponse.ok) {
        throw new Error('Failed to analyze website content');
      }

      const analysisData = await analysisResponse.json();
      
           // Auto-fill the form fields with AI analysis results (including company name)
           setFormData(prev => ({
             ...prev,
             name: analysisData.analysis.company_name,
             company_description: analysisData.analysis.company_description,
             target_audience: analysisData.analysis.target_audience,
             value_proposition: analysisData.analysis.value_proposition,
             brand_tone: analysisData.analysis.brand_tone
           }));

      setMessage({ type: 'success', text: 'Website analyzed and form auto-filled successfully!' });
      setTimeout(() => setMessage(null), 3000);

    } catch (error) {
      setMessage({ type: 'error', text: `Failed to process website: ${error instanceof Error ? error.message : 'Unknown error'}` });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setScraping(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
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
            Add a new client to your content management system
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

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              Client Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Website Scraping Section - Moved to Top */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium text-blue-900 mb-4 flex items-center">
                  <Globe className="w-5 h-5 mr-2" />
                  Quick Setup with Website Analysis
                </h3>
                <p className="text-blue-700 text-sm mb-4">
                  Enter a website URL below and let AI automatically analyze and fill in the brand information for you.
                </p>
                
                {/* Website URL */}
                <div className="mb-4">
                  <label htmlFor="website_url" className="block text-sm font-medium text-blue-900 mb-2">
                    Website URL
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="website_url"
                      type="url"
                      value={formData.website_url}
                      onChange={(e) => handleInputChange("website_url", e.target.value)}
                      placeholder="https://example.com"
                      disabled={loading || scraping}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleWebsiteScrape}
                      disabled={scraping || !formData.website_url || loading}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {scraping ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Globe className="w-4 h-4 mr-2" />
                      )}
                      {scraping ? 'Analyzing...' : 'Analyze Website'}
                    </Button>
                  </div>
                  <p className="text-blue-600 text-sm mt-1">
                    AI will analyze this website and auto-fill the brand information below
                  </p>
                </div>
              </div>

              {/* Client Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter client name"
                  className={errors.name ? "border-red-500" : ""}
                  disabled={loading}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>


              {/* Brand Information Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Brand Information</h3>
                <p className="text-gray-600 text-sm mb-4">
                  These fields will be auto-filled when you use the website analysis above, or you can fill them manually.
                </p>
                
                {/* Company Description */}
                <div className="mb-4">
                  <label htmlFor="company_description" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Description
                  </label>
                  <Textarea
                    id="company_description"
                    value={formData.company_description}
                    onChange={(e) => handleInputChange("company_description", e.target.value)}
                    placeholder="Detailed description of the company, mission, and values"
                    rows={3}
                    disabled={loading || scraping}
                  />
                  <p className="text-gray-500 text-sm mt-1">
                    This helps AI generate more contextual and on-brand content
                  </p>
                </div>

                {/* Brand Tone */}
                <div className="mb-4">
                  <label htmlFor="brand_tone" className="block text-sm font-medium text-gray-700 mb-2">
                    Brand Tone
                  </label>
                  <select
                    id="brand_tone"
                    value={formData.brand_tone}
                    onChange={(e) => handleInputChange("brand_tone", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    <option value="">Select brand tone</option>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="friendly">Friendly</option>
                    <option value="luxury">Luxury</option>
                    <option value="innovative">Innovative</option>
                    <option value="trustworthy">Trustworthy</option>
                    <option value="creative">Creative</option>
                    <option value="authoritative">Authoritative</option>
                  </select>
                  <p className="text-gray-500 text-sm mt-1">
                    The overall tone and personality of your brand
                  </p>
                </div>

                {/* Target Audience */}
                <div className="mb-4">
                  <label htmlFor="target_audience" className="block text-sm font-medium text-gray-700 mb-2">
                    Target Audience
                  </label>
                  <Textarea
                    id="target_audience"
                    value={formData.target_audience}
                    onChange={(e) => handleInputChange("target_audience", e.target.value)}
                    placeholder="Describe your target audience (e.g., &apos;Business professionals aged 25-45&apos;)"
                    rows={2}
                    disabled={loading}
                  />
                  <p className="text-gray-500 text-sm mt-1">
                    Helps AI tailor content to your specific audience
                  </p>
                </div>

                {/* Value Proposition */}
                <div className="mb-4">
                  <label htmlFor="value_proposition" className="block text-sm font-medium text-gray-700 mb-2">
                    Value Proposition
                  </label>
                  <Textarea
                    id="value_proposition"
                    value={formData.value_proposition}
                    onChange={(e) => handleInputChange("value_proposition", e.target.value)}
                    placeholder="Your unique selling point or main benefit"
                    rows={2}
                    disabled={loading || scraping}
                  />
                  <p className="text-gray-500 text-sm mt-1">
                    The core message/angle to emphasize in content
                  </p>
                </div>

                {/* Do&apos;s & Don&apos;ts Section */}
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">AI Caption Rules</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Set concrete rules for AI caption generation. These will take high priority over other brand information.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Do&apos;s */}
                    <div>
                      <label htmlFor="caption_dos" className="block text-sm font-medium text-gray-700 mb-2">
                        ✅ Do&apos;s
                      </label>
                      <Textarea
                        id="caption_dos"
                        value={formData.caption_dos}
                        onChange={(e) => handleInputChange("caption_dos", e.target.value)}
                        placeholder="e.g., Always mention pricing, Use emojis, Include call-to-action"
                        rows={4}
                        disabled={loading}
                        className="border-green-300 focus:ring-green-500 focus:border-green-500"
                      />
                      <p className="text-green-600 text-sm mt-1">
                        What the AI MUST include in captions
                      </p>
                    </div>

                    {/* Don&apos;ts */}
                    <div>
                      <label htmlFor="caption_donts" className="block text-sm font-medium text-gray-700 mb-2">
                        ❌ Don&apos;ts
                      </label>
                      <Textarea
                        id="caption_donts"
                        value={formData.caption_donts}
                        onChange={(e) => handleInputChange("caption_donts", e.target.value)}
                        placeholder="e.g., Never use slang, Avoid technical jargon, Don&apos;t mention competitors"
                        rows={4}
                        disabled={loading}
                        className="border-red-300 focus:ring-red-500 focus:border-red-500"
                      />
                      <p className="text-red-600 text-sm mt-1">
                        What the AI MUST NOT include in captions
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Error */}
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-red-800 text-sm">{errors.submit}</p>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end space-x-3">
                <Link href="/dashboard">
                  <Button type="button" variant="outline" disabled={loading}>
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Client
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
