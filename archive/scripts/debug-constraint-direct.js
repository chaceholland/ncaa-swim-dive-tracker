require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  // Try updating these directly with specific values from the site
  // Tommy-Lee Camblong got "Academic Year Gr." which normalizes to "graduate"
  // Let's try updating him

  const testCases = [
    {
      id: "a7e20483-90d3-45ca-b472-c3c26ab28264",
      name: "Tommy-Lee Camblong",
      val: "graduate",
    },
    {
      id: "61de9761-1883-443f-8a99-ab9041aa4b53",
      name: "Luca Urlando",
      val: "graduate",
    },
    {
      id: "0a7b335e-e575-45bf-99c5-ae85c0c69e7e",
      name: "Drew Huston",
      val: "graduate",
    },
    {
      id: "836f15a0-7b41-4f93-88cb-9594bee5c758",
      name: "Tate Bacon",
      val: "graduate",
    },
    {
      id: "889a99b8-3565-4bb0-9bad-7033b678ca0c",
      name: "Moritz Wesemann",
      val: "graduate",
    },
    {
      id: "cae636fe-15e9-4194-a4bf-1ea5b0260733",
      name: "Filip Mujan",
      val: "graduate",
    },
    {
      id: "b3b27144-8bcb-4a14-8978-2c8ab62b0d76",
      name: "Vaggelis Makrygiannis",
      val: "graduate",
    },
  ];

  for (const tc of testCases) {
    const { error } = await sb
      .from("athletes")
      .update({ class_year: tc.val })
      .eq("id", tc.id)
      .is("class_year", null);
    if (error) {
      console.log(`${tc.name}: ERROR - ${error.message}`);
    } else {
      console.log(`${tc.name}: OK → "${tc.val}"`);
    }
  }
}
main();
