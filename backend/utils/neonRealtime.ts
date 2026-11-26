import { createRealtime } from '@neon/realtime/server';

const secret = process.env.NEON_REALTIME_SECRET || '';
const realtimeUrl = process.env.NEON_REALTIME_URL || '';

export const realtime = secret
  ? createRealtime({
      secret,
      db: 'neondb'
    })
  : null;

export const isRealtimeConfigured = (): boolean => {
  return Boolean(secret && realtimeUrl);
};

export const getRealtimeConfig = () => ({
  configured: isRealtimeConfigured(),
  url: realtimeUrl,
  branch: process.env.NEON_BRANCH || 'production',
  branchId: process.env.NEON_BRANCH_ID || ''
});
