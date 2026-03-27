require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  // Find Tommy-Lee Camblong, Luca Urlando, Drew Huston
  const names = [
    "Tommy-Lee Camblong",
    "Luca Urlando",
    "Drew Huston",
    "Tate Bacon",
    "Moritz Wesemann",
    "Filip Mujan",
    "Vaggelis Makrygiannis",
  ];

  for (const name of names) {
    const { data, error } = await sb
      .from("athletes")
      .select("id, name, class_year, team_id")
      .ilike("name", name);
    if (error) {
      console.log(`${name}: ERROR ${error.message}`);
    } else {
      console.log(`${name}:`, JSON.stringify(data));
    }
  }
}
main();
