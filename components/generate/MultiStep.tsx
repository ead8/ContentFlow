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


export interface ImageUploadStep {
  image_upload?: string;
  prompt?: string;
  image_source?: 'generated' | 'uploaded';
  file?: File;
}

export interface VideoGenerationStep {
  add_video: boolean;
  video_type?: 'Tavus' | 'Shotstack';
  video_prompt?: string;
  video_url?: string;
}

export interface Step4Data {
  
}

export interface ScheduleStep {
  schedule_at?: string;
  auto_schedule: boolean;
  status?: 'scheduled' | 'draft';
}

export interface WizardFormData {
  user_id?: string;
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
        return { [stepIndex]: stepIndex === 4 }; // Step 4 (Preview) is always valid
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
  
  useEffect(() => {
    if (user?.id && !formData.user_id) {
      setFormData((prev) => ({ ...prev, user_id: user.id }));
    }
  }, [user, formData.user_id]);
  

  const handleSetCampaignIdeaData = (data: ContentGenerationResponse) => { 
    setFormData((prev) => ({ ...prev, step_1: data }));
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

  const stepsData = [
    { step: 1, title: 'Campaign Idea', component: <CampaignIdea data={formData.step_1} setStepData={handleSetCampaignIdeaData} setNextStepValid={(valid: boolean) => setStepValid(1, valid)}/> },
    { step: 2, title: 'Image Upload', component: <ImageUpload data={formData.step_2} setStepData={handleSetImageUploadData} setNextStepValid={(valid: boolean) => setStepValid(2, valid)}/> },
    { step: 3, title: 'Video Creation', component: <VideoGeneration data={formData.step_3} setStepData={handleSetVideoGenerationData} setNextStepValid={(valid: boolean) => setStepValid(3, valid)}/> },
    { step: 4, title: 'Post Preview', component: <PreviewPostData data={formData}/> },
    { step: 5, title: 'Schedule & Confirm', component: <ScheduleConfirm data={formData} setStepData={handleSetScheduleData} setNextStepValid={(valid: boolean) => setStepValid(5, valid)}/> },
  ];

  const currentStep = stepsData[step - 1];
  const isNextDisabled = !isNextStepValidMap[step];

  return (
    <div className="mx-auto">
      <div className="flex md:flex-row flex-col md:items-center items-start md:space-x-0 space-y-6 md:space-y-0 md:justify-between mb-10 relative">
        {stepsData.map((item, index) => (
            <div key={item.step} className="flex items-center w-full md:w-auto">
                {/* Step Circle + Label */}
                <div className="flex flex-col items-center text-center md:flex-row md:items-center md:space-x-2 w-full">
                    <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white z-10 ${
                        step >= item.step ? 'bg-primary' : 'bg-gray-300'
                    }`}
                    >
                    {item.step}
                    </div>
                    <div className={`text-sm font-medium mt-2 md:mt-0 ${step >= item.step ? 'text-primary' : 'text-gray-400'}`}>
                    {item.title}
                    </div>
                </div>

                {/* Connector line - only if not last step */}
                {index < stepsData.length - 1 && (
                    <div
                    className={`hidden md:block flex-grow h-1 mx-2 ${
                        step > item.step ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    style={{ minWidth: '40px' }}
                    />
                )}

                {/* Vertical line on small screens */}
                {index < stepsData.length - 1 && (
                    <div
                    className={`block md:hidden w-1 h-6 mx-auto ${
                        step > item.step ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    />
                )}
            </div>
        ))}
      </div>


      <div className="mb-6">
        {currentStep.component}
      </div>

      <Navigation 
        step={step} 
        nextStep={nextStep} 
        prevStep={prevStep} 
        isNextDisabled={isNextDisabled}
      />
    </div>
  );
}

export default MultiStepWizard;
