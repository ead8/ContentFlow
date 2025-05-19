import { ImagePlus } from "lucide-react"; // Lucide icon for media

const MediaLibraryPage = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 text-center bg-white">
            <ImagePlus className="w-16 h-16 text-blue-600 mb-6 animate-pulse" />
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Media Library Coming Soon</h1>
            <p className="text-gray-600 max-w-md text-base">
                Soon you’ll be able to upload, organize, and reuse your photos and videos — making content scheduling faster and more efficient.
            </p>
        </div>
    );
};

export default MediaLibraryPage;