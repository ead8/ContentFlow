import { ArrowBigRight, ArrowRight } from "lucide-react";
import { useState } from "react";
import BusinessTypeSelector from "../onboarding/business-type-selector";
import PainPointSelector from "../onboarding/pain-point-selector";
import Link from "next/link";
import { Button } from "../ui";
import NicheAudienceForm from "../onboarding/niche-audience-selector";
import PlatformSelector from "../onboarding/platform-selection";
// import PainPointStep from "./PainPointStep";
// Import other step components similarly
// import BusinessStep from "./BusinessStep";
// import NicheStep from "./NicheStep";
// import PlatformStep from "./PlatformStep";

const steps = [
  "Pain Point",
  "Business Identification",
  "Niche & Audience",
  "Platform Selection",
];

export default function MultiStepProgress() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});

  const handleNext = (data: any) => {
    setFormData((prev) => ({ ...prev, ...data }));
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      console.log("Final Data:", formData);
      // submit to backend or navigate
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <PainPointSelector/>
      case 1: 
        return <BusinessTypeSelector/>
      case 2: 
        return <NicheAudienceForm/>
      case 3: 
        return <PlatformSelector/>
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
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <p className="font-medium">Step <span className="text-lg text-primary font-bold">{currentStep + 1}</span>/4</p>
                    <p className="text-lg font-medium">{steps[currentStep]}</p>
                </div>
                <Link href="/dashboard">
                    <div className="flex items-center gap-2 text-primary cursor-pointer font-medium">
                        <p>Skip to Dashboard</p>
                        <ArrowRight/>
                    </div>
                </Link>
            </div>
            {renderStep()}
            <div className="flex justify-between items-center gap-8 mt-8">
                <Button
                    variant="outline"
                    className="w-full text-sm text-gray-500 hover:underline"
                    onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                >
                    Back
                </Button>
                <Button
                    variant="default"
                    className="w-full text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    onClick={() => handleNext({})}
                >
                    Next
                </Button>
            </div>
        </div>
    </div>
  );
}
