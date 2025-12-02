'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Edit3, 
  Save, 
  X, 
  Upload, 
  Globe, 
  FileText, 
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Client, BrandDocument, WebsiteScrape } from '@/types/api';
import { useAuth } from '@/contexts/AuthContext';

interface BrandInformationPanelProps {
  clientId: string;
  client: Client;
  onUpdate: (updatedClient: Client) => void;
  brandDocuments: BrandDocument[];
  websiteScrapes: WebsiteScrape[];
}

export default function BrandInformationPanel({ clientId, client, onUpdate, brandDocuments }: BrandInformationPanelProps) {
  const { getAccessToken } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    name: client?.name || '',
    company_description: client?.company_description || '',
    website_url: client?.website_url || '',
    brand_tone: client?.brand_tone || '',
    target_audience: client?.target_audience || '',
    value_proposition: client?.value_proposition || '',
    caption_dos: client?.caption_dos || '',
    caption_donts: client?.caption_donts || '',
    brand_voice_examples: client?.brand_voice_examples || '',
    region: client?.region || '',
    timezone: client?.timezone || 'Pacific/Auckland',
  });

  // Update formData when client prop changes
  useEffect(() => {
    setFormData({
      name: client?.name || '',
      company_description: client?.company_description || '',
      website_url: client?.website_url || '',
      brand_tone: client?.brand_tone || '',
      target_audience: client?.target_audience || '',
      value_proposition: client?.value_proposition || '',
      caption_dos: client?.caption_dos || '',
      caption_donts: client?.caption_donts || '',
    brand_voice_examples: client?.brand_voice_examples || '',
      region: client?.region || '',
      timezone: client?.timezone || 'Pacific/Auckland',
    });
  }, [client]);

  // Brand documents and website scrapes are now passed as props

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken() || ''}`
        },
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
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAccessToken() || ''}`
              },
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
          {/* Client Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Name *
            </label>
            {isEditing ? (
              <Input
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter client name"
                className="font-medium"
              />
            ) : (
              <p className="text-gray-900 bg-gray-50 p-3 rounded-md font-medium">
                {client?.name || 'No client name specified'}
              </p>
            )}
          </div>

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

          {/* Region */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Region *
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Select your client&apos;s region to ensure content ideas only reference relevant regional holidays and events.
            </p>
            {isEditing ? (
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
            ) : (
              <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                {client?.region || 'No region specified - Content ideas may reference irrelevant regional holidays'}
              </p>
            )}
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone for Scheduling
            </label>
            <p className="text-xs text-gray-500 mb-2">
              This timezone will be used when scheduling posts via social media platforms
            </p>
            {isEditing ? (
              <select
                value={formData.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <optgroup label="Pacific">
                  <option value="Pacific/Auckland">New Zealand (Pacific/Auckland)</option>
                  <option value="Pacific/Chatham">New Zealand - Chatham Islands (Pacific/Chatham)</option>
                  <option value="Australia/Sydney">Australia - Sydney (Australia/Sydney)</option>
                  <option value="Australia/Melbourne">Australia - Melbourne (Australia/Melbourne)</option>
                  <option value="Australia/Brisbane">Australia - Brisbane (Australia/Brisbane)</option>
                  <option value="Australia/Perth">Australia - Perth (Australia/Perth)</option>
                  <option value="Australia/Adelaide">Australia - Adelaide (Australia/Adelaide)</option>
                  <option value="Australia/Hobart">Australia - Hobart (Australia/Hobart)</option>
                  <option value="Australia/Darwin">Australia - Darwin (Australia/Darwin)</option>
                </optgroup>
                <optgroup label="Americas">
                  <option value="America/New_York">US Eastern (America/New_York)</option>
                  <option value="America/Chicago">US Central (America/Chicago)</option>
                  <option value="America/Denver">US Mountain (America/Denver)</option>
                  <option value="America/Los_Angeles">US Pacific (America/Los_Angeles)</option>
                  <option value="America/Anchorage">US Alaska (America/Anchorage)</option>
                  <option value="Pacific/Honolulu">US Hawaii (Pacific/Honolulu)</option>
                  <option value="America/Toronto">Canada - Toronto (America/Toronto)</option>
                  <option value="America/Vancouver">Canada - Vancouver (America/Vancouver)</option>
                  <option value="America/Edmonton">Canada - Edmonton (America/Edmonton)</option>
                  <option value="America/Winnipeg">Canada - Winnipeg (America/Winnipeg)</option>
                  <option value="America/Halifax">Canada - Halifax (America/Halifax)</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="Europe/London">UK (Europe/London)</option>
                  <option value="Europe/Dublin">Ireland (Europe/Dublin)</option>
                  <option value="Europe/Paris">France (Europe/Paris)</option>
                  <option value="Europe/Berlin">Germany (Europe/Berlin)</option>
                  <option value="Europe/Rome">Italy (Europe/Rome)</option>
                  <option value="Europe/Madrid">Spain (Europe/Madrid)</option>
                  <option value="Europe/Amsterdam">Netherlands (Europe/Amsterdam)</option>
                  <option value="Europe/Brussels">Belgium (Europe/Brussels)</option>
                  <option value="Europe/Zurich">Switzerland (Europe/Zurich)</option>
                  <option value="Europe/Stockholm">Sweden (Europe/Stockholm)</option>
                </optgroup>
                <optgroup label="Asia">
                  <option value="Asia/Dubai">UAE (Asia/Dubai)</option>
                  <option value="Asia/Singapore">Singapore (Asia/Singapore)</option>
                  <option value="Asia/Hong_Kong">Hong Kong (Asia/Hong_Kong)</option>
                  <option value="Asia/Tokyo">Japan (Asia/Tokyo)</option>
                  <option value="Asia/Seoul">South Korea (Asia/Seoul)</option>
                  <option value="Asia/Shanghai">China (Asia/Shanghai)</option>
                  <option value="Asia/Kolkata">India (Asia/Kolkata)</option>
                  <option value="Asia/Bangkok">Thailand (Asia/Bangkok)</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="Africa/Johannesburg">South Africa (Africa/Johannesburg)</option>
                  <option value="America/Sao_Paulo">Brazil (America/Sao_Paulo)</option>
                  <option value="America/Mexico_City">Mexico (America/Mexico_City)</option>
                </optgroup>
              </select>
            ) : (
              <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                {client?.timezone || 'Pacific/Auckland (default)'}
              </p>
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
                  {client?.caption_dos || 'None specified'}
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
                  {client?.caption_donts || 'None specified'}
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
                  onChange={(e) => setFormData({...formData, brand_voice_examples: e.target.value})}
                  placeholder="Paste examples of your brand's voice from website content, social media posts, or brand documents. These will help AI understand your writing style and tone."
                  rows={4}
                  className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-blue-600 text-sm mt-1">
                  💡 Include snippets from your website, social media, or brand documents that show how your brand should sound
                </p>
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





    </div>
  );
}
