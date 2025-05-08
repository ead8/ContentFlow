import { createClient } from '@/lib/supabase/client';

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
      'X-N8N-API-KEY': N8N_API_KEY,
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
      'X-N8N-API-KEY': N8N_API_KEY,
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
      'X-N8N-API-KEY': N8N_API_KEY,
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
      'X-N8N-API-KEY': N8N_API_KEY,
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch account summary');
  }

  return response.json();
}