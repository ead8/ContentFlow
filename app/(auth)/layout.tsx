import Image from "next/image";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex lg:h-screen">
        <div className="hidden bg-[#13032C] flex-1 lg:flex flex-col">
            <div className="relative w-full h-full">
                <Image
                src={"/images/background/auth_background.svg"}
                alt="background"
                fill
                className="opacity-25 object-cover w-full h-auto"
                />
            </div>
            <div className="flex gap-8 items-center px-8">
                <Image
                src={"/images/logo/intuitySync_logo.svg"}
                alt="logo"
                width={200}
                height={200}
                />
                <p className="text-white font-normal"> 
                    <span className="text-[#339DFF] font-semibold">AI-Driven SaaS Platform</span> automating social content creation, tailored for creators, founders, and marketing teams.
                </p>
            </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
           {children}
        </div>
    </div>
  )
}