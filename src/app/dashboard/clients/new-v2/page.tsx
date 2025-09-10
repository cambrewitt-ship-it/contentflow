"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { Textarea } from "components/ui/textarea";
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
  const [formData, setFormData] = useState({
    name: "",
    company_description: "",
    website_url: "",
    brand_tone: "",
    target_audience: "",
    value_proposition: "",
    caption_dos: "",
    caption_donts: "",
    brand_voice_examples: ""
  });
  
  const [isEditing, setIsEditing] = useState(true); // Start in editing mode for new client
  const [uploading, setUploading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [brandDocuments, setBrandDocuments] = useState<BrandDocument[]>([]);
  const [websiteScrapes, setWebsiteScrapes] = useState<WebsiteScrape[]>([]);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
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
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      let clientId = createdClientId;
      
      // If we already have a client ID from scraping, update it instead of creating a new one
      if (createdClientId) {
        console.log('🔄 Updating existing client:', createdClientId);
        const updateResponse = await fetch(`/api/clients/${createdClientId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.error || "Failed to update client");
        }
        
        console.log('✅ Client updated successfully');
      } else {
        // If no existing client, create a new one
        console.log('🆕 Creating new client');
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

        const { clientId: newClientId } = await response.json();
        clientId = newClientId;
        console.log('✅ New client created:', clientId);
      }
      
      // Trigger sidebar refresh by dispatching a custom event
      window.dispatchEvent(new CustomEvent('clientCreated', { detail: { clientId } }));
      
      // Redirect to the client's dashboard
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
      // First create a temporary client to get a clientId
      console.log('🔍 Creating temporary client for scraping...');
      const createResponse = await fetch("/api/clients/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name || "Temporary Client",
          company_description: formData.company_description || "",
          website_url: formData.website_url,
          brand_tone: formData.brand_tone || "",
          target_audience: formData.target_audience || "",
          value_proposition: formData.value_proposition || "",
          caption_dos: formData.caption_dos || "",
          caption_donts: formData.caption_donts || "",
          brand_voice_examples: formData.brand_voice_examples || ""
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create temporary client');
      }

      const { clientId } = await createResponse.json();
      console.log('✅ Temporary client created with ID:', clientId);
      setCreatedClientId(clientId); // Store the client ID for later use

      // Now use the EXACT same approach as the working client dashboard
      // First, scrape the website
      const scrapeResponse = await fetch(`/api/clients/${clientId}/scrape-website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formData.website_url })
      });

      if (!scrapeResponse.ok) {
        throw new Error('Failed to scrape website');
      }

      const scrapeData = await scrapeResponse.json();
      
      if (scrapeData.success && scrapeData.data && scrapeData.data.id) {
        // Now analyze the scraped content with AI
        const analysisResponse = await fetch(`/api/clients/${clientId}/analyze-website`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scrapeId: scrapeData.data.id })
        });

        if (analysisResponse.ok) {
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

          // Update the client in the database with all the AI analysis results
          try {
            const updateResponse = await fetch(`/api/clients/${clientId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: analysisData.analysis.company_name,
                company_description: analysisData.analysis.company_description,
                target_audience: analysisData.analysis.target_audience,
                value_proposition: analysisData.analysis.value_proposition,
                brand_tone: analysisData.analysis.brand_tone
              })
            });

            if (updateResponse.ok) {
              console.log('✅ Client updated in database with AI analysis results');
            } else {
              console.warn('⚠️ Failed to update client in database');
            }
          } catch (updateError) {
            console.warn('⚠️ Error updating client:', updateError);
          }

          setMessage({ type: 'success', text: 'Website analyzed and form auto-filled successfully!' });
          setTimeout(() => setMessage(null), 3000);
        } else {
          throw new Error('Failed to analyze website content');
        }
      } else {
        throw new Error('No scrape data received');
      }

    } catch (error) {
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
    <div className="min-h-screen bg-gray-50 p-6">
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
          <h1 className="text-3xl font-bold text-gray-900">Create New Client (V2)</h1>
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
              {/* Website URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website URL
                </label>
                {isEditing ? (
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

              {/* Client Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Name <span className="text-red-500">*</span>
                </label>
                {isEditing ? (
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
                {isEditing ? (
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
                {isEditing ? (
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
                {isEditing ? (
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
                  {isEditing ? (
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
                  {isEditing ? (
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
                {isEditing ? (
                  <div>
                    <Textarea
                      value={formData.brand_voice_examples}
                      onChange={(e) => handleInputChange('brand_voice_examples', e.target.value)}
                      placeholder="Paste examples of your brand's voice from website content, social media posts, or brand documents. These will help AI understand your writing style and tone."
                      rows={4}
                      className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-blue-600 text-sm mt-1">
                      💡 Include snippets from your website, social media, or brand documents that show how your brand should sound
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-md min-h-[80px]">
                      {formData.brand_voice_examples || 'No brand voice examples provided'}
                    </p>
                    {formData.brand_voice_examples && (
                      <p className="text-blue-600 text-sm mt-1">
                        These examples will guide AI caption generation to match your brand's voice
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Brand Documents Card - Copied from BrandInformationPanel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Brand Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Upload Section */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-500 font-medium">
                        Upload a brand document
                      </span>
                      <span className="text-gray-500"> or drag and drop</span>
                    </label>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    PDF, Word documents, and text files up to 10MB
                  </p>
                </div>

                {/* Documents List */}
                {brandDocuments.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Uploaded Documents</h4>
                    {brandDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{doc.filename}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(doc.file_size)} • {doc.file_type.toUpperCase()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            doc.processing_status === 'completed' ? 'bg-green-100 text-green-800' :
                            doc.processing_status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            doc.processing_status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {doc.processing_status}
                          </span>
                          <a
                            href={doc.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-500 text-sm"
                          >
                            View
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Create Client Button - Moved to bottom of Brand Documents card */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Client
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800 text-sm">{errors.submit}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
