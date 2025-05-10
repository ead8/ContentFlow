interface NavigationProps {
  step: number;
  nextStep: () => void;
  prevStep: () => void;
  isNextDisabled: boolean;
}

export function Navigation({ step, nextStep, prevStep, isNextDisabled }: NavigationProps) {

  const getTooltipMessage = () => {
  switch (step) {
    case 1:
      return 'Please generate the content';
    case 2:
      return 'Please upload or generate a post image';
    case 3:
      return 'Please generate video';
    case 5:
      return 'Please select your schedule to post';
    default:
      return '';
  }
};

  return (
    <div className="flex justify-end gap-2">
      {
        step > 1 && (
          <button
            className="bg-gray-300 text-gray-700 py-2 px-4 rounded disabled:opacity-50"
            onClick={prevStep}
          >
            Back
          </button>
        )
      }

      <button
        className="bg-primary text-white py-2 px-4 rounded disabled:opacity-50"
        onClick={nextStep}
        disabled={isNextDisabled}
        title={isNextDisabled ? getTooltipMessage() : ''}
      >
        {step === 5 ? 'Publish' : 'Next'}
      </button>
    </div>
  );
}
