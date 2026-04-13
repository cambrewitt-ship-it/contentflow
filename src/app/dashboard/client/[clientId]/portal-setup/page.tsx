"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Users,
  Workflow,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import logger from "@/lib/logger";

type PartyRole = "media_agency" | "pr_agency" | "creative_agency" | "client" | "other";

interface Party {
  id: string;
  name: string;
  role: PartyRole;
  portal_token: string;
  color: string | null;
  notification_channel: string | null;
  notification_config: Record<string, unknown>;
  created_at: string;
}

interface WorkflowStep {
  step_order: number;
  party_id: string | null;
  label: string;
  agency_step: boolean;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  post_type_tag: string | null;
  steps: WorkflowStep[];
  created_at: string;
}

const ROLE_LABELS: Record<PartyRole, string> = {
  media_agency: "Media Agency",
  pr_agency: "PR Agency",
  creative_agency: "Creative Agency",
  client: "Client",
  other: "Other",
};

const PARTY_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

function CopyTokenButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/portal/${token}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export default function PortalSetupPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);
  const { getAccessToken } = useAuth();

  const [parties, setParties] = useState<Party[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  // New party form
  const [showNewParty, setShowNewParty] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyRole, setNewPartyRole] = useState<PartyRole>("client");
  const [newPartyColor, setNewPartyColor] = useState(PARTY_COLORS[0]);
  const [newPartyEmail, setNewPartyEmail] = useState("");
  const [isSavingParty, setIsSavingParty] = useState(false);
  const [partyError, setPartyError] = useState<string | null>(null);

  // New template form
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateTag, setNewTemplateTag] = useState<"pr_event" | "social" | "">("");
  const [newTemplateSteps, setNewTemplateSteps] = useState<WorkflowStep[]>([
    { step_order: 1, party_id: null, label: "", agency_step: false },
  ]);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const getHeaders = useCallback(async () => {
    const token = await getAccessToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [getAccessToken]);

  const fetchParties = useCallback(async () => {
    setIsLoadingParties(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/portal-parties?client_id=${clientId}`, { headers });
      const data = await res.json();
      if (res.ok) setParties(data.parties ?? []);
    } catch (err) {
      logger.error("Fetch parties error:", err);
    } finally {
      setIsLoadingParties(false);
    }
  }, [clientId, getHeaders]);

  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/workflow-templates?client_id=${clientId}`, { headers });
      const data = await res.json();
      if (res.ok) setTemplates(data.templates ?? []);
    } catch (err) {
      logger.error("Fetch templates error:", err);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [clientId, getHeaders]);

  useEffect(() => {
    fetchParties();
    fetchTemplates();
  }, [fetchParties, fetchTemplates]);

  const handleCreateParty = async () => {
    if (!newPartyName.trim()) return;
    setIsSavingParty(true);
    setPartyError(null);
    try {
      const headers = await getHeaders();
      const body: Record<string, unknown> = {
        client_id: clientId,
        name: newPartyName.trim(),
        role: newPartyRole,
        color: newPartyColor,
      };
      if (newPartyEmail.trim()) {
        body.notification_channel = "email";
        body.notification_config = { email: newPartyEmail.trim() };
      }
      const res = await fetch("/api/portal-parties", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setPartyError(data.error ?? "Failed to create party");
        return;
      }
      setParties(prev => [...prev, data.party]);
      setNewPartyName("");
      setNewPartyEmail("");
      setShowNewParty(false);
    } catch (err) {
      setPartyError("Failed to create party");
    } finally {
      setIsSavingParty(false);
    }
  };

  const handleDeleteParty = async (id: string) => {
    if (!confirm("Delete this party? Their portal link will stop working.")) return;
    try {
      const headers = await getHeaders();
      await fetch(`/api/portal-parties?id=${id}&client_id=${clientId}`, {
        method: "DELETE",
        headers,
      });
      setParties(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      logger.error("Delete party error:", err);
    }
  };

  const addTemplateStep = () => {
    setNewTemplateSteps(prev => [
      ...prev,
      {
        step_order: prev.length + 1,
        party_id: null,
        label: "",
        agency_step: false,
      },
    ]);
  };

  const removeTemplateStep = (idx: number) => {
    setNewTemplateSteps(prev =>
      prev
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, step_order: i + 1 }))
    );
  };

  const updateStep = (idx: number, updates: Partial<WorkflowStep>) => {
    setNewTemplateSteps(prev =>
      prev.map((s, i) => (i === idx ? { ...s, ...updates } : s))
    );
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || newTemplateSteps.length === 0) return;
    setIsSavingTemplate(true);
    setTemplateError(null);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/workflow-templates", {
        method: "POST",
        headers,
        body: JSON.stringify({
          client_id: clientId,
          name: newTemplateName.trim(),
          post_type_tag: newTemplateTag || null,
          steps: newTemplateSteps,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTemplateError(data.error ?? "Failed to create template");
        return;
      }
      setTemplates(prev => [...prev, data.template]);
      setNewTemplateName("");
      setNewTemplateTag("");
      setNewTemplateSteps([{ step_order: 1, party_id: null, label: "", agency_step: false }]);
      setShowNewTemplate(false);
    } catch (err) {
      setTemplateError("Failed to create template");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this workflow template?")) return;
    try {
      const headers = await getHeaders();
      await fetch(`/api/workflow-templates?id=${id}&client_id=${clientId}`, {
        method: "DELETE",
        headers,
      });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      logger.error("Delete template error:", err);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Portal Setup</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage portal parties and approval workflow templates for this client.
        </p>
      </div>

      {/* Portal Parties */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Portal Parties</h2>
          </div>
          <Button size="sm" onClick={() => setShowNewParty(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Party
          </Button>
        </div>

        {isLoadingParties ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading parties...
          </div>
        ) : parties.length === 0 && !showNewParty ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
            No parties yet. Add parties to enable multi-step approval workflows.
          </p>
        ) : (
          <div className="space-y-2">
            {parties.map(party => (
              <Card key={party.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: party.color ?? "#6366f1" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{party.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {ROLE_LABELS[party.role]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <CopyTokenButton token={party.portal_token} />
                        <a
                          href={`/portal/${party.portal_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open portal
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteParty(party.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* New party form */}
        {showNewParty && (
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-4">
              <h3 className="font-medium text-sm">New Party</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. 128 Comms"
                    value={newPartyName}
                    onChange={e => setNewPartyName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Role *</label>
                  <select
                    value={newPartyRole}
                    onChange={e => setNewPartyRole(e.target.value as PartyRole)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {PARTY_COLORS.map(color => (
                    <button
                      key={color}
                      className={`h-6 w-6 rounded-full transition-all ${
                        newPartyColor === color ? "ring-2 ring-offset-2 ring-foreground" : ""
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewPartyColor(color)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Notification email (optional)
                </label>
                <input
                  type="email"
                  placeholder="party@example.com"
                  value={newPartyEmail}
                  onChange={e => setNewPartyEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {partyError && <p className="text-xs text-destructive">{partyError}</p>}

              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateParty} disabled={isSavingParty || !newPartyName.trim()}>
                  {isSavingParty && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Create Party
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowNewParty(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Workflow Templates */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Workflow Templates</h2>
          </div>
          <Button size="sm" onClick={() => setShowNewTemplate(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>

        {isLoadingTemplates ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading templates...
          </div>
        ) : templates.length === 0 && !showNewTemplate ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
            No workflow templates yet. Create one to define multi-step approval flows.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map(template => (
              <Card key={template.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">{template.name}</span>
                        {template.post_type_tag && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              template.post_type_tag === "pr_event"
                                ? "border-purple-300 text-purple-700"
                                : "border-sky-300 text-sky-700"
                            }`}
                          >
                            {template.post_type_tag === "pr_event" ? "PR Event" : "Social"}
                          </Badge>
                        )}
                      </div>
                      <ol className="space-y-1">
                        {(template.steps as WorkflowStep[]).map(step => {
                          const party = parties.find(p => p.id === step.party_id);
                          return (
                            <li key={step.step_order} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                                {step.step_order}
                              </span>
                              {party ? (
                                <span
                                  className="px-1.5 py-0.5 rounded-full text-white text-[10px]"
                                  style={{ backgroundColor: party.color ?? "#6366f1" }}
                                >
                                  {party.name}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-full bg-slate-700 text-white text-[10px]">
                                  Agency
                                </span>
                              )}
                              {step.label && <span>{step.label}</span>}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* New template form */}
        {showNewTemplate && (
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-4">
              <h3 className="font-medium text-sm">New Workflow Template</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Template name *</label>
                  <input
                    type="text"
                    placeholder="e.g. PR / Media Event"
                    value={newTemplateName}
                    onChange={e => setNewTemplateName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Post type</label>
                  <select
                    value={newTemplateTag}
                    onChange={e => setNewTemplateTag(e.target.value as typeof newTemplateTag)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Any</option>
                    <option value="pr_event">PR Event</option>
                    <option value="social">Social</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Steps</label>
                <div className="space-y-2">
                  {newTemplateSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4 flex-shrink-0">{step.step_order}</span>
                      <select
                        value={step.party_id ?? ""}
                        onChange={e => updateStep(idx, { party_id: e.target.value || null, agency_step: !e.target.value })}
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-xs flex-1"
                      >
                        <option value="">Agency (dashboard)</option>
                        {parties.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Step label"
                        value={step.label}
                        onChange={e => updateStep(idx, { label: e.target.value })}
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-xs flex-1"
                      />
                      {newTemplateSteps.length > 1 && (
                        <button
                          onClick={() => removeTemplateStep(idx)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addTemplateStep}
                  className="mt-2 gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Step
                </Button>
              </div>

              {templateError && <p className="text-xs text-destructive">{templateError}</p>}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateTemplate}
                  disabled={isSavingTemplate || !newTemplateName.trim()}
                >
                  {isSavingTemplate && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Create Template
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowNewTemplate(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
