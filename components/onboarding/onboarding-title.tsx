import Image from "next/image"

interface OnboardingTitleProps {
  title?: string
  subtitle?: string
}

export default function OnboardingTitle({
  title,
  subtitle,
}: OnboardingTitleProps) {
  return (
    <div className="flex items-center gap-4 w-full mx-auto">
      <div className="relative flex-shrink-0">
          <Image
            src="/images/icons/bot.svg"
            alt="Bot avatar"
            width={16}
            height={16}
            className="w-12 h-12 object-contain"
          />
      </div>

      <div className="flex-1 rounded-lg px-4 py-2 shadow-md border">
        <p className="text-gray-500 mb-1">{subtitle}</p>
        <p className="font-medium">{title}</p>
      </div>
    </div>
  )
}
