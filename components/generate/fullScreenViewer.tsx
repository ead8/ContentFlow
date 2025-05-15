import React from 'react';
import { X } from 'lucide-react';

interface FullscreenImageViewerProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

const FullscreenImageViewer: React.FC<FullscreenImageViewerProps> = ({ src, alt = '', onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-full max-h-full p-4 animate-zoomIn"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-xl border border-white/10"
        />
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-white text-black p-2 rounded-full shadow-lg hover:bg-gray-100 transition"
          aria-label="Close fullscreen image"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default FullscreenImageViewer;
