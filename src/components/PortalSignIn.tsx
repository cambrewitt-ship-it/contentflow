"use client";

import { useState } from "react";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PortalMember } from "@/contexts/PortalContext";

interface Props {
  token: string;
  clientName: string;
  clientLogoUrl?: string | null;
  onSignedIn: (member: PortalMember) => void;
}

/**
 * "Who are you?" — each person signs in once per device with their name and
 * email (verified with a 6-digit code), like a Trello profile. Their comments
 * are then shown under their name and they can be @mentioned.
 */
export function PortalSignIn({ token, clientName, clientLogoUrl, onSignedIn }: Props) {
  const [step, setStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/members/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (data.verification_required === false && data.member) {
        onSignedIn(data.member);
        return;
      }
      setCode("");
      setStep("code");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/members/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), email: email.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      onSignedIn(data.member);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const detailsValid = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 md:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          {clientLogoUrl ? (
            <img
              src={clientLogoUrl}
              alt={`${clientName} logo`}
              className="h-14 w-14 rounded-xl object-contain bg-white border border-border mb-3"
            />
          ) : (
            <div className="h-14 w-14 bg-primary rounded-xl flex items-center justify-center mb-3">
              <span className="text-primary-foreground font-semibold text-2xl">
                {clientName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <h1 className="text-lg font-semibold">
            {step === "details" ? "Who's reviewing?" : "Check your email"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "details"
              ? `Sign in to the ${clientName} content portal so your comments show your name and teammates can tag you.`
              : `We sent a 6-digit code to ${email.trim()}.`}
          </p>
        </div>

        {step === "details" ? (
          <form
            className="space-y-3"
            onSubmit={e => {
              e.preventDefault();
              if (detailsValid && !isSubmitting) requestCode();
            }}
          >
            <div className="space-y-1">
              <label htmlFor="portal-name" className="text-xs font-medium text-muted-foreground">Your name</label>
              <Input
                id="portal-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sam Taylor"
                autoComplete="name"
                autoFocus
                maxLength={100}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="portal-email" className="text-xs font-medium text-muted-foreground">Work email</label>
              <Input
                id="portal-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="sam@company.com"
                autoComplete="email"
                maxLength={254}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full gap-2" disabled={!detailsValid || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Continue
            </Button>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={e => {
              e.preventDefault();
              if (code.trim().length === 6 && !isSubmitting) verifyCode();
            }}
          >
            <Input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className="text-center text-2xl tracking-[0.5em] h-12"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={code.length !== 6 || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep("details");
                  setError(null);
                }}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Change details
              </button>
              <button
                type="button"
                onClick={requestCode}
                disabled={isSubmitting}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
