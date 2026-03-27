const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';

const supabase = createClient(supabaseUrl, supabaseKey);

// Photo updates to apply
// Format: { teamName, athleteName, photoUrl }
// Get the photoUrl from the roster page source (right-click image -> Copy image link)
const photoUpdates = [
  // Example format:
  // { teamName: 'South Carolina', athleteName: 'John Doe', photoUrl: 'https://example.com/photo.jpg' },
];

async function applyPhotoUpdates(updates) {
  console.log('\n🏊 NCAA Swim & Dive Tracker - Manual Photo Batch Update');
  console.log('='.repeat(60));
  console.log(`Starting batch update of ${updates.length} photos`);

  if (updates.length === 0) {
    console.log('No updates provided. Add photo URLs to the photoUpdates array.');
    process.exit(0);
  }

  let successCount = 0;
  let errorCount = 0;

  for (const update of updates) {
    try {
      // Get team ID
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id')
        .eq('name', update.teamName)
        .single();

      if (teamError) {
        console.log(`✗ Team not found: ${update.teamName}`);
        errorCount++;
        continue;
      }

      // Get athlete
      const { data: athleteData, error: athleteError } = await supabase
        .from('athletes')
        .select('id, photo_url')
        .eq('team_id', teamData.id)
        .eq('name', update.athleteName)
        .single();

      if (athleteError) {
        console.log(`✗ Athlete not found: ${update.athleteName} at ${update.teamName}`);
        errorCount++;
        continue;
      }

      // Update photo
      const { error: updateError } = await supabase
        .from('athletes')
        .update({ photo_url: update.photoUrl })
        .eq('id', athleteData.id);

      if (updateError) {
        console.log(`✗ Failed to update ${update.athleteName}: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`✓ Updated ${update.athleteName} (${update.teamName})`);
        successCount++;
      }
    } catch (error) {
      console.log(`✗ Error processing ${update.athleteName}: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Update Summary:');
  console.log(`  Successful: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log('='.repeat(60));

  process.exit(0);
}

// Helper function to find athletes with missing photos
async function showMissingPhotos() {
  console.log('\n🏊 NCAA Swim & Dive Tracker - Missing Photos Report');
  console.log('='.repeat(60));

  const teams = ['South Carolina', 'Arizona State', 'Penn State', 'Indiana', 'Purdue', 'Dartmouth'];

  for (const teamName of teams) {
    try {
      // Get team
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id')
        .eq('name', teamName)
        .single();

      if (teamError) {
        console.log(`\n${teamName}: NOT FOUND`);
        continue;
      }

      // Get athletes with missing photos
      const { data: athletes, error: athleteError } = await supabase
        .from('athletes')
        .select('id, name, profile_url')
        .eq('team_id', teamData.id)
        .is('photo_url', null);

      if (athleteError) {
        console.log(`\n${teamName}: ERROR - ${athleteError.message}`);
        continue;
      }

      if (athletes.length === 0) {
        console.log(`\n${teamName}: ✓ All athletes have photos`);
        continue;
      }

      console.log(`\n${teamName}: ${athletes.length} missing photos`);
      athletes.forEach(a => {
        console.log(`  - ${a.name}${a.profile_url ? ` (${a.profile_url})` : ''}`);
      });
    } catch (error) {
      console.log(`\n${teamName}: ERROR - ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Instructions:');
  console.log('1. Visit each team roster page');
  console.log('2. Right-click on athlete photos');
  console.log('3. Select "Copy image link" (or similar)');
  console.log('4. Add entries to photoUpdates array in format:');
  console.log('   { teamName: "...", athleteName: "...", photoUrl: "..." }');
  console.log('5. Run this script again with photoUpdates populated');
  console.log('='.repeat(60));

  process.exit(0);
}

// Check command line arguments
const args = process.argv.slice(2);

if (args[0] === '--show-missing') {
  showMissingPhotos();
} else if (args[0] === '--update') {
  applyPhotoUpdates(photoUpdates);
} else {
  console.log('\nUsage:');
  console.log('  node manual-photo-batch-update.js --show-missing');
  console.log('    Show athletes with missing photos');
  console.log('  node manual-photo-batch-update.js --update');
  console.log('    Apply updates from photoUpdates array (edit script first)');
  process.exit(0);
}
