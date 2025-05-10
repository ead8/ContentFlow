'use client';

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Calendar } from '../ui/calendar';
import { Switch } from '../ui/switch'; // Use ShadCN's Switch for better UI
import { ScheduleStep, WizardFormData } from './MultiStep';

interface Step5ScheduleConfirmProps {
  data?: WizardFormData;
  setStepData: (stepData: ScheduleStep) => void;
  setNextStepValid: (isValid: boolean) => void;
}

const ScheduleConfirm = ({ data, setStepData, setNextStepValid }: Step5ScheduleConfirmProps) => {
  const [autoSchedule, setAutoSchedule] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">

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

        {/* Info message */}
        <div className="text-sm text-muted-foreground">
          You can always update your schedule later.
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleConfirm;
