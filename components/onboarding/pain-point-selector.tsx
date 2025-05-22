import { Check } from 'lucide-react';
import OnboardingTitle from './onboarding-title';

const painPoints = [
  { label: "I don't know what to post", icon: '/images/icons/know.svg' },
  { label: "I can't stay consistent", icon: '/images/icons/calendar.svg' },
  { label: "I'm not getting engagement", icon: '/images/icons/engagement.svg' },
  { label: 'I overthink everything', icon: '/images/icons/overthink.svg' },
]

interface PainPointSelectorProps {
  selected: string[];
  setSelected: (selected: string[]) => void;
}

export default function PainPointSelector({ selected, setSelected }: PainPointSelectorProps) {
  const toggleSelection = (label: string) => {
    setSelected(
      selected.includes(label)
        ? selected.filter((item) => item !== label)
        : [...selected, label]
    );
  };

  return (
    <div className="w-full py-4 mx-auto space-y-6">
      {/* Question */}
      <div className="w-full">
        <OnboardingTitle
          title="What do you struggle with most right now?"
          subtitle="Let’s build your bridge..."
        />
      </div>

      {/* Options */}
      <div className="flex flex-col items-center gap-4">
        {painPoints.map(({ label, icon }) => {
          const isSelected = selected.includes(label);
          return (
            <button
              key={label}
              onClick={() => toggleSelection(label)}
              className={`w-96 relative flex items-center border rounded-xl p-4 text-left transition duration-200 cursor-pointer ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-400'
              }`}
              type="button"
              aria-pressed={isSelected}
            >
              <div className="flex gap-4 items-center flex-1">
                <div className="flex-shrink-0">
                  <img src={icon || "/placeholder.svg"} alt="" className="w-8 h-8" aria-hidden="true" />
                </div>
                <span className="font-medium">{label}</span>
              </div>
              <div
                className={`flex-shrink-0 w-5 h-5 border rounded ${
                  isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300"
                } flex items-center justify-center`}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}