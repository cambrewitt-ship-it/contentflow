"use client";

import { useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, RotateCcw, Loader2 } from "lucide-react";

export type EditableApprovalStatus = "pending" | "approved" | "needs_attention" | "rejected";

const OPTIONS: Array<{
  id: EditableApprovalStatus;
  label: string;
  Icon: typeof CheckCircle;
  active: string;
}> = [
  { id: "pending", label: "Clear", Icon: RotateCcw, active: "bg-gray-800 text-white border-gray-800" },
  { id: "approved", label: "Approved", Icon: CheckCircle, active: "bg-green-600 text-white border-green-600" },
  { id: "needs_attention", label: "Improve", Icon: AlertTriangle, active: "bg-amber-500 text-white border-amber-500" },
  { id: "rejected", label: "Rejected", Icon: XCircle, active: "bg-red-600 text-white border-red-600" },
];

const normalize = (status?: string | null): EditableApprovalStatus => {
  if (status === "approved" || status === "rejected") return status;
  if (status === "needs_attention" || status === "changes_requested") return "needs_attention";
  return "pending";
};

/** Row of buttons to set or clear a post's approval status. "Clear" puts it back to Pending. */
export function ApprovalStatusEditor({
  status,
  onChange,
  disabled,
}: {
  status?: string | null;
  onChange: (status: EditableApprovalStatus) => Promise<boolean>;
  disabled?: boolean;
}) {
  const [saving, setSaving] = useState<EditableApprovalStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = normalize(status);

  const handleClick = async (next: EditableApprovalStatus) => {
    if (saving || disabled || next === current) return;
    setSaving(next);
    setError(null);
    const ok = await onChange(next);
    setSaving(null);
    if (!ok) setError("Couldn't update the status. Please try again.");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map(({ id, label, Icon, active }) => {
          const isCurrent = id === current;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleClick(id)}
              disabled={disabled || !!saving}
              title={id === "pending" ? "Clear the status (back to Pending)" : `Mark as ${label}`}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:cursor-not-allowed ${
                isCurrent ? active : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              }`}
            >
              {saving === id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
              {id === "pending" && isCurrent ? "Pending" : label}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
