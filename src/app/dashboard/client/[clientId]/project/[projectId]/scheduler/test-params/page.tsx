interface PageProps {
  params: {
    clientId: string;
    projectId: string;
  };
}

export default function TestParamsPage({ params }: PageProps) {
  console.log('🧪 Test params page called with:', params);
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Route Parameters Test</h1>
      <div className="space-y-4">
        <div>
          <strong>Raw params object:</strong>
          <pre className="bg-gray-100 p-2 rounded mt-2">
            {JSON.stringify(params, null, 2)}
          </pre>
        </div>
        <div>
          <strong>clientId:</strong> {params.clientId} (type: {typeof params.clientId})
        </div>
        <div>
          <strong>projectId:</strong> {params.projectId} (type: {typeof params.projectId})
        </div>
        <div>
          <strong>Current URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'Server side'}
        </div>
      </div>
    </div>
  );
}
