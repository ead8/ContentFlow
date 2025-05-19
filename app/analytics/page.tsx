import { BarChart3 } from "lucide-react"; // Lucide icon for analytics

const AnalyticsPage = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-white">
            <BarChart3 className="w-16 h-16 text-blue-600 mb-6 animate-pulse" />
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Analytics Dashboard Coming Soon</h1>
            <p className="text-gray-600 max-w-md text-base">
                We're crafting smart analytics to help you understand your social media performance, growth trends, and audience engagement — all in one place.
            </p>
        </div>
    );
};

export default AnalyticsPage;
