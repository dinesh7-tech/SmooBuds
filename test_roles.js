import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Load env variables
const envContent = fs.readFileSync("./.env.local", "utf8");
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseKey = envContent.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim() || envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from("user_roles").select("*");
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("USER ROLES:");
    console.table(data);
  }
}
run();
