import { ImageUploadStep, WizardFormData } from '@/components/generate/MultiStep';
import { createClient } from '@/lib/supabase/client';
import { ContentGenerationRequest, ContentGenerationResponse, MediaGenerationRequest, MediaGenerationResult } from '@/models/content';

const N8N_API_URL = process.env.NEXT_PUBLIC_N8N_API_URL;
const N8N_API_KEY = process.env.NEXT_PUBLIC_N8N_API_KEY;

if (!N8N_API_URL || !N8N_API_KEY) {
  throw new Error('N8N environment variables are required');
}

export async function fetchDashboardStats() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${N8N_API_URL}/api/v1/dashboard/stats`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY ?? '',
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }

  return response.json();
}

export async function fetchPostPerformance() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${N8N_API_URL}/api/v1/posts/performance`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY ?? '',
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch post performance');
  }

  return response.json();
}

export async function fetchCreditUsage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${N8N_API_URL}/api/v1/credits/usage`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY ?? '',
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch credit usage');
  }

  return response.json();
}

export async function fetchAccountSummary() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${N8N_API_URL}/api/v1/account/summary`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY ?? '',
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch account summary');
  }

  return response.json();
}

export async function generateContent(data: ContentGenerationRequest): Promise<ContentGenerationResponse> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  // Check if the session exists (user is authenticated)
  if (!session) {
    throw new Error('Not authenticated');
  }

  const n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_CONTENT_GENERATION_WEBHOOK_URL;

  if (!n8nWebhookUrl) {
    throw new Error("N8N webhook URL is not defined in environment variables.");
  }


  const response = await fetch(n8nWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data), // Send the form data to n8n
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("N8N Webhook Error:", errorData);
    throw new Error(`N8N webhook failed with status ${response.status}: ${errorData.message || "Unknown error"}`);
  }

  const responseBody = await response.json(); // Parse the response from n8n

  const generated_content: ContentGenerationResponse = responseBody[0]?.output;


  // Ensure the generated content follows the expected format
  if (!generated_content.name || !generated_content.description || !generated_content.platform_posts) {
    throw new Error("N8N webhook response is missing required fields.");
  }

  return generated_content; // Return the properly typed response
}

export async function generateImage(data: ImageUploadStep): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check if the session exists (user is authenticated)
  if (!session) {
    throw new Error("Not authenticated");
  }

  const n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_IMAGE_GENERATION_WEBHOOK_URL;
  if (!n8nWebhookUrl) {
    throw new Error("N8N webhook URL is not defined in environment variables.");
  }

  const response = await fetch(n8nWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = "Unknown error";
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      console.error("N8N Webhook Error:", errorData);
    } catch (err) {
      console.error("Failed to parse error response:", err);
    }
    throw new Error(`N8N webhook failed with status ${response.status}: ${errorMessage}`);
  }

  // Parse response and return the image URL
  const responseBody = await response.json();
  // const responseJson = JSON.parse(responseBody)
  if (!responseBody.image_url) {
    throw new Error("No image URL returned from N8N.");
  }

  return responseBody.image_url; // Return the image URL
}

export async function generateMedia(request: MediaGenerationRequest): Promise<MediaGenerationResult> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("You must be logged in to generate media.");
  }

  const n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_MEDIA_GENERATION_WEBHOOK_URL;
  if (!n8nWebhookUrl) {
    throw new Error("Missing N8N webhook URL in environment variables.");
  }

  const response = await fetch(n8nWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let errorMessage = "Unknown error";
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      console.error("N8N Webhook Error:", errorData);
    } catch (err) {
      console.error("Failed to parse error response:", err);
    }
    throw new Error(`Media generation failed: ${errorMessage}`);
  }

  const responseBody = await response.json();

  if (!responseBody?.success || !responseBody?.data) {
    throw new Error("Invalid response from media generation server.");
  }


  return {
    mediaId: responseBody.data.media_id,
    jobId: responseBody.data.job_id
  };
}

export async function createPost(data: WizardFormData): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check if the session exists (user is authenticated)
  if (!session) {
    throw new Error("Not authenticated");
  }

  const n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_CREATE_POST_WEBHOOK_URL;
  if (!n8nWebhookUrl) {
    throw new Error("N8N webhook URL is not defined in environment variables.");
  }

  console.log("Create Post Data", data);
  const {
    user_id,
    topic,
    tone,
    platform,
    step_1,
    step_2,
    step_3,
    step_5,
  } = data;

  const imageUrl = step_2?.image_upload
  const videoUrl = step_3?.video_url
  const scheduleAt = step_5?.schedule_at

  const platform_variants: Record<string, any> = {};

  platform?.forEach((p) => {
    const platformPost = step_1?.platform_posts?.[p] ?? {};

    platform_variants[p] = {
      image: imageUrl,
      video: videoUrl,
      post: platformPost.post,
      text: platformPost.post,
      caption: platformPost.caption,
      hashtags: (platformPost.hashtags || []).join(" "),
      call_to_action: platformPost.call_to_action,
      schedule_at: scheduleAt,
    };
  });

  const response = await fetch(n8nWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id,
      topic,
      tone,
      platform_variants,
      status: "Draft"
    })
  })

  if (!response.ok) {
    let errorMessage = "Unknown error";
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      console.error("N8N Webhook Error:", errorData);
    } catch (err) {
      console.error("Failed to parse error response:", err);
    }
    throw new Error(`N8N webhook failed with status ${response.status}: ${errorMessage}`);
  }

  // Parse response and return the image URL
  const responseBody = await response.json();
  if (!responseBody.id) {
    throw new Error("No Id returned from N8N.");
  }

  return responseBody.id; // Return the image URL
}

export async function pollVideoStatus(
  jobId: string,
  mediaId: string,
  {
    maxAttempts = 40,
    initialInterval = 3000, // 3 seconds
    slowInterval = 7000,   // 7 seconds after 1 minute
    switchAfterMs = 60000,  // 1 minute
  } = {}
): Promise<string> {
  const STATUS_WEBHOOK = process.env.NEXT_PUBLIC_N8N_VIDEO_STATUS_WEBHOOK_URL!;
  let attempt = 0;
  const startTime = Date.now();

  while (attempt < maxAttempts) {
    try {
      const res = await fetch(STATUS_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, media_id: mediaId }),
      });

      if (!res.ok) {
        console.error("Status check failed:", res.status, res.statusText);
        throw new Error("We couldn't check the video right now. Please try again.");
      }

      const json = await res.json();

      if (json.status === "succeed" && json.video_url) {
        return json.video_url;
      }

      if (json.status === "failed") {
        throw new Error("Video generation failed. Please try again.");
      }

      const now = Date.now();
      const waitTime = now - startTime < switchAfterMs ? initialInterval : slowInterval;

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      attempt++;
    } catch (err: any) {
      console.error("Polling error:", err);
      throw new Error("Something went wrong. Please try again later.");
    }
  }

  throw new Error("Video is taking longer than expected. Please try again in a few minutes.");
}