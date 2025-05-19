import { Settings } from "lucide-react"; // Lucide icon for settings

const SettingsPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-white">
      <Settings className="w-16 h-16 text-blue-600 mb-6 animate-pulse" />
      <h1 className="text-3xl font-bold text-gray-900 mb-3">
        Settings Panel Coming Soon
      </h1>
      <p className="text-gray-600 max-w-md text-base">
        We’re building a flexible settings panel where you’ll be able to manage
        your account, notifications, and workspace preferences — all in one place.
      </p>
    </div>
  );
};

export default SettingsPage;
