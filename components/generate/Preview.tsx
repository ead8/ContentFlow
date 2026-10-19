'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WizardFormData } from './MultiStep';
import CampaignContentTab from './CampaignContentTab';

interface PreviewPostDataProps {
  data: WizardFormData;
  onUpdate: (platform: string, field: string, value: string | string[]) => void;
  onCampaignUpdate: (field: 'name' | 'description', value: string) => void;
}

/**
 * Final review: edit the campaign title and each platform's copy, and see
 * the attached media.
 */
export default function PreviewPostData({ data, onUpdate, onCampaignUpdate }: PreviewPostDataProps) {
  const image = data.step_2?.image_upload;
  const video = data.step_3?.video_url;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Title</Label>
            <Input
              id="campaign-name"
              value={data.step_1?.name || ''}
              onChange={(e) => onCampaignUpdate('name', e.target.value)}
              maxLength={300}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-description">Summary</Label>
            <Textarea
              id="campaign-description"
              value={data.step_1?.description || ''}
              onChange={(e) => onCampaignUpdate('description', e.target.value)}
              maxLength={2000}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform copy</CardTitle>
        </CardHeader>
        <CardContent>
          <CampaignContentTab posts={data.step_1?.platform_posts || {}} onUpdate={onUpdate} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Media</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!image && !video && <p className="text-sm text-muted-foreground">No media attached.</p>}
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Post image" className="w-full max-w-sm rounded-md border" />
          )}
          {video && <video controls src={video} className="w-full max-w-md rounded-md border" />}
        </CardContent>
      </Card>
    </div>
  );
}
