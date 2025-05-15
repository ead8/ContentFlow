'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Calendar } from '../ui/calendar';
import { Switch } from '../ui/switch'; // Use ShadCN's Switch for better UI
import { ScheduleStep, WizardFormData } from './MultiStep';
import { createPost } from '@/lib/n8n/client';
import { useRouter } from 'next/navigation';

interface Step5ScheduleConfirmProps {
  data?: WizardFormData;
  setStepData: (stepData: ScheduleStep) => void;
  setBackStepValid: (isValid: boolean) => void;
}

const ScheduleConfirm = ({ data, setStepData, setBackStepValid }: Step5ScheduleConfirmProps) => {
  const route = useRouter()
  const { toast } = useToast();
  const [autoSchedule, setAutoSchedule] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [isPublishing, setIsPublishing] = useState(false)

  const handlePublish = async () => {
      try {
        setIsPublishing(true)
        setBackStepValid(false)
  
        const postId = await createPost({
          ...data,
          step_5: {
            schedule_at: autoSchedule ? "" : startDate?.toISOString(),
            auto_schedule: autoSchedule,
            status: 'draft',
          },
        })

        setStepData({
          schedule_at: autoSchedule ? "" : startDate?.toISOString(),
          auto_schedule: autoSchedule,
          status: 'draft',
        })

        setBackStepValid(true)
  
        toast({
          title: 'Success! ✨',
          description: 'Your post published was successfully.',
        })
        
        route.push(`/posts${postId}`)
      } catch (error: any) {
        setStepData({
          schedule_at: autoSchedule ? "" : startDate?.toISOString(),
          auto_schedule: autoSchedule,
          status: 'draft',
        })

        setBackStepValid(true)
        toast({
          variant: 'destructive',
          title: 'Oops, post publish failed 😓',
          description: 'Something wrong! Please try again later.',
        })
      } finally {
        setIsPublishing(false)
        setBackStepValid(true)
      }
  }

  return (
    <Card>
      <CardContent className="flex flex-col space-y-6 pt-6">

        {/* Auto Schedule Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-schedule">Auto Schedule</Label>
          <Switch
            id="auto-schedule"
            checked={autoSchedule}
            onCheckedChange={setAutoSchedule}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Let the system decide the best time to post for you.
        </p>

        {/* Calendar - shown only when autoSchedule is off */}
        {!autoSchedule && (
          <div>
            <Label className="block mb-2">Pick Schedule Date</Label>
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
              className="rounded-md border"
            />
          </div>
        )}
        <Button onClick={handlePublish} disabled={isPublishing} className="self-end">
          {isPublishing ? 'Publishing...' : 'Publish Post'}
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
