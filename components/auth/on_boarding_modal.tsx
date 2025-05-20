import { Button } from "@/components/ui/button"; // Adjust based on your project structure

export default function OnboardingModal({onStart }: { onStart: () => void }) {
  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-2xl p-8 text-center">
      <h2 className="text-2xl font-semibold text-gray-900">
        You are all set, <span className="inline-block ml-1">👍</span>
      </h2>
      <p className="text-gray-600 mt-3">
        We’ll now walk you through a brief onboarding process to configure your account.
      </p>
      <Button
        className="mt-6 text-white bg-blue-500 hover:bg-blue-600 rounded-lg px-6 py-2"
        onClick={onStart}
      >
        Start Onboarding
      </Button>
    </div>
  );
}
