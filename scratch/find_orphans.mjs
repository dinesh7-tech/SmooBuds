import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const parts = line.split('=');
    const key = parts.shift().trim();
    const val = parts.join('=').trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
async function run() {
  const { data: orders } = await supabase.from('orders').select('id');
  const { data: items } = await supabase.from('order_items').select('order_id');
  const itemOrderIds = new Set((items || []).map(i => i.order_id));
  const orphans = (orders || []).filter(o => !itemOrderIds.has(o.id));
  console.log('Total orders:', orders?.length);
  console.log('Orphaned orders:', orphans.length);
}
run();
