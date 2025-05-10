'use client';

import { useState } from "react";
import Image from "next/image";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { UploadCloud } from "lucide-react";
import { ImageUploadStep } from "./MultiStep";


interface ImageUploadsProps {
    data?: ImageUploadStep;
    setStepData: (stepData: ImageUploadStep) => void;
    setNextStepValid: (isValid: boolean) => void;
}

const ImageUpload = ({ data, setStepData, setNextStepValid }: ImageUploadsProps) => {
  const [uploadPreview, setUploadPreview] = useState<string | null>(data?.image_upload || null);
  const [generationPrompt, setGenerationPrompt] = useState<string>(data?.image_prompt || "");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadPreview(url);
      setStepData({ image_upload: url, image_source: "uploaded", file });
      setNextStepValid(true)
    }
  };

  const handleGenerateImage = async () => {
    if (!generationPrompt.trim()) return;
    setIsGenerating(true);

    // Simulated image generation. Replace with your DALL·E API logic
    const generatedImageUrl = `https://dummyimage.com/600x400/000/fff&text=${encodeURIComponent(
      generationPrompt
    )}`;

    setUploadPreview(generatedImageUrl);
    setStepData({
      image_prompt: generationPrompt,
      image_source: "generated",
      image_upload: generatedImageUrl,
    })
    setNextStepValid(true)
    setIsGenerating(false);
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div>
        <h2 className="text-lg font-semibold mb-2">Upload Image</h2>
        <label
            htmlFor="image-upload"
            className="flex flex-col items-center justify-center w-full max-w-md p-4 transition bg-white border-2 border-dashed rounded-md cursor-pointer hover:bg-gray-50"
        >
            <UploadCloud className="w-10 h-10 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">Click to upload or drag & drop</p>
            <p className="text-xs text-gray-400">PNG, JPG, JPEG up to 5MB</p>
            <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            />
        </label>
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold mb-2">Or Generate via Our Image Generator AI</h2>
          <Textarea
            value={generationPrompt}
            onChange={(e) => setGenerationPrompt(e.target.value)}
            placeholder="Describe the image you want to generate"
          />
          <Button onClick={handleGenerateImage} disabled={isGenerating} className="mt-2">
            {isGenerating ? "Generating..." : "Generate Image"}
          </Button>
        </div>

        {uploadPreview && (
          <div>
            <h3 className="text-md font-medium mb-2">Preview</h3>
            <div className="border rounded-md overflow-hidden w-full max-w-md">
              <Image
                src={uploadPreview}
                alt="Selected"
                width={600}
                height={400}
                className="object-cover"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImageUpload;
