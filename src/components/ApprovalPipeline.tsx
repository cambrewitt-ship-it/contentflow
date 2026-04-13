"use client";

import { CheckCircle, XCircle, Clock, AlertTriangle, ChevronRight } from "lucide-react";

export interface ApprovalStep {
  id: string;
  step_order: number;
  label: string | null;
  status: "pending" | "approved" | "rejected" | "changes_requested";
  actioned_by: string | null;
  actioned_at: string | null;
  comments: string | null;
  party: {
    id: string;
    name: string;
    role: string;
    color: string | null;
  } | null;
}

interface ApprovalPipelineProps {
  steps: ApprovalStep[];
  activePartyId?: string | null;
}

const statusConfig = {
  approved: {
    icon: CheckCircle,
    label: "Approved",
    className: "text-green-600",
    bg: "bg-green-50 border-green-200",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    className: "text-red-600",
    bg: "bg-red-50 border-red-200",
  },
  changes_requested: {
    icon: AlertTriangle,
    label: "Changes requested",
    className: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    className: "text-muted-foreground",
    bg: "bg-muted border-border",
  },
};

export function ApprovalPipeline({ steps, activePartyId }: ApprovalPipelineProps) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Approval Pipeline
      </p>
      <ol className="relative">
        {steps.map((step, idx) => {
          const cfg = statusConfig[step.status];
          const Icon = cfg.icon;
          const isActive = step.status === "pending" &&
            (idx === 0 || steps[idx - 1]?.status === "approved");
          const isCurrentParty = step.party?.id === activePartyId;

          return (
            <li key={step.id} className="flex items-start gap-3 pb-4 last:pb-0">
              {/* Step connector line */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 flex-shrink-0 ${
                    step.status === "approved"
                      ? "border-green-500 bg-green-50"
                      : step.status === "rejected"
                      ? "border-red-500 bg-red-50"
                      : step.status === "changes_requested"
                      ? "border-amber-500 bg-amber-50"
                      : isActive
                      ? "border-primary bg-primary/10 animate-pulse"
                      : "border-border bg-muted"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${cfg.className}`} />
                </div>
                {idx < steps.length - 1 && (
                  <div className="w-0.5 flex-1 bg-border mt-1 min-h-[12px]" />
                )}
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {step.party && (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: step.party.color ?? "#6366f1" }}
                    >
                      {step.party.name}
                      {isCurrentParty && isActive && (
                        <span className="ml-1 text-white/80">(you)</span>
                      )}
                    </span>
                  )}
                  {step.label && (
                    <span className="text-xs text-muted-foreground">{step.label}</span>
                  )}
                  <span className={`text-xs font-medium ml-auto ${cfg.className}`}>
                    {cfg.label}
                  </span>
                </div>
                {step.actioned_by && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    by {step.actioned_by}
                    {step.actioned_at && (
                      <> · {new Date(step.actioned_at).toLocaleDateString()}</>
                    )}
                  </p>
                )}
                {step.comments && (
                  <p className="text-xs text-foreground mt-1 bg-muted rounded px-2 py-1">
                    "{step.comments}"
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
