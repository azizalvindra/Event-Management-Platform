// src/app/scripts/transactionCron.ts
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient, PostgrestError } from '@supabase/supabase-js';

type RpcResult = {
  ok: boolean;
  expired?: number;
  canceled?: number;
  reason?: string;
};

// load .env dari project root (EVENT-MGMT-PLATFORM/.env)
const envPath = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config(); // fallback
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env; aborting.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function isRpcResult(value: unknown): value is RpcResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('ok' in value)
  );
}

async function callRpc(): Promise<RpcResult> {
  const response = await supabase.rpc('cron_update_transaction_status');
  if (response.error) {
    const err = response.error as PostgrestError;
    console.error('Supabase RPC error:', {
      message: err.message,
      details: err.details ?? undefined,
      hint: err.hint ?? undefined,
    });
    throw new Error(err.message);
  }

  const data = response.data;
  if (isRpcResult(data)) return data as RpcResult;

  // fallback safety
  return { ok: false, reason: 'unexpected_rpc_result' };
}

async function run(): Promise<void> {
  try {
    console.log(new Date().toISOString(), 'CRON RUN START');
    const result = await callRpc();
    if (result.ok) {
      console.log('RPC result:', {
        expired: result.expired ?? 0,
        canceled: result.canceled ?? 0,
      });
      process.exit(0);
    } else {
      console.warn('RPC returned not-ok:', result.reason ?? 'no reason');
      process.exit(0); // job considered finished (no error), scheduler just moves on
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error('CRON ERROR:', err.message);
    } else {
      console.error('CRON ERROR (unknown):', String(err));
    }
    process.exit(2);
  }
}

if (require.main === module) {
  // executed directly
  run();
}

export { run };
