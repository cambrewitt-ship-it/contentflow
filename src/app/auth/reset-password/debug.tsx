"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

export default function ResetPasswordDebug() {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.substring(1));
    
    const info = {
      fullUrl: window.location.href,
      hash: hash || '(no hash)',
      hasHash: !!hash,
      type: hashParams.get('type') || '(missing)',
      hasAccessToken: !!hashParams.get('access_token'),
      hasRefreshToken: !!hashParams.get('refresh_token'),
      accessTokenPreview: hashParams.get('access_token')?.substring(0, 20) + '...' || '(missing)',
      allHashKeys: Array.from(hashParams.keys()),
    };
    
    setDebugInfo(info);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Password Reset Debug Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="font-mono text-sm">
            <h3 className="font-bold mb-2">URL Information:</h3>
            <div className="bg-gray-100 p-3 rounded space-y-2">
              <div><strong>Full URL:</strong> {debugInfo.fullUrl}</div>
              <div><strong>Has Hash:</strong> {debugInfo.hasHash ? '✅ Yes' : '❌ No'}</div>
              <div><strong>Hash:</strong> {debugInfo.hash}</div>
              <div><strong>Type:</strong> {debugInfo.type}</div>
              <div><strong>Has Access Token:</strong> {debugInfo.hasAccessToken ? '✅ Yes' : '❌ No'}</div>
              <div><strong>Has Refresh Token:</strong> {debugInfo.hasRefreshToken ? '✅ Yes' : '❌ No'}</div>
              <div><strong>Access Token Preview:</strong> {debugInfo.accessTokenPreview}</div>
              <div><strong>All Hash Keys:</strong> {debugInfo.allHashKeys?.join(', ') || '(none)'}</div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
            <h3 className="font-bold mb-2">Expected Format:</h3>
            <p className="text-sm">
              The URL should look like:<br/>
              <code className="bg-gray-100 px-2 py-1 rounded">
                http://localhost:3000/auth/reset-password<span className="text-red-600">#type=recovery&access_token=...&refresh_token=...</span>
              </code>
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded">
            <h3 className="font-bold mb-2">What to Check:</h3>
            <ul className="text-sm space-y-2 list-disc list-inside">
              <li>Did you click a link from the password reset email?</li>
              <li>Or did you navigate here directly? (won't work without tokens)</li>
              <li>Is "Has Hash" showing ✅ Yes?</li>
              <li>Are all tokens present? (Access Token, Refresh Token, Type=recovery)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




