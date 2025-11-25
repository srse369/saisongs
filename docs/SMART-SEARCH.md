# Smart Search Guide

## Overview

The Smart Search feature provides natural language search capabilities using **fuzzy matching** and **intelligent query parsing**. It works entirely **client-side** with no server requirements, making it perfect for small instances.

## Features

### 1. **Natural Language Queries**
Type queries as you would speak them:

```
"sai songs in sanskrit"
"fast tempo devi songs"
"C# pitch for singers"
"simple level hamsadhwani"
```

### 2. **Fuzzy Matching (Typo-Tolerant)**
Misspell words? No problem!

```
"hamsa" → finds "Hamsadhwani"
"devii" → finds "Devi"
"sanskirt" → finds "Sanskrit"
```

### 3. **Smart Keyword Detection**
Automatically recognizes:

- **Deities**: sai, devi, krishna, rama, shiva, ganesh, hanuman, durga, lakshmi, saraswati
- **Languages**: sanskrit, hindi, telugu, tamil, kannada, malayalam, bengali, marathi
- **Tempos**: slow, medium, fast (with synonyms: quick, rapid, slower)
- **Levels**: simple, easy, intermediate, advanced, difficult
- **Pitches**: C, C#, D, D#, E, F, F#, G, G#, A, A#, B

### 4. **Autocomplete Suggestions**
Get real-time suggestions based on:
- Available deities in your song collection
- Languages used
- Popular search patterns
- Ragas in your database

### 5. **Search Examples**
Click the **?** button in the search bar to see examples:
- `sai songs` - All songs for a deity
- `devi in sanskrit` - Deity + language filter
- `fast tempo` - By tempo
- `hamsadhwani raga` - By raga
- `simple level` - By difficulty
- `C# pitch` - Specific pitch

## How It Works

### Query Parsing
When you type a query, the system:

1. **Extracts keywords** from your query
2. **Applies filters** based on recognized patterns
3. **Performs fuzzy search** on remaining terms
4. **Ranks results** by relevance

### Example: "sai songs fast tempo"
1. Detects `sai` → filters by deity
2. Detects `fast` → filters by tempo
3. Excludes common words (`songs`)
4. Returns matching results

### Example: "devi in sanskrit"
1. Detects `devi` → filters by deity
2. Detects `sanskrit` → filters by language
3. Returns only songs matching both criteria

## Advanced Usage

### Combining Filters
Mix multiple criteria in one query:

```
"C# devi sanskrit"
→ Pitches in C#, for Devi, in Sanskrit

"simple sai slow"
→ Simple level, Sai songs, slow tempo

"hamsadhwani fast"
→ Hamsadhwani raga, fast tempo
```

### Synonyms
The system understands variations:

- **Tempo**: fast = quick = rapid
- **Level**: simple = easy = basic = beginner
- **Level**: advanced = difficult = hard = complex

### Fuzzy Tolerance
The fuzzy search threshold is set to 0.4, meaning:
- Exact matches: weight 2x
- 1-2 character differences: still matched
- 3+ character differences: may not match

## Performance

### Lightweight
- **Fuse.js**: Only ~14KB gzipped
- **Client-side**: No API calls
- **Fast**: Searches 1000+ songs instantly
- **No backend**: Works on smallest instances

### Optimized for Large Datasets
- Works with 5000+ pitches
- Uses debouncing (300ms) for typing
- Lazy loading for results
- Memoized for performance

## Tips

1. **Start simple**: Try single keywords first
2. **Be specific**: Use multiple keywords for precise results
3. **Use examples**: Click **?** to see what's possible
4. **Mix and match**: Combine different filter types
5. **Check suggestions**: Auto-complete shows popular queries

## Technical Details

### Libraries Used
- **Fuse.js**: Fuzzy search algorithm
- **React hooks**: useMemo for performance
- **TypeScript**: Type-safe queries

### Search Fields (Songs)
- Name (weight: 2.0)
- Title (weight: 1.5)
- Title2 (weight: 1.5)
- Deity (weight: 1.0)
- Language (weight: 1.0)
- Raga (weight: 1.0)
- Tempo (weight: 0.8)
- Beat (weight: 0.8)
- Level (weight: 0.8)

### Configuration
Located in `/src/utils/smartSearch.ts`:
- Adjust `threshold` (0-1) for fuzzy tolerance
- Add keywords for detection
- Modify weights for ranking
- Add synonyms for better matching

## Troubleshooting

**Q: Search is too broad?**
- Use more specific keywords
- Enable Advanced Search filters
- Combine multiple criteria

**Q: Not finding expected results?**
- Check spelling (but fuzzy search helps!)
- Try synonyms (fast vs quick)
- Use simpler queries

**Q: Suggestions not showing?**
- Type at least 2 characters
- Wait for debounce (300ms)
- Check if data is loaded

## Future Enhancements

Potential additions:
- Voice search
- Search history
- Saved searches
- More language support
- Custom keyword aliases


