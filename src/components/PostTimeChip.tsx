"use client";

import { useState } from "react";
import { Clock, Loader2 } from "lucide-react";

/** "14:30:00" → "2:30 PM" */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minutes} ${ampm}`;
}

interface Props {
  /** Stored time of day, "HH:MM" or "HH:MM:SS"; empty when none is set. */
  time?: string | null;
  /** Save "HH:MM"; resolve to an error message, or null on success. Omit for read-only. */
  onSave?: (time: string) => Promise<string | null>;
}

/** Posting time pill for the post modal header, editable in place. */
export function PostTimeChip({ time, onSave }: Props) {
  const current = time ? time.slice(0, 5) : "";
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!onSave && !time) return null;

  const cancel = () => {
    setIsEditing(false);
    setValue(current);
    setError(null);
  };

  const save = async () => {
    if (!onSave || !value || value === current) {
      cancel();
      return;
    }
    setIsSaving(true);
    setError(null);
    const saveError = await onSave(value);
    setIsSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 min-w-0">
        <input
          type="time"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              e.stopPropagation();
              cancel();
            }
          }}
          disabled={isSaving}
          autoFocus
          className="text-xs border border-gray-200 rounded-full px-2 py-0.5 text-gray-700 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={save}
          disabled={isSaving || !value}
          className="inline-flex items-center gap-1 text-xs font-medium text-white bg-gray-900 rounded-full px-2 py-0.5 hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={isSaving}
          className="text-xs text-gray-400 hover:text-gray-600 px-1 disabled:opacity-50"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-600 truncate" title={error}>{error}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(current);
        setIsEditing(true);
      }}
      disabled={!onSave}
      className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-full px-2 py-0.5 transition-colors disabled:hover:bg-gray-100"
      title={onSave ? "Change the posting time" : undefined}
    >
      <Clock className="w-3 h-3" />
      {time ? formatTime(time) : "Set time"}
    </button>
  );
}
