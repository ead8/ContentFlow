'use client';

import { forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { CreditSummary, fetchCreditUsage } from '@/lib/n8n/client';

export type NotifyCreditWarningRef = {
  /**
   * Call this right after a billed generation finishes. Pass the fresh
   * balance if you already have it to avoid another request.
   */
  checkCredits: (summary?: CreditSummary | null) => Promise<void>;
};

interface NotifyCreditWarningProps {
  /**
   * @deprecated All AI features share one credit wallet; kept so existing
   * callers keep compiling. Has no effect.
   */
  type?: string;
}

/** Share of the monthly allowance used at which a warning is shown */
const THRESHOLDS = [90, 75] as const;

function storageKey(threshold: number, summary: CreditSummary) {
  // Scoped to the billing period so a refill re-arms the warnings
  return `cf:credit-warning:${threshold}:${summary.credits_refreshed_at ?? ''}`;
}

function alreadyShown(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markShown(key: string) {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // storage unavailable (private mode etc.); the warning may repeat
  }
}

/**
 * Warns once per session when 75% and again when 90% of the monthly credit
 * allowance has been used (based on credits remaining in the wallet).
 */
const NotifyCreditWarning = forwardRef<NotifyCreditWarningRef, NotifyCreditWarningProps>(
  (_props, ref) => {
    const { toast } = useToast();
    const router = useRouter();

    useImperativeHandle(ref, () => ({
      async checkCredits(provided) {
        let summary = provided ?? null;
        if (!summary) {
          try {
            summary = await fetchCreditUsage();
          } catch {
            return;
          }
        }

        const allowance = summary.monthly_allowance;
        if (!allowance || allowance <= 0) return;

        const usedPercent = Math.max(0, ((allowance - summary.credits) / allowance) * 100);
        const reached = THRESHOLDS.find((t) => usedPercent >= t);
        if (!reached) return;

        const key = storageKey(reached, summary);
        if (alreadyShown(key)) return;

        // Crossing 90% also covers the 75% warning
        for (const t of THRESHOLDS) {
          if (t <= reached) markShown(storageKey(t, summary));
        }

        const remaining = Math.max(0, summary.credits);
        toast({
          title: reached >= 90 ? 'Credits almost used up' : 'Credits running low',
          description: `You've used ${Math.min(100, Math.round(usedPercent))}% of this month's credits. ${remaining.toLocaleString()} credit${remaining === 1 ? '' : 's'} left.`,
          duration: 8000,
          variant: reached >= 90 ? 'destructive' : 'default',
          action: (
            <ToastAction altText="Upgrade your plan" onClick={() => router.push('/settings#billing')}>
              Upgrade
            </ToastAction>
          ),
        });
      },
    }));

    return null;
  }
);

NotifyCreditWarning.displayName = 'NotifyCreditWarning';
export default NotifyCreditWarning;
