# Beaverton Sai Bhajans Import Utility

## Overview

A comprehensive utility for importing singer and pitch data from the Beaverton Sai Bhajans database (https://sycois.wixsite.com/beavertonsaibhajans) into Song Studio.

## Features

1. **Singer Import**: Automatically creates new singer records for singers that don't exist in your database
2. **Pitch Mapping**: Normalizes pitch formats from Beaverton format (4m, 1M, 6.5m, etc.) to standard notation (C, D, E, F, G, A, B, C#, etc.)
3. **Fuzzy Song Matching**: Uses 90% similarity threshold to automatically match songs
4. **Manual Override**: Allows manual song name entry when automatic matching fails
5. **Custom Pitch Mapping**: Allows you to define mappings for unrecognized pitch formats
6. **Preview & Confirmation**: Shows a complete preview before committing any data
7. **Conflict Resolution**: Updates existing pitch records automatically
8. **Incremental Import**: Designed for multiple import sessions, not just one-time bulk import

## How to Use

### Access the Tool

1. Log in as admin (use Ctrl+Shift+I or Cmd+Shift+I shortcut)
2. Navigate to Home page
3. Click on "Import from Beaverton" card (green card)
4. Or go directly to: `/admin/import-beaverton`

### Import Process

#### Step 1: Preparation
- Click "Start Scraping" button
- Read the instructions carefully

#### Step 2: Data Collection
Since automated scraping requires manual interaction with the website:

1. Open https://sycois.wixsite.com/beavertonsaibhajans in another tab
2. Enable the "IGNORE UPPER TABLE FILTERS" checkbox on the website
3. In the "Search Singer Here" box:
   - Enter 'A' and note down all singers and their data
   - Enter 'B' and note down all singers and their data
   - Continue through Z
4. The data is in table format: Singer Name | Pitch | Song Name | Deity | Language
5. Copy the table data and paste into the textarea in Song Studio
   - Format: Tab-separated values (TSV)
   - Example: `Ameya	4m	Raghu Pathey Raaghava Raja Rama	Ram	Sanskrit`

#### Step 3: Preview
After pasting data:
- Click "Process Data" button
- Review the preview table showing:
  - ✅ **Ready**: Items ready to import (song matched, pitch recognized)
  - ⚠️ **Song**: Items needing manual song matching
  - ⚠️ **Pitch**: Items needing pitch format mapping

#### Step 4: Resolve Issues

**For Unmatched Songs:**
1. Click "Set Song" button
2. Enter the EXACT song name from your database
3. Click ✓ to confirm

**For Unrecognized Pitches:**
1. Click "Map Pitch" button
2. Enter the normalized pitch (C, D, E, F, G, A, B, C#, D#, F#, G#, A#)
3. Click ✓ to confirm
4. This mapping will be saved for future imports

#### Step 5: Import
- Review the counts:
  - Ready to Import
  - Need Song Match
  - Need Pitch Mapping
- Click "Import X Items" button
- Wait for completion

#### Step 6: Results
- View statistics:
  - Singers Created
  - Pitches Created
  - Pitches Updated
  - Any errors encountered
- Click "Import More Data" to start another import session

## Pitch Format Mappings

### Supported Formats

The utility automatically recognizes and converts:

| Beaverton Format | Normalized | Notes |
|-----------------|------------|-------|
| 1, 1M, 1Madhyam, 1m | C | Basic C |
| 2, 2M, 2Madhyam, 2m | D | Basic D |
| 3, 3M, 3Madhyam, 3m | E | Basic E |
| 4, 4M, 4Madhyam, 4m | F | Basic F |
| 5, 5M, 5Madhyam, 5m | G | Basic G |
| 6, 6M, 6Madhyam, 6m | A | Basic A |
| 7, 7M, 7Madhyam, 7m | B | Basic B |
| 1.5m, 1.5M, 1.5Madhyam | C# | C Sharp |
| 2.5m, 2.5M, 2.5Madhyam | D# | D Sharp |
| 4.5m, 4.5M, 4.5Madhyam | F# | F Sharp |
| 5.5m, 5.5M, 5.5Madhyam | G# | G Sharp |
| 6.5m, 6.5M, 6.5Madhyam | A# | A Sharp |

### Custom Mappings

If you encounter an unrecognized format:
1. The system will prompt you to provide the mapping
2. Enter the standard notation
3. The mapping is saved and will be used for all future imports

## Song Matching

### Automatic Matching
- Uses 90% similarity threshold
- Ignores case and common prefixes (Sri, Shri, Jai, Jaya, Om, Hey, He)
- Removes special characters for better matching

### Match Types
- **Exact (100%)**: Perfect match, shown in green
- **Fuzzy (90-99%)**: Close match, shown with similarity percentage in yellow
- **Manual**: User-provided match, shown with "(Manual)" indicator
- **None**: No match found, requires manual input

### Manual Song Entry
When entering song names manually:
1. Use the EXACT name as it appears in your Song Studio database
2. The system will validate the name exists
3. If not found, you'll get an error message
4. Check your Songs list to find the correct spelling

## Database Operations

### What Gets Created/Updated

**New Singer Records:**
- Created automatically for singers not in your database
- Uses the exact name from Beaverton

**New Pitch Records:**
- Links: Singer ID + Song ID + Pitch value
- Includes note: "Imported from Beaverton (Original Song Name)"

**Updated Pitch Records:**
- If a singer already has a pitch for a song, it gets updated
- Previous pitch value is replaced with the new one

## File Structure

```
src/
├── services/
│   ├── BeavertonScraperService.ts     # Parsing and scraping logic
│   └── BeavertonImportService.ts       # Database import operations
├── utils/
│   ├── pitchNormalization.ts           # Pitch format conversion
│   └── songMatcher.ts                  # Fuzzy song matching
├── components/
│   └── admin/
│       └── BeavertonImportManager.tsx  # Main UI component
└── App.tsx                             # Route configuration
```

## Tips & Best Practices

1. **Start Small**: Test with a few letters (A-C) first to understand the workflow
2. **Check Song Names**: Have your Songs list open in another tab for reference
3. **Batch Processing**: Process one letter at a time if the dataset is large
4. **Review Before Import**: Always check the preview table carefully
5. **Note Original Names**: The original Beaverton song name is stored in the pitch notes for reference
6. **Incremental Updates**: You can run the import multiple times; existing pitches will be updated

## Troubleshooting

### Songs Not Matching
- Check for spelling differences
- Look for extra spaces or special characters
- Try searching your song database first
- Use the exact name from Song Studio

### Pitch Format Not Recognized
- Check if it's a valid pitch format
- Use only: C, D, E, F, G, A, B with optional # for sharps
- Double-check the original Beaverton format
- Create the mapping once, it'll work for all future imports

### Import Errors
- Check the error messages in the results section
- Verify all singers have names
- Ensure all songs are matched
- Make sure all pitches are normalized

## Future Enhancements

Potential improvements for future versions:
- Automated browser scraping (currently manual)
- Bulk pitch format mapping UI
- Export unmatched songs to CSV
- Import history and audit log
- Batch undo for recent imports
- Support for pitch ranges (e.g., "4-6m")

## Support

For issues or questions:
1. Check this documentation
2. Review the error messages in the UI
3. Check the browser console for detailed errors
4. Ensure you're logged in as admin

