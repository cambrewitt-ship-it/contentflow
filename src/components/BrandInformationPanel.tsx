'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { Textarea } from 'components/ui/textarea';
import { 
  Edit3, 
  Save, 
  X, 
  Upload, 
  Globe, 
  FileText, 
  ExternalLink,
  Download,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Client, BrandDocument, WebsiteScrape } from 'types/api';

interface BrandInformationPanelProps {
  clientId: string;
  client: Client;
  onUpdate: (updatedClient: Client) => void;
  brandDocuments: BrandDocument[];
  websiteScrapes: WebsiteScrape[];
}

export default function BrandInformationPanel({ clientId, client, onUpdate, brandDocuments, websiteScrapes }: BrandInformationPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    company_description: client?.company_description || '',
    website_url: client?.website_url || '',
    brand_tone: client?.brand_tone || '',
    target_audience: client?.target_audience || '',
    value_proposition: client?.value_proposition || '',
    caption_dos: client?.caption_dos || '',
    caption_donts: client?.caption_donts || '',
    brand_voice_examples: client?.brand_voice_examples || ''
  });

  // Fetch brand documents and website scrapes
  useEffect(() => {
    // Data is now passed as props, no need to refetch
  }, [clientId]);

  // Brand documents and website scrapes are now passed as props

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const updatedClient = await response.json();
        onUpdate(updatedClient.client);
        setIsEditing(false);
        setMessage({ type: 'success', text: 'Brand information updated successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        throw new Error('Failed to update brand information');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update brand information' });
      setTimeout(() => setMessage(null), 3000);
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

      const response = await fetch(`/api/clients/${clientId}/brand-documents`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        // Brand documents are now passed as props
        setMessage({ type: 'success', text: 'Brand document uploaded successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        throw new Error('Failed to upload document');
      }
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
            company_description: analysisData.analysis.company_description,
            target_audience: analysisData.analysis.target_audience,
            value_proposition: analysisData.analysis.value_proposition,
            brand_tone: analysisData.analysis.brand_tone
          }));

          // Update the client name if provided by AI analysis
          if (analysisData.analysis.company_name) {
            const updateResponse = await fetch(`/api/clients/${clientId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: analysisData.analysis.company_name })
            });

            if (updateResponse.ok) {
              const updatedClient = await updateResponse.json();
              onUpdate(updatedClient.client);
            }
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
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-md ${
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

      {/* Brand Information Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Brand Information</CardTitle>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsEditing(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setIsEditing(true)}
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
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
                {client?.website_url || 'No website URL provided'}
              </p>
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
                {client?.company_description || 'No company description provided'}
              </p>
            )}
          </div>

          {/* Brand Tone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand Tone
            </label>
            {isEditing ? (
              <select
                value={formData.brand_tone}
                onChange={(e) => handleInputChange('brand_tone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            ) : (
              <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                {client?.brand_tone || 'No brand tone specified'}
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
                {client?.target_audience || 'No target audience specified'}
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
                {client?.value_proposition || 'No value proposition specified'}
              </p>
            )}
          </div>

          {/* Brand Voice Examples */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand Voice Examples
            </label>
            {isEditing ? (
              <div>
                <Textarea
                  value={formData.brand_voice_examples}
                  onChange={(e) => handleInputChange('brand_voice_examples', e.target.value)}
                  placeholder="Paste examples of your brand&apos;s voice from website content, social media posts, or brand documents. These will help AI understand your writing style and tone."
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
                  {client?.brand_voice_examples || 'No brand voice examples provided'}
                </p>
                {client?.brand_voice_examples && (
                  <p className="text-blue-600 text-sm mt-1">
                    These examples will guide AI caption generation to match your brand's voice
                  </p>
                )}
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Do's & Don'ts Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">AI Caption Rules</CardTitle>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsEditing(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setIsEditing(true)}
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
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
                  {client?.caption_dos || 'No Do&apos;s specified'}
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
                  {client?.caption_donts || 'No Don&apos;ts specified'}
                </p>
              )}
              <p className="text-red-600 text-sm mt-1">
                What the AI MUST NOT include in captions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Documents Card */}
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
        </CardContent>
      </Card>




    </div>
  );
}
