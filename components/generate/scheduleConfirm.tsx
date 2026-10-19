'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Hand, Loader2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Calendar } from '../ui/calendar';
import { WizardFormData } from './MultiStep';
import { createPost } from '@/lib/api/client';
import { platformLabel } from '@/lib/platforms';
import { type AccountRow, connectUrl, fetchSocialAccounts, publishingAccountFor } from '@/components/settings/social-accounts-api';

interface ScheduleConfirmProps {
  data: WizardFormData;
  setBusy: (busy: boolean) => void;
}

function combine(date: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/**
 * Save the campaign as a draft, or schedule it for a date and time
 * (in the user's local time zone).
 */
const ScheduleConfirm = ({ data, setBusy }: ScheduleConfirmProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState('09:00');
  const [saving, setSaving] = useState<'draft' | 'schedule' | null>(null);
  /** null = loading, undefined = could not load */
  const [accounts, setAccounts] = useState<AccountRow[] | null | undefined>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchSocialAccounts()
        .then((d) => !cancelled && setAccounts(d.accounts))
        .catch(() => !cancelled && setAccounts((prev) => prev ?? undefined));
    load();
    // Refresh after the user connects an account in another tab
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
    };
  }, []);

  const platforms = data.platform ?? [];
  const autoPlatforms = accounts ? platforms.filter((p) => publishingAccountFor(accounts, p)) : [];
  const manualPlatforms = accounts ? platforms.filter((p) => !publishingAccountFor(accounts, p)) : [];

  const scheduledAt = date ? combine(date, time) : null;
  const inPast = scheduledAt ? scheduledAt.getTime() <= Date.now() : false;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const save = async (mode: 'draft' | 'schedule') => {
    if (!data.step_1) return;
    if (mode === 'schedule' && (!scheduledAt || inPast)) return;

    setSaving(mode);
    setBusy(true);
    try {
      const media = [data.step_2?.image_upload, data.step_3?.video_url].filter(Boolean) as string[];
      const post = await createPost({
        title: data.step_1.name,
        description: data.step_1.description,
        platforms: data.platform,
        platform_variants: data.step_1.platform_posts,
        media_urls: media,
        tone: data.tone,
        generated_by_ai: true,
        scheduled_for: mode === 'schedule' ? scheduledAt!.toISOString() : null,
      });

      toast({
        title: mode === 'schedule' ? 'Post scheduled' : 'Draft saved',
        description:
          mode === 'schedule'
            ? autoPlatforms.length > 0
              ? `It will publish automatically to ${autoPlatforms.map(platformLabel).join(', ')} on ${format(scheduledAt!, "MMM d 'at' h:mm a")}.`
              : `Scheduled for ${format(scheduledAt!, "MMM d 'at' h:mm a")}. You'll get a reminder to post it.`
            : 'You can finish and publish it from My Posts.',
      });
      router.push(`/posts/${post.id}`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not save the post',
        description: error.message || 'Please try again.',
      });
      setSaving(null);
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6">
        <div className="grid gap-6 md:grid-cols-[auto,1fr]">
          <div>
            <Label className="mb-2 block">Publish date</Label>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
              className="rounded-md border"
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-time">Time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-40"
              />
              <p className="text-xs text-muted-foreground">Your time zone: {timeZone}</p>
            </div>
            {scheduledAt && (
              <p className={`text-sm ${inPast ? 'text-destructive' : 'text-muted-foreground'}`}>
                {inPast
                  ? 'That time has already passed. Pick a later time.'
                  : `Scheduled for ${format(scheduledAt, "EEEE, MMMM d 'at' h:mm a")}`}
              </p>
            )}
            {accounts && platforms.length > 0 && (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                {autoPlatforms.length > 0 && (
                  <p className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span>
                      Publishes automatically to <strong>{autoPlatforms.map(platformLabel).join(', ')}</strong>.
                    </span>
                  </p>
                )}
                {manualPlatforms.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Hand className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                    <div className="space-y-1">
                      <p>
                        No connected account for <strong>{manualPlatforms.map(platformLabel).join(', ')}</strong>. You&apos;ll
                        get a reminder to post these by hand, or connect them:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {manualPlatforms.map((p) => (
                          <Link
                            key={p}
                            href={connectUrl(p, '/settings')}
                            target="_blank"
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            Connect {platformLabel(p)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => save('draft')} disabled={saving !== null}>
            {saving === 'draft' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save as draft
          </Button>
          <Button onClick={() => save('schedule')} disabled={saving !== null || !scheduledAt || inPast}>
            {saving === 'schedule' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Schedule post
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleConfirm;
