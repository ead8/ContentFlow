"use client";

import { Check } from "lucide-react";
import OnboardingTitle from "./onboarding-title";

interface BusinessTypeSelectorProps {
  value: string;
  setValue: (val: string) => void;
}

const businessTypes = [
  { label: "Coaches", icon: "/images/icons/coaches.svg" },
  { label: "Agencies", icon: "/images/icons/agencies.svg" },
  { label: "Local Business", icon: "/images/icons/local.svg" },
  { label: "Personal Brand", icon: "/images/icons/personal.svg" },
];

export default function BusinessTypeSelector({
  value,
  setValue,
}: BusinessTypeSelectorProps) {
  return (
    <div className="p-6 mx-auto space-y-6">
      {/* Question */}
      <div className="w-full">
        <OnboardingTitle title="What business type do you identify yourself with?" />
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-4">
        {businessTypes.map(({ label, icon }) => {
          const isSelected = value === label;
          return (
            <button
              key={label}
              onClick={() => setValue(label)}
              className={`relative flex flex-col items-center justify-center border rounded-xl p-4 text-center transition duration-200 ${
                isSelected
                  ? "border-blue-500 shadow-lg"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <img src={icon} alt={label} className="w-10 h-10 mb-2" />
              <span className="font-medium">{label}</span>
              {isSelected && (
                <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
