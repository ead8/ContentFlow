'use client';

import { useEffect, useState } from 'react';
import CampaignIdea from './campaignIdea';
import { Navigation } from './navigation';
import { useAuth } from '../auth-provider';
import ImageUpload from './ImageUpload';
import VideoGeneration from './videoGeneration';
import ScheduleConfirm from './scheduleConfirm';
import { ContentGenerationResponse } from '@/models/content';
import PreviewPostData from './Preview';
import { Calendar, CheckCircle, Eye, ImagePlus, Lightbulb, Video } from 'lucide-react';


export interface ImageUploadStep {
  image_upload?: string;
  prompt?: string;
  image_source?: 'generated' | 'uploaded';
  file?: File;
}

export interface VideoGenerationStep {
  video_prompt?: string;
  video_url?: string;
  job_id?: string,
  media_id?: string,
  isEmailNotify?: boolean
}

export interface Step4Data {
  
}

export interface ScheduleStep {
  schedule_at?: string;
  status?: 'scheduled' | 'draft';
}

export interface WizardFormData {
  user_id?: string;
  topic?: string;
  platform?: Array<"LinkedIn" | "Instagram" | "X-Twitter" | "YouTube_Shorts" | "Facebook" | "Tiktok">;
  tone?: "Professional" | "Casual" | "Enthusiastic" | "Informative";
  audience?: string;
  step_1?: ContentGenerationResponse;
  step_2?: ImageUploadStep;
  step_3?: VideoGenerationStep;
  step_5?: ScheduleStep;
}

function MultiStepWizard() {
  const { user } = useAuth()
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<WizardFormData>({
    user_id: undefined,
  });

  // Next Step validation map
  const [isNextStepValidMap, setIsNextStepValidMap] = useState<Record<number, boolean>>(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const stepIndex = i + 1;
        // Make steps 2, 3, and 4 valid by default
        return { [stepIndex]: stepIndex >= 1 && stepIndex <= 4 };  // Step 2, 3, 4 (Preview) is always valid
      }).reduce((acc, curr) => ({ ...acc, ...curr }), {})
  );

  const [isBackStepValidMap, setIsBackStepValidMap] = useState<Record<number, boolean>>(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const stepIndex = i + 1;
        return { [stepIndex]: true }; // Back is always valid for first time
      }).reduce((acc, curr) => ({ ...acc, ...curr }), {})
  );

  const nextStep = () => {
    setStep(prevStep => Math.min(prevStep + 1, 5)); // Ensure step does not exceed 5
  };

  const prevStep = () => {
    setStep(prevStep => Math.max(prevStep - 1, 1)); // Ensure step does not go below 1
  };

  const setStepValid = (stepIndex: number, isValid: boolean) => {
    setIsNextStepValidMap((prev) => ({ ...prev, [stepIndex]: isValid }));
  };

  const setBackValid = (stepIndex: number, isValid: boolean) => {
    setIsBackStepValidMap((prev) => ({ ...prev, [stepIndex]: isValid }));
  };
  
  useEffect(() => {
    if (user?.id && !formData.user_id) {
      setFormData((prev) => ({ ...prev, user_id: user.id }));
    }
  }, [user, formData.user_id]);
  

  const handleSetCampaignIdeaData = (
    topic: string, 
    platform: Array<"LinkedIn" | "Instagram" | "X-Twitter" | "YouTube_Shorts" | "Facebook" | "Tiktok">,
    tone: "Professional" | "Casual" | "Enthusiastic" | "Informative",
    audience: string,
    data: ContentGenerationResponse

  ) => { 
    setFormData((prev) => ({ 
      ...prev, 
      step_1: data,
      topic,
      platform,
      tone,
      audience,
    }));
  }
  const handleSetImageUploadData = (data: ImageUploadStep) => { 
    setFormData((prev) => ({ ...prev, step_2: data }));
  }

  const handleSetVideoGenerationData = (data: VideoGenerationStep) => { 
    setFormData((prev) => ({ ...prev, step_3: data }));
  }

  const handleSetScheduleData = (data: ScheduleStep) => { 
    setFormData((prev) => ({ ...prev, step_5: data }));
  }

  const handleContentChange = (platform: string, field: string, value: string | string[]) => {
    setFormData((prev) => {
      const prevStep1 = prev.step_1 ?? {
        name: '',
        description: '',
        additional_notes: '',
        platform_posts: {},
      };

      const prevPlatformPosts = prevStep1.platform_posts ?? {};

      return {
        ...prev,
        step_1: {
          ...prevStep1,
          platform_posts: {
            ...prevPlatformPosts,
            [platform]: {
              ...prevPlatformPosts[platform],
              [field]: value,
            },
          },
        },
      };
    });
  };



  const stepsData = [
    { step: 1, icon: <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />, title: 'Campaign Idea', component: <CampaignIdea data={formData} setStepData={handleSetCampaignIdeaData} setNextStepValid={(valid: boolean) => setStepValid(1, valid)} setBackStepValid={(valid: boolean) => setBackValid(1, valid)}/> },
    { step: 2, icon: <ImagePlus className="w-4 h-4 sm:w-5 sm:h-5" />, title: 'Image Generation', component: <ImageUpload data={formData} setStepData={handleSetImageUploadData} setNextStepValid={(valid: boolean) => setStepValid(2, valid)} setBackStepValid={(valid: boolean) => setBackValid(2, valid)}/> },
    { step: 3, icon: <Video className="w-4 h-4 sm:w-5 sm:h-5" />, title: 'Video Creation', component: <VideoGeneration data={formData} setStepData={handleSetVideoGenerationData} setNextStepValid={(valid: boolean) => setStepValid(3, valid)} setBackStepValid={(valid: boolean) => setBackValid(3, valid)}/> },
    { step: 4, icon: <Eye className="w-4 h-4 sm:w-5 sm:h-5" />, title: 'Post Preview', component: <PreviewPostData data={formData} onUpdate={handleContentChange}/> },
    { step: 5, icon: <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />, title: 'Schedule & Confirm', component: <ScheduleConfirm data={formData} setStepData={handleSetScheduleData} setBackStepValid={(valid: boolean) => setBackValid(5, valid)}/> },
  ];

  const currentStep = stepsData[step - 1];
  const isNextDisabled = !isNextStepValidMap[step];
  const isBackDisabled = !isBackStepValidMap[step];

  return (
    <div className="mx-auto">
      {/* Horizontal Stepper with Icons on Mobile - Non-clickable */}
      <div className="mb-4 sm:mb-6">
        <div className="flex justify-between items-center overflow-x-auto no-scrollbar py-2">
          {stepsData.map((item, index) => (
            <div key={item.step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step > item.step
                      ? "bg-green-500 text-white"
                      : step === item.step
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-500 border border-gray-300"
                  }`}
                >
                  {step > item.step ? <CheckCircle className="w-5 h-5" /> : item.icon}
                </div>
                <span className="hidden sm:block text-xs mt-1 font-medium text-center">{item.title}</span>
              </div>

              {/* Connector line - only if not last step */}
              {index < stepsData.length - 1 && (
                <div
                  className={`h-0.5 w-4 sm:w-8 md:w-12 lg:w-16 mx-1 sm:mx-2 ${
                    step > item.step ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current step indicator */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center">
          {currentStep.icon}
          <h2 className="text-lg sm:text-xl font-semibold ml-2 text-primary">{currentStep.title}</h2>
        </div>
        <div className="text-xs sm:text-sm text-gray-500">
          Step {step} of {stepsData.length}
        </div>
      </div>

      <div className="mb-6">
        {currentStep.component}
      </div>

      <Navigation 
        step={step} 
        nextStep={nextStep} 
        prevStep={prevStep} 
        isNextDisabled={isNextDisabled}
        isBackDisabled={isBackDisabled}
      />
    </div>
  );
}

export default MultiStepWizard;
