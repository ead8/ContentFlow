'use client';

import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { WizardFormData } from './MultiStep';

interface PreviewPostDataProps {
  data: WizardFormData;
}

export default function PreviewPostData({ data }: PreviewPostDataProps) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-6">
      <Accordion type="multiple" className="w-full">

        {/* Step 1 */}
        <AccordionItem value="step1">
          <AccordionTrigger>Campaign Content</AccordionTrigger>
          <AccordionContent>
            <div className="content-preview">
                <h2>{data?.step_1?.name}</h2>
                <p>{data?.step_1?.description}</p>

                <div className="platform-posts">
                    {Object.keys(data?.step_1?.platform_posts ?? []).map((platform) => {
                    const platformPost = data?.step_1?.platform_posts[platform];
                    return (
                        <div key={platform} className="platform-post">
                        <h3>{platform}</h3>
                        {platformPost?.image_suggestion && (
                            <div>
                            <strong>Image Suggestion:</strong> <p>{platformPost.image_suggestion}</p>
                            </div>
                        )}
                        {platformPost?.video_suggestion && (
                            <div>
                            <strong>Video Suggestion:</strong> <p>{platformPost.video_suggestion}</p>
                            </div>
                        )}
                        {platformPost?.post && (
                            <div>
                            <strong>Post:</strong> <p>{platformPost.post}</p>
                            </div>
                        )}
                        {platformPost?.caption && (
                            <div>
                            <strong>Caption:</strong> <p>{platformPost.caption}</p>
                            </div>
                        )}
                        {platformPost?.hashtags && platformPost.hashtags.length > 0 && (
                            <div>
                            <strong>Hashtags:</strong> <p>{platformPost.hashtags.join(', ')}</p>
                            </div>
                        )}
                        {platformPost?.emojis && platformPost.emojis.length > 0 && (
                            <div>
                            <strong>Emojis:</strong> <p>{platformPost.emojis.join(' ')}</p>
                            </div>
                        )}
                        {platformPost?.call_to_action && (
                            <div>
                            <strong>Call to Action:</strong> <p>{platformPost.call_to_action}</p>
                            </div>
                        )}
                        </div>
                    );
                    })}
                </div>

                {data?.step_1?.additional_notes && (
                    <div className="additional-notes">
                    <strong>Additional Notes:</strong>
                    <p>{data?.step_1?.additional_notes}</p>
                    </div>
                )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 2 */}
        <AccordionItem value="step2">
          <AccordionTrigger>Image Upload</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 pl-4">
              <p><strong>Image Source:</strong> {data.step_2?.image_source}</p>
              <p><strong>Image Prompt:</strong> {data.step_2?.image_prompt}</p>
              {data.step_2?.image_upload && (
                <img src={data.step_2.image_upload} alt="Uploaded" className="w-64 rounded border" />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 3 */}
        <AccordionItem value="step3">
          <AccordionTrigger>Video Generation</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 pl-4">
              <p><strong>Video Type:</strong> {data.step_3?.video_type}</p>
              <p><strong>Video Prompt:</strong> {data.step_3?.video_prompt}</p>
              {data.step_3?.video_url && (
                <video src={data.step_3.video_url} controls className="w-64 rounded border" />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
