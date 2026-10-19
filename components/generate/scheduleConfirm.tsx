'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { CheckCircle2, ExternalLink, Hand, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Calendar } from '../ui/calendar';
import { ScheduleStep, WizardFormData } from './MultiStep';
import { createPost } from '@/lib/n8n/client';
import { useRouter } from 'next/navigation';
import { platformLabel } from '@/lib/platforms';
import {
  type AccountRow,
  fetchSocialAccounts,
  platformIcon,
  publishingAccountFor,
} from '@/components/settings/social-accounts-api';

interface Step5ScheduleConfirmProps {
  data?: WizardFormData;
  setStepData: (stepData: ScheduleStep) => void;
  setBackStepValid: (isValid: boolean) => void;
}

/** Combine a picked day with an "HH:mm" time in the user's local timezone. */
function combine(day: Date | undefined, time: string): Date | undefined {
  if (!day) return undefined;
  const [h, m] = time.split(':').map((n) => Number(n));
  const d = new Date(day);
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

const ScheduleConfirm = ({ data, setStepData, setBackStepValid }: Step5ScheduleConfirmProps) => {
  const route = useRouter()
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [time, setTime] = useState('09:00');
  const [isPublishing, setIsPublishing] = useState(false)
  /** null = loading, undefined = could not load */
  const [accounts, setAccounts] = useState<AccountRow[] | null | undefined>(null);

  const platforms = useMemo(() => data?.platform ?? [], [data?.platform]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchSocialAccounts()
        .then((d) => {
          if (!cancelled) setAccounts(d.accounts);
        })
        .catch(() => {
          if (!cancelled) setAccounts((prev) => (prev ? prev : undefined));
        });
    load();
    // Refresh after the user connects an account in the other tab
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
    };
  }, []);

  const autoPlatforms = accounts ? platforms.filter((p) => publishingAccountFor(accounts, p)) : [];
  const manualPlatforms = accounts ? platforms.filter((p) => !publishingAccountFor(accounts, p)) : [];
  const scheduledAt = combine(startDate, time);

  const handlePublish = async () => {
      if (scheduledAt && scheduledAt.getTime() < Date.now()) {
        toast({
          variant: 'destructive',
          title: 'Pick a time in the future',
          description: 'The scheduled time has already passed.',
        });
        return;
      }
      const status: ScheduleStep['status'] = scheduledAt ? 'scheduled' : 'draft';
      try {
        setIsPublishing(true)
        setBackStepValid(false)
        const postId = await createPost({
          ...data,
          step_5: {
            schedule_at: scheduledAt?.toISOString(),
            status,
          },
        })

        setStepData({
          schedule_at: scheduledAt?.toISOString(),
          status,
        })

        setBackStepValid(true)

        toast({
          title: scheduledAt ? 'Post scheduled ✨' : 'Post saved ✨',
          description: scheduledAt
            ? autoPlatforms.length > 0
              ? `It will publish automatically to ${autoPlatforms.map(platformLabel).join(', ')} on ${format(scheduledAt, "MMM d 'at' h:mm a")}.`
              : `Scheduled for ${format(scheduledAt, "MMM d 'at' h:mm a")}.`
            : 'Saved as a draft. You can publish it from the post page.',
        })

        route.push(`/posts/${postId}`)
      } catch (error: any) {
        setStepData({
          schedule_at: scheduledAt?.toISOString(),
          status: 'draft',
        })

        setBackStepValid(true)
        toast({
          variant: 'destructive',
          title: 'Oops, post publish failed 😓',
          description: error?.message || 'Something wrong! Please try again later.',
        })
      } finally {
        setIsPublishing(false)
        setBackStepValid(true)
      }
  }

  return (
    <Card>
      <CardContent className="flex flex-col space-y-6 pt-6">
        <div className="flex flex-col gap-6 md:flex-row">
          <div>
            <Label className="block mb-2">Pick Schedule Date</Label>
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
              disabled={{ before: startOfDay(new Date()) }}
              className="rounded-md border w-fit"
            />
            <div className="mt-3 space-y-1">
              <Label htmlFor="schedule-time">Time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-36"
                disabled={!startDate}
              />
              <p className="text-xs text-muted-foreground">
                {scheduledAt
                  ? `Publishes ${format(scheduledAt, "EEEE, MMM d 'at' h:mm a")} (your local time).`
                  : 'No date picked: the post is saved as a draft.'}
              </p>
            </div>
          </div>

          {platforms.length > 0 && (
            <div className="flex-1 min-w-0">
              <Label className="block mb-2">Publishing</Label>
              {accounts === null ? (
                <div className="space-y-2" aria-hidden="true">
                  {platforms.map((p) => (
                    <Skeleton key={p} className="h-12 w-full" />
                  ))}
                </div>
              ) : accounts === undefined ? (
                <p className="text-sm text-muted-foreground">
                  Couldn&apos;t check your connected accounts. You can still schedule this post.
                </p>
              ) : (
                <ul className="space-y-2">
                  {platforms.map((p) => {
                    const Icon = platformIcon(p);
                    const account = publishingAccountFor(accounts, p);
                    return (
                      <li key={p} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{platformLabel(p)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {account
                                ? `Auto-publish via ${account.account_name || 'connected account'}`
                                : "You'll get a reminder to post manually"}
                            </p>
                          </div>
                        </div>
                        {account ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Auto
                          </span>
                        ) : (
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="hidden sm:flex items-center gap-1 text-xs font-medium text-orange-700 dark:text-orange-400">
                              <Hand className="h-4 w-4" aria-hidden="true" /> Manual
                            </span>
                            <Button asChild size="sm" variant="outline">
                              <a href="/settings#accounts" target="_blank" rel="noopener noreferrer">
                                Connect
                                <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />
                                <span className="sr-only"> {platformLabel(p)} (opens in a new tab)</span>
                              </a>
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {accounts && manualPlatforms.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Connecting opens Settings in a new tab so you don&apos;t lose this post.
                </p>
              )}
            </div>
          )}
        </div>
        <Button onClick={handlePublish} disabled={isPublishing} className="self-end">
          {isPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPublishing ? 'Saving...' : scheduledAt ? 'Schedule Post' : 'Save Post'}
        </Button>
        {/* Info message */}
        <div className="text-sm text-muted-foreground">
          You can always update your schedule later.
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleConfirm;
