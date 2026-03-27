require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  // Check what values are currently in the class_year column
  const { data } = await sb
    .from("athletes")
    .select("class_year")
    .not("class_year", "is", null);
  const values = [...new Set(data.map((a) => a.class_year))].sort();
  console.log("Existing class_year values:", values);

  // Try to insert a graduate value to see the error
  const { data: test, error } = await sb
    .from("athletes")
    .select("id")
    .limit(1)
    .single();
  if (!test) return;

  const { error: upErr } = await sb
    .from("athletes")
    .update({ class_year: "graduate" })
    .eq("id", "00000000-0000-0000-0000-000000000000"); // non-existent ID — just check constraint
  if (upErr) console.log("graduate error:", upErr.message);

  // Try valid values
  for (const val of [
    "freshman",
    "sophomore",
    "junior",
    "senior",
    "graduate",
    "grad",
    "5th year",
  ]) {
    const { error } = await sb
      .from("athletes")
      .update({ class_year: val })
      .eq("id", "00000000-0000-0000-0000-000000000000");
    console.log(
      `"${val}":`,
      error ? error.message.substring(0, 60) : "OK (no row matched)",
    );
  }
}
main();
