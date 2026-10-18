import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import BusinessTypeSelector from "../onboarding/business-type-selector";
import PainPointSelector from "../onboarding/pain-point-selector";
import Link from "next/link";
import { Button } from "../ui";
import NicheAudienceForm from "../onboarding/niche-audience-selector";
import PlatformSelector from "../onboarding/platform-selection";
import { handleOnboarding } from "@/lib/api/supabase";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const steps = [
  "Pain Point",
  "Business Identification",
  "Niche & Audience",
  "Platform Selection",
];

interface OnboardingFormType {
  painPoint: string[]
  businessType: string
  niche: {
    title: string,
    description: string
  },
  platform: string[]
}

const defaultForm: OnboardingFormType = {
  painPoint: [],
  businessType: "",
  niche: { title: '', description: '' },
  platform: [],
}

export default function MultiStepProgress() {
  const { toast } = useToast()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormType>(defaultForm)
  const [isLoading, setLoading] = useState(false)


  const [isNextStepValidMap, setIsNextStepValidMap] = useState<Record<number, boolean>>({
    0: false,
    1: false,
    2: false,
    3: false,
  });

  const setStepValid = (stepIndex: number, isValid: boolean) => {
    setIsNextStepValidMap((prev) => ({ ...prev, [stepIndex]: isValid }));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmit()
    }
  };

  const handleSubmit = async () => {
      try {
          setLoading(true)
          // Initialize Supabase client
          const supabase = createClient()
          
          // Get session data
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
              throw new Error('User is not authenticated')
          }

          const response = await handleOnboarding({
              platforms: formData.platform,
              business_type: formData.businessType,
              pain_points: formData.painPoint,
              niche_title: formData.niche.title,
              niche_description: formData.niche.description,
              user_id: session.user?.id, // Ensure user exists and is valid
          })

          if (response) {
              toast({
                  title: 'Success',
                  description: 'Your onboarding data has been submitted successfully!',
                  variant: 'default',
              })
              router.push('/dashboard')
          } else {
              toast({
                  title: 'Error',
                  description: 'There was an error submitting your onboarding data. Please try again.',
                  variant: 'destructive',
              })
          }
      } catch (error) {
          toast({
              title: 'Error',
              description: 'There was an error submitting your onboarding data. Please try again.',
              variant: 'destructive',
          })
      } finally {
          setLoading(false)
      }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <PainPointSelector
            selected={formData.painPoint}
            setSelected={(selected) => {
              setFormData((prev) => ({ ...prev, painPoint: selected }));
              setStepValid(0, selected.length > 0);
            }}
          />
        );
      case 1:
        return (
          <BusinessTypeSelector
            value={formData.businessType}
            setValue={(businessType) => {
              setFormData((prev) => ({ ...prev, businessType }));
              setStepValid(1, businessType.trim().length > 0);
            }}
          />
        );
      case 2:
        return (
          <NicheAudienceForm
            value={formData.niche}
            setValue={(niche) => {
              setFormData((prev) => ({ ...prev, niche }));
              const isValid =
                niche.title.trim().length > 0 ||
                niche.description.trim().length > 0;
              setStepValid(2, isValid);
            }}
          />
        );
      case 3:
        return (
          <PlatformSelector
            selected={formData.platform}
            setSelected={(selected) => {
              setFormData((prev) => ({ ...prev, platform: selected }));
              setStepValid(3, selected.length > 0);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] w-full">
        <div className="w-full bg-gray-200 h-4 mb-6 overflow-hidden">
            <div
            className="h-full bg-[#32D77D] transition-all duration-500 rounded-r-full"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
        </div>
        <div className="w-full px-8">
            <div className="flex justify-between mb-4">
                <div className="flex flex-col gap-2 md:flex-row">
                    <p className="font-medium">Step <span className="text-lg text-primary font-bold">{currentStep + 1}</span>/4</p>
                    {/* <p className="text-lg font-medium">{steps[currentStep]}</p> */}
                </div>
                <Link href="/dashboard">
                    <div className="flex items-center gap-2 text-primary cursor-pointer font-medium">
                        <p>Skip to Dashboard</p>
                        <ArrowRight/>
                    </div>
                </Link>
            </div>
            <p className="text-lg font-medium">{steps[currentStep]}</p>
            {renderStep()}{/* Navigation */}
            <div className="flex justify-end items-center gap-8 mt-8">
              {currentStep !== 0 && (
                <Button
                  variant="outline"
                  disabled={isLoading}
                  className="flex-1 text-sm text-gray-500 hover:underline"
                  onClick={() =>
                    setCurrentStep((prev) => Math.max(prev - 1, 0))
                  }
                >
                  Back
                </Button>
              )}
              <Button
                variant="default"
                className="flex-1 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                onClick={handleNext}
                disabled={isLoading || !isNextStepValidMap[currentStep]}
              >
                {currentStep === 3 ? (isLoading ? "Submitting" : "Submit") : "Next"}
              </Button>
            </div>
    
        </div>
    </div>
  );
}
