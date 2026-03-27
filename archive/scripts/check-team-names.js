require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  const { data, error } = await sb
    .from("teams")
    .select("id, name")
    .order("name");
  if (error) {
    console.error("Error:", error.message);
    return;
  }
  console.log("Teams in DB:");
  data.forEach((t) => console.log(`  "${t.name}" (${t.id})`));
}
main();
