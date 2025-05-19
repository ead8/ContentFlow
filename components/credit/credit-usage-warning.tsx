'use client';

import { forwardRef, useImperativeHandle } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchCreditUsage } from '@/lib/api/supabase';

export type NotifyCreditWarningRef = {
  /** Call this right after an image/video generation finishes */
  checkCredits: () => Promise<void>;
};

type CreditType = 'image' | 'video';

interface NotifyCreditWarningProps {
  /** Which credit bucket to track */
  type: CreditType;
}

const NotifyCreditWarning = forwardRef<NotifyCreditWarningRef, NotifyCreditWarningProps>(
  ({ type }, ref) => {
    const { toast } = useToast();

    useImperativeHandle(ref, () => ({
      async checkCredits() {
        const data = await fetchCreditUsage();
        if (!data) return;

        const used  = type === 'image' ? data.image_credits_used  : data.video_credits_used;
        const total = type === 'image' ? data.total_image_credits : data.total_video_credits;

        if (total === 0) return;            // avoid /0 or trial without credits

        
        const usedPercent   = (used / total) * 100;
        const remaining = total - used;

        toast({
          title: `${type === 'image' ? 'Image' : 'Video'} Credits`,
          description: `You have ${remaining} ${type} credit${remaining === 1 ? '' : 's'} left.`,
          duration: 5000,
        });

        // Warning thresholds
        if (usedPercent === 75) {
          toast({
            title: 'Warning',
            description: `You've used 75% of your ${type} credits.`,
            duration: 5000,
            variant: 'destructive',
          });
        }

        if (usedPercent === 90) {
          toast({
            title: 'Critical Warning',
            description: `You've used 90% of your ${type} credits.`,
            duration: 5000,
            variant: 'destructive',
          });
        }
      },
    }));

    return null;
  }
);

NotifyCreditWarning.displayName = 'NotifyCreditWarning';
export default NotifyCreditWarning;