'use client';

import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { X } from 'lucide-react';
import { WizardFormData } from './MultiStep';
import CampaignContentTab from './CampaignContentTab';

interface PreviewPostDataProps {
  data: WizardFormData;
  onUpdate: (platform: string, field: string, value: string | string[]) => void;
}

export default function PreviewPostData({ data, onUpdate }: PreviewPostDataProps) {
  return (
    <div className="space-y-6">
      <Accordion type="multiple" className="w-full">
        {/* Campaign Content */}
        <AccordionItem value="step1">
          <AccordionTrigger>📝 Campaign Content</AccordionTrigger>
          <AccordionContent className="p-5 bg-white rounded-lg border shadow-sm space-y-6">
            <div>
              <h3 className="text-xl font-bold text-primary">{data?.step_1?.name}</h3>
              <p className="text-gray-600">{data?.step_1?.description}</p>
            </div>
            {/* Platform Tabs */}
            <CampaignContentTab data={data} onUpdate={onUpdate}/>
          </AccordionContent>
        </AccordionItem>

        {/* Image Upload */}
        <AccordionItem value="step2">
          <AccordionTrigger>🖼️ Image Upload</AccordionTrigger>
          <AccordionContent className="p-5 bg-white rounded-lg border shadow-sm space-y-4">
            <p>
              <strong>Image Source:</strong> {data.step_2?.image_source}
            </p>
            <p>
              <strong>Image Prompt:</strong> {data.step_2?.prompt}
            </p>
            {data.step_2?.image_upload && (
              <img
                src={data.step_2.image_upload}
                alt="Uploaded"
                className="rounded-md border w-full max-w-sm mt-2"
              />
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Video Generation */}
        <AccordionItem value="step3">
          <AccordionTrigger>🎬 Video Generation</AccordionTrigger>
          <AccordionContent className="p-5 bg-white rounded-lg border shadow-sm space-y-4">
            <p>
              <strong>Video Prompt:</strong> {data.step_3?.video_prompt}
            </p>
            {data.step_3?.video_url && (
              <video
                controls
                className="w-full max-w-md border rounded-md mt-2"
                src={data.step_3.video_url}
              />
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
