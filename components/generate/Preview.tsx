'use client';

import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { WizardFormData } from './MultiStep';
import { Badge } from '@/components/ui/badge';

interface PreviewPostDataProps {
  data: WizardFormData;
}

export default function PreviewPostData({ data }: PreviewPostDataProps) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-6">
      {/* <h2 className="text-2xl font-semibold text-gray-800">📋 Campaign Preview</h2> */}

      <Accordion type="multiple" className="w-full">

        {/* Step 1: Campaign Content */}
        <AccordionItem value="step1">
          <AccordionTrigger>📝 Campaign Content</AccordionTrigger>
          <AccordionContent className="bg-white rounded-lg p-4 shadow-sm">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{data?.step_1?.name}</h3>
                <p className="text-gray-600">{data?.step_1?.description}</p>
              </div>

              <div className="grid gap-4">
                {Object.entries(data?.step_1?.platform_posts ?? {}).map(
                  ([platform, post]) => (
                    <div
                      key={platform}
                      className="p-4 border rounded-md bg-gray-50 space-y-2"
                    >
                      <h4 className="text-md font-semibold text-pink-600 capitalize">
                        {platform}
                      </h4>

                      {post.image_suggestion && (
                        <div>
                          <strong className="block text-gray-700">Image Suggestion:</strong>
                          <p>{post.image_suggestion}</p>
                        </div>
                      )}

                      {post.video_suggestion && (
                        <div>
                          <strong className="block text-gray-700">Video Suggestion:</strong>
                          <p>{post.video_suggestion}</p>
                        </div>
                      )}

                      {post.post && (
                        <div>
                          <strong className="block text-gray-700">Post:</strong>
                          <p>{post.post}</p>
                        </div>
                      )}

                      {post.caption && (
                        <div>
                          <strong className="block text-gray-700">Caption:</strong>
                          <p>{post.caption}</p>
                        </div>
                      )}

                      {post?.hashtags && post?.hashtags?.length > 0 && (
                        <div>
                          <strong className="block text-gray-700">Hashtags:</strong>
                          <div className="flex flex-wrap gap-1">
                            {post?.hashtags?.map((tag, i) => (
                              <Badge key={i} variant="outline">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {post?.emojis && post.emojis?.length > 0 && (
                        <div>
                          <strong className="block text-gray-700">Emojis:</strong>
                          <p className="text-xl">{post.emojis.join(' ')}</p>
                        </div>
                      )}

                      {post.call_to_action && (
                        <div>
                          <strong className="block text-gray-700">Call to Action:</strong>
                          <p>{post.call_to_action}</p>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              {data?.step_1?.additional_notes && (
                <div>
                  <strong className="block text-gray-700">Additional Notes:</strong>
                  <p className="text-gray-600">{data?.step_1?.additional_notes}</p>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 2: Image Upload */}
        <AccordionItem value="step2">
          <AccordionTrigger>🖼️ Image Upload</AccordionTrigger>
          <AccordionContent className="bg-white rounded-lg p-4 shadow-sm">
            <div className="space-y-3">
              <p><strong>Image Source:</strong> {data.step_2?.image_source}</p>
              <p><strong>Image Prompt:</strong> {data.step_2?.prompt}</p>
              {data.step_2?.image_upload && (
                <img
                  src={data.step_2.image_upload}
                  alt="Uploaded"
                  className="w-full max-w-md rounded-md border shadow-sm"
                />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 3: Video Generation */}
        <AccordionItem value="step3">
          <AccordionTrigger>🎬 Video Generation</AccordionTrigger>
          <AccordionContent className="bg-white rounded-lg p-4 shadow-sm">
            <div className="space-y-3">
              <p><strong>Video Prompt:</strong> {data.step_3?.video_prompt}</p>
              {data.step_3?.video_url && (
                <video
                  src={data.step_3.video_url}
                  controls
                  className="w-full max-w-md rounded-md border shadow-sm"
                />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
}
