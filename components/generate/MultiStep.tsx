'use client';

import { useState } from 'react';
import CampaignIdea from './campaignIdea';
import { Navigation } from './navigation';
import ImageUpload from './ImageUpload';
import VideoGeneration from './videoGeneration';
import ScheduleConfirm from './scheduleConfirm';
import { ContentGenerationResponse } from '@/models/content';
import PreviewPostData from './Preview';
import { Calendar, CheckCircle, Eye, ImagePlus, Lightbulb, Video } from 'lucide-react';
import type { Platform, Tone } from '@/lib/platforms';

export interface ImageUploadStep {
  image_upload?: string;
  prompt?: string;
  image_source?: 'generated' | 'uploaded';
}

export interface VideoGenerationStep {
  video_url?: string;
}

export interface WizardFormData {
  topic?: string;
  platform?: Platform[];
  tone?: Tone;
  audience?: string;
  step_1?: ContentGenerationResponse;
  step_2?: ImageUploadStep;
  step_3?: VideoGenerationStep;
}

const STEP_HINTS: Record<number, string> = {
  1: 'Generate content to continue',
};

function MultiStepWizard() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<WizardFormData>({});
  // Disables navigation while a step is busy (generating / uploading)
  const [isBusy, setIsBusy] = useState(false);

  // Step 1 needs generated content; the media steps are optional
  const canContinue = step === 1 ? Boolean(formData.step_1) : true;

  const handleSetCampaignIdeaData = (
    topic: string,
    platform: Platform[],
    tone: Tone,
    audience: string,
    data: ContentGenerationResponse
  ) => {
    setFormData((prev) => ({ ...prev, step_1: data, topic, platform, tone, audience }));
  };

  const handleContentChange = (platform: string, field: string, value: string | string[]) => {
    setFormData((prev) => {
      if (!prev.step_1) return prev;
      const posts = prev.step_1.platform_posts ?? {};
      return {
        ...prev,
        step_1: {
          ...prev.step_1,
          platform_posts: {
            ...posts,
            [platform]: { ...posts[platform], [field]: value },
          },
        },
      };
    });
  };

  const handleCampaignChange = (field: 'name' | 'description', value: string) => {
    setFormData((prev) => (prev.step_1 ? { ...prev, step_1: { ...prev.step_1, [field]: value } } : prev));
  };

  const stepsData = [
    {
      step: 1,
      icon: <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />,
      title: 'Campaign Idea',
      component: <CampaignIdea data={formData} setStepData={handleSetCampaignIdeaData} setBusy={setIsBusy} />,
    },
    {
      step: 2,
      icon: <ImagePlus className="w-4 h-4 sm:w-5 sm:h-5" />,
      title: 'Image',
      component: (
        <ImageUpload
          data={formData}
          setStepData={(d) => setFormData((prev) => ({ ...prev, step_2: d }))}
          setBusy={setIsBusy}
        />
      ),
    },
    {
      step: 3,
      icon: <Video className="w-4 h-4 sm:w-5 sm:h-5" />,
      title: 'Video',
      component: (
        <VideoGeneration
          data={formData}
          setStepData={(d) => setFormData((prev) => ({ ...prev, step_3: d }))}
          setBusy={setIsBusy}
        />
      ),
    },
    {
      step: 4,
      icon: <Eye className="w-4 h-4 sm:w-5 sm:h-5" />,
      title: 'Review & Edit',
      component: (
        <PreviewPostData data={formData} onUpdate={handleContentChange} onCampaignUpdate={handleCampaignChange} />
      ),
    },
    {
      step: 5,
      icon: <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />,
      title: 'Save & Schedule',
      component: <ScheduleConfirm data={formData} setBusy={setIsBusy} />,
    },
  ];

  const currentStep = stepsData[step - 1];

  return (
    <div className="mx-auto">
      <div className="mb-4 sm:mb-6">
        <ol className="flex justify-between items-center overflow-x-auto no-scrollbar py-2">
          {stepsData.map((item, index) => (
            <li key={item.step} className="flex items-center" aria-current={step === item.step ? 'step' : undefined}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step > item.step
                      ? 'bg-green-600 text-white'
                      : step === item.step
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {step > item.step ? <CheckCircle className="w-5 h-5" /> : item.icon}
                </div>
                <span className="hidden sm:block text-xs mt-1 font-medium text-center">{item.title}</span>
              </div>
              {index < stepsData.length - 1 && (
                <div
                  className={`h-0.5 w-4 sm:w-8 md:w-12 lg:w-16 mx-1 sm:mx-2 ${
                    step > item.step ? 'bg-green-600' : 'bg-border'
                  }`}
                />
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center">
          {currentStep.icon}
          <h2 className="text-lg sm:text-xl font-semibold ml-2 text-primary">{currentStep.title}</h2>
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground">
          Step {step} of {stepsData.length}
        </div>
      </div>

      <div className="mb-6">{currentStep.component}</div>

      <Navigation
        step={step}
        totalSteps={stepsData.length}
        nextStep={() => setStep((s) => Math.min(s + 1, stepsData.length))}
        prevStep={() => setStep((s) => Math.max(s - 1, 1))}
        isNextDisabled={isBusy || !canContinue}
        isBackDisabled={isBusy}
        nextHint={STEP_HINTS[step]}
        nextLabel={step === 2 && !formData.step_2?.image_upload ? 'Skip' : step === 3 && !formData.step_3?.video_url ? 'Skip' : 'Next'}
      />
    </div>
  );
}

export default MultiStepWizard;
