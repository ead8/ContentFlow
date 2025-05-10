import { ContentGenerationResponse } from '@/models/content';
import React, { useEffect, useState } from 'react'; // Assuming you are calling generateContent here

interface ContentPreviewProps {
  data: ContentGenerationResponse;
}

const ContentPreviewComponent: React.FC<ContentPreviewProps> = ({ data }) => {

  return (
    <div className="content-preview">
      <h2>{data.name}</h2>
      <p>{data.description}</p>

      <div className="platform-posts">
        {Object.keys(data.platform_posts).map((platform) => {
          const platformPost = data.platform_posts[platform];
          return (
            <div key={platform} className="platform-post">
              <h3>{platform}</h3>
              {platformPost.image_suggestion && (
                <div>
                  <strong>Image Suggestion:</strong> <p>{platformPost.image_suggestion}</p>
                </div>
              )}
              {platformPost.video_suggestion && (
                <div>
                  <strong>Video Suggestion:</strong> <p>{platformPost.video_suggestion}</p>
                </div>
              )}
              {platformPost.post && (
                <div>
                  <strong>Post:</strong> <p>{platformPost.post}</p>
                </div>
              )}
              {platformPost.caption && (
                <div>
                  <strong>Caption:</strong> <p>{platformPost.caption}</p>
                </div>
              )}
              {platformPost.hashtags && platformPost.hashtags.length > 0 && (
                <div>
                  <strong>Hashtags:</strong> <p>{platformPost.hashtags.join(', ')}</p>
                </div>
              )}
              {platformPost.emojis && platformPost.emojis.length > 0 && (
                <div>
                  <strong>Emojis:</strong> <p>{platformPost.emojis.join(' ')}</p>
                </div>
              )}
              {platformPost.call_to_action && (
                <div>
                  <strong>Call to Action:</strong> <p>{platformPost.call_to_action}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.additional_notes && (
        <div className="additional-notes">
          <strong>Additional Notes:</strong>
          <p>{data.additional_notes}</p>
        </div>
      )}
    </div>
  );
};

export default ContentPreviewComponent;
