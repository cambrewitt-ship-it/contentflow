'use client';

import { useState } from 'react';
import { Button } from 'components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';

interface MigrationResult {
  table: string;
  converted: number;
  found?: number;
  error?: string;
  message?: string;
}

interface MigrationResponse {
  success: boolean;
  message: string;
  totalFound: number;
  totalConverted: number;
  results: MigrationResult[];
  dryRun: boolean;
}

export default function MigrateImagesPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<MigrationResponse | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [limit, setLimit] = useState(10);

  const runMigration = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {
      const response = await fetch('/api/migrate-base64-to-blob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dryRun,
          limit
        })
      });
      
      const data = await response.json();
      setResults(data);
      
      if (data.success) {
        console.log('✅ Migration completed successfully:', data);
      } else {
        console.error('❌ Migration failed:', data);
      }
    } catch (error) {
      console.error('❌ Error running migration:', error);
      setResults({
        success: false,
        message: 'Failed to run migration',
        totalFound: 0,
        totalConverted: 0,
        results: [],
        dryRun: false
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Migrate Base64 Images to Vercel Blob URLs</CardTitle>
            <p className="text-muted-foreground">
              This tool converts base64 images stored in the database to Vercel Blob URLs to fix the long URL issue in edit functionality.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Controls */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="dryRun"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="dryRun" className="text-sm font-medium">
                  Dry Run (preview only, don't make changes)
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <label htmlFor="limit" className="text-sm font-medium">
                  Limit per table:
                </label>
                <input
                  type="number"
                  id="limit"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                  min="1"
                  max="100"
                  className="w-20 px-2 py-1 border rounded"
                />
              </div>
            </div>

            {/* Run Button */}
            <Button
              onClick={runMigration}
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? 'Running Migration...' : (dryRun ? 'Preview Migration' : 'Run Migration')}
            </Button>

            {/* Results */}
            {results && (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  results.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <h3 className={`font-semibold ${
                    results.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {results.success ? '✅ Migration Successful' : '❌ Migration Failed'}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    results.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {results.message}
                  </p>
                  {results.dryRun && (
                    <p className="text-sm text-blue-700 mt-1">
                      This was a dry run - no changes were made to the database.
                    </p>
                  )}
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm font-medium text-blue-800">Total Found</div>
                    <div className="text-2xl font-bold text-blue-900">{results.totalFound}</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-sm font-medium text-green-800">Total Converted</div>
                    <div className="text-2xl font-bold text-green-900">{results.totalConverted}</div>
                  </div>
                </div>

                {/* Table Results */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Table Results:</h4>
                  {results.results.map((result, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{result.table}</span>
                        <div className="flex space-x-4 text-sm">
                          <span>Found: {result.found || 0}</span>
                          <span>Converted: {result.converted}</span>
                        </div>
                      </div>
                      {result.error && (
                        <p className="text-red-600 text-sm mt-1">Error: {result.error}</p>
                      )}
                      {result.message && (
                        <p className="text-blue-600 text-sm mt-1">{result.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-semibold text-yellow-800 mb-2">Instructions:</h4>
              <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                <li>Start with a dry run to see how many images need to be converted</li>
                <li>Use a small limit (like 10) for testing</li>
                <li>Once you're confident, uncheck "Dry Run" and run the migration</li>
                <li>Monitor the results and increase the limit if needed</li>
                <li>This migration will convert base64 images to Vercel Blob URLs</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
