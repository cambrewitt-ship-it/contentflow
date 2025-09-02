import React, { useState, useEffect } from 'react';

interface PerformanceMetrics {
  queryDuration: string;
  optimized: boolean;
  totalPosts: number;
  loadedPosts: number;
  hasMore: boolean;
}

interface PerformanceMonitorProps {
  metrics?: PerformanceMetrics;
  showDetails?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ 
  metrics, 
  showDetails = false 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetrics[]>([]);

  useEffect(() => {
    if (metrics) {
      setPerformanceHistory(prev => [metrics, ...prev.slice(0, 9)]); // Keep last 10 entries
    }
  }, [metrics]);

  if (!metrics && !showDetails) return null;

  const avgDuration = performanceHistory.length > 0 
    ? performanceHistory.reduce((sum, m) => sum + parseInt(m.queryDuration), 0) / performanceHistory.length
    : 0;

  const isSlowQuery = metrics && parseInt(metrics.queryDuration) > 1000;
  const isVerySlowQuery = metrics && parseInt(metrics.queryDuration) > 5000;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className={`mb-2 px-3 py-1 rounded text-xs font-medium transition-colors ${
          isVerySlowQuery 
            ? 'bg-red-500 text-white' 
            : isSlowQuery 
            ? 'bg-yellow-500 text-white' 
            : 'bg-green-500 text-white'
        }`}
      >
        {metrics ? `${metrics.queryDuration}` : 'Perf'}
      </button>

      {/* Performance Panel */}
      {isVisible && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
          <h3 className="font-semibold text-sm mb-2">Query Performance</h3>
          
          {metrics && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className={`font-medium ${
                  isVerySlowQuery ? 'text-red-600' : 
                  isSlowQuery ? 'text-yellow-600' : 
                  'text-green-600'
                }`}>
                  {metrics.queryDuration}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>Optimized:</span>
                <span className={metrics.optimized ? 'text-green-600' : 'text-red-600'}>
                  {metrics.optimized ? '✓' : '✗'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>Posts:</span>
                <span>{metrics.loadedPosts} / {metrics.totalPosts}</span>
              </div>
              
              {metrics.hasMore && (
                <div className="text-yellow-600 text-xs">
                  ⚠️ More posts available
                </div>
              )}
            </div>
          )}

          {showDetails && performanceHistory.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <h4 className="font-medium text-xs mb-2">Recent Performance</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Average:</span>
                  <span>{avgDuration.toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Queries:</span>
                  <span>{performanceHistory.length}</span>
                </div>
              </div>
              
              <div className="mt-2 max-h-20 overflow-y-auto">
                {performanceHistory.slice(0, 5).map((entry, index) => (
                  <div key={index} className="flex justify-between text-xs text-gray-600">
                    <span>#{performanceHistory.length - index}:</span>
                    <span className={parseInt(entry.queryDuration) > 1000 ? 'text-red-500' : 'text-green-500'}>
                      {entry.queryDuration}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Tips */}
          {isSlowQuery && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-yellow-600">
                💡 <strong>Slow Query Detected</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Check database indexes</li>
                  <li>• Reduce query limit</li>
                  <li>• Consider pagination</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;
