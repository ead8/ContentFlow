import { createClient } from '@/lib/supabase/client';
import { ContentGenerationRequest, ContentGenerationResponse } from '@/models/content';

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