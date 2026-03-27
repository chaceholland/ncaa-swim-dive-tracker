// Test the EXACT bypass logic that's in production
// to verify which URLs should be using <img> vs Next Image

const testUrls = [
  { team: 'Cal', url: 'https://calbears.com/images/2025/9/24/Colby_Hatton_20250911_KCox_165831.jpg?width=1920&height=1920' },
  { team: 'SMU', url: 'https://smumustangs.com/images/2025/9/19/Aidan_Arie_Cropped.jpg?width=1920&height=1920' },
  { team: 'Stanford', url: 'https://storage.googleapis.com/stanford-prod/2025/10/11/nioEGuidJFW4DDUvjZZsruQemWXxvaoXIbSJdtTq.jpg' },
  { team: 'Virginia', url: 'https://virginiasports.com/imgproxy/5DhgCEZUkMe6niTNt3D9Qa1MY7F86yJ9jNyxt-A57OM/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3Zpcmdpbmlhc3BvcnRzLWNvbS1wcm9kLzIwMjUvMTAvMDYvV1RsOEVkdzNLV3g5RnpIczVNOHhiOG5BZzhoNnE1ODVMZ3Y0bGI0Wi5wbmc.png' },
  { team: 'Notre Dame', url: 'https://fightingirish.com/imgproxy/2cEH5R8L7TkNs3G99Jr4jR-N8OU1SiduSPW4yPFaiQE/fit/1980/0/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL25kLXNwb3J0cy1wcm9kLzIwMjUvMDgvMjUvcGd3Z1R2YWdqYnNqd2N4NGZIbzM0dkRCeWMwdXZ3aVdENFBjUzVpQS5qcGc.jpg' },
  { team: 'Virginia Tech', url: 'https://hokiesports.com/imgproxy/WdfTC1qsZKfseFHUiFMdPJbP-A7kovabYbb-u_Pagcg/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3ZpcmdpbmlhdGVjaC1wcm9kLzIwMjQvMDMvMjAvTnV4UWtxUXQzd011b1hsVGJ0eG0yWkZ1cHFFWDBBSmZ3eW1ZWXpTWi5wbmc.png' },
  { team: 'Georgia Tech', url: 'https://ramblinwreck.com/imgproxy/66oRiAooBJ7eHdfNcVQc4d8HQC3J26gV-i0ilvJAB_A/fill/1980/0/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3JhbWJsaW53cmVjay1wcm9kLzIwMjQvMDkvMjcvdWFiM3FpR1NzQWc3bEw5Tm40S3ZicW1BTDhrN3luMllDdEQ3ZFFmTC5qcGc.jpg' },
];

function shouldBypassVercel(url) {
  if (!url) return false;

  return url.includes('/render/image/') ||      // Supabase Storage (optimized)
         url.includes('supabase.co/storage') || // Supabase Storage (direct)
         url.includes('sidearmdev.com') ||      // SideArm CDN
         url.includes('cloudfront.net') ||      // CloudFront CDN
         url.includes('/imgproxy/') ||          // School-hosted imgproxy
         url.includes('storage.googleapis.com') || // Google Cloud Storage
         (url.startsWith('http') &&            // External URLs with size params
          (url.includes('?width=') ||
           url.includes('&width=') ||
           url.includes('?height=') ||
           url.includes('&height=')));
}

console.log('\n=== TESTING BYPASS LOGIC FOR PROBLEMATIC TEAMS ===\n');

testUrls.forEach(({ team, url }) => {
  const willBypass = shouldBypassVercel(url);
  const method = willBypass ? '<img> tag' : 'Next.js Image';
  const status = willBypass ? '✅' : '❌';

  console.log(`${status} ${team.padEnd(15)} - ${method}`);
  console.log(`   ${url.substring(0, 90)}...`);

  // Show which pattern matched
  if (willBypass) {
    if (url.includes('/imgproxy/')) console.log('   Pattern: imgproxy');
    else if (url.includes('storage.googleapis.com')) console.log('   Pattern: Google Cloud');
    else if (url.includes('?width=') || url.includes('&width=')) console.log('   Pattern: size params');
    else console.log('   Pattern: other bypass');
  }
  console.log('');
});

console.log('ALL URLs should show ✅ and use <img> tag');
console.log('\nIf production images still fail, the issue is NOT the bypass logic.');
console.log('Possible causes:');
console.log('1. Browser cache - need hard refresh (Cmd+Shift+R)');
console.log('2. Hotlink protection despite referrerPolicy');
console.log('3. CORS issues');
console.log('4. Different URLs in production than in database');
