import { Loader2 } from "lucide-react";

// Lets Next.js prefetch this boundary so sidebar navigation between client
// pages switches instantly instead of waiting on the dynamic route.
export default function ClientLoading() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );
}
