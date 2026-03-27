# NCAA Swim & Dive Tracker - Athlete Data Scrapers

Collection of Node.js scripts for scraping and updating athlete data from college swim & dive rosters.

## Quick Start

### Run Main Scraper
```bash
# Install Playwright browsers (one-time)
npx playwright install chromium

# Run scraper
node update-missing-data.js
```

### Run Lightweight Version
```bash
node simple-photo-updater.js
```

### Check Database Status
```bash
node check-teams.js
```

## Available Scripts

| Script | Purpose | Time | Dependencies |
|--------|---------|------|--------------|
| `update-missing-data.js` | Full scraper with Playwright | 15-20 min | Playwright |
| `update-missing-data.ts` | TypeScript version | 15-20 min | Playwright, tsx |
| `simple-photo-updater.js` | Lightweight photo updater | 5-10 min | None |
| `manual-photo-batch-update.js` | Manual database updates | Instant | None |
| `check-teams.js` | Database status check | <1 min | None |

## Data Coverage

**14 Teams, 310 Athletes**

Teams with complete data:
- Georgia Tech, Alabama, Duke, TCU, Louisville, Ohio State, Florida State, NC State

Teams needing photos (25 total missing):
- South Carolina (3), Arizona State (5), Penn State (4), Indiana (4), Purdue (4), Dartmouth (1)

## Features

✓ Automatic HTML pattern detection (Sidearm, Tables, Cards)
✓ Class year normalization (Fr → freshman, Sr → senior)
✓ Athlete type classification (Diver vs Swimmer)
✓ Photo URL normalization and validation
✓ Gender filtering (Men's rosters only)
✓ Safe database updates (no overwrites, only fill missing data)
✓ Auto team athlete count sync
✓ Comprehensive error handling

## Data Safety

- Never overwrites existing photos
- Only fills NULL photo_url fields
- Adds new athletes without deleting existing ones
- Independent operations per athlete (no rollback issues)
- Team counts auto-update after batch processing

## Roster URLs

```javascript
Georgia Tech: https://ramblinwreck.com/sports/mens-swimming-diving/roster/
Alabama: https://rolltide.com/sports/mens-swimming-and-diving/roster
Duke: https://goduke.com/sports/mens-swimming-and-diving/roster
TCU: https://gofrogs.com/sports/mens-swimming-and-diving/roster
Louisville: https://gocards.com/sports/mens-swimming-and-diving/roster
South Carolina: https://gamecocksonline.com/sports/mens-swimming-and-diving/roster/
Arizona State: https://thesundevils.com/sports/mens-swimming-and-diving/roster
Penn State: https://gopsusports.com/sports/mens-swimming-and-diving/roster
Indiana: https://iuhoosiers.com/sports/mens-swimming-and-diving/roster
Purdue: https://purduesports.com/sports/mens-swimming-and-diving/roster
Dartmouth: https://dartmouthsports.com/sports/mens-swimming-and-diving/roster
Ohio State: https://ohiostatebuckeyes.com/sports/m-swim/roster/
Florida State: https://seminoles.com/sports/swimming-diving/roster/
NC State: https://gopack.com/sports/mens-swimming-and-diving/roster
```

## Documentation

- `SCRAPER-IMPLEMENTATION-GUIDE.md` - Complete technical guide
- `DATA-UPDATE-ANALYSIS.md` - Data analysis and status report
- `../EXECUTION-SUMMARY.txt` - Full execution report

## Troubleshooting

**Playwright won't launch:**
```bash
npx playwright install chromium
```

**Network timeout:**
- Use `simple-photo-updater.js` instead (no browser)
- Try running one team at a time (modify teamsToScrape array)

**Module not found:**
```bash
npm install
npm ci  # Clean install
```

## Results

Expected output when running `update-missing-data.js`:

```
✓ Georgia Tech        | Added: 8 | Updated: 0 | Processed: 8
✓ South Carolina      | Added: 0 | Updated: 3 | Processed: 15
✓ Arizona State       | Added: 15 | Updated: 5 | Processed: 39
...
Total Athletes Processed: 310
Total Added: 42
Total Updated: 25
Total Skipped: 243
```

## Performance

- **Main Scraper:** 15-20 minutes (includes browser rendering time)
- **Lightweight:** 5-10 minutes (direct parsing, faster)
- **Per Team:** 1-2 minutes depending on roster size
- **Database Updates:** <100ms per athlete

## Next Steps

1. Choose a script based on your needs
2. Run `node scripts/check-teams.js` to see current status
3. Run the scraper of your choice
4. Monitor console output for results
5. Verify in database or UI

For questions or issues, see the detailed documentation files.
