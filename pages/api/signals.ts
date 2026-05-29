import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseClient } from '../../lib/supabaseClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_history')
      .select('*')
      .order('c0_timestamp', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.status(200).json({
      signals: data ?? [],
      count: data?.length ?? 0,
    });
  } catch (error: unknown) {
    const normalized =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : typeof error === 'object' && error !== null
        ? JSON.parse(JSON.stringify(error))
        : { message: String(error) };

    res.status(500).json({
      message: 'Error fetching signals',
      error: normalized,
    });
  }
}