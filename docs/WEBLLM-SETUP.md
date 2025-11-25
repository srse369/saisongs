# WebLLM AI Search Setup Guide

## Overview

WebLLM enables **true natural language search** using a local AI model running entirely in your browser. No server or API keys needed!

## ⚠️ Important Requirements

### Browser Support
WebLLM requires **WebGPU** support:

✅ **Supported Browsers:**
- Chrome/Edge 113+ (Windows, Mac, Linux)
- Safari 17+ (macOS, iOS 17+)

❌ **Not Supported:**
- Firefox (WebGPU still experimental)
- Older browser versions

### System Requirements

**Minimum:**
- 4GB RAM
- Modern GPU (integrated or dedicated)
- ~150MB free disk space (for model cache)
- Stable internet connection (first download only)

**Recommended:**
- 8GB+ RAM
- Dedicated GPU
- 300MB+ free disk space

## 🚀 How to Use

### 1. Enable AI Search

1. Navigate to the **Songs** or **Pitches** tab
2. Click the **"AI Search OFF"** button
3. Wait for the model to download (~100-150MB, one-time only)
4. Progress bar shows download status
5. Once loaded, button turns to **"AI Search ON"** with green checkmark

### 2. Natural Language Queries

With AI enabled, type queries naturally:

```
"Show me all sai bhajans in sanskrit with slow tempo"
"I want devi songs that are simple level"
"Find songs in hamsadhwani raga"
"Give me fast tempo songs for beginners"
"Which singers have C# pitches?"
```

### 3. Ask AI Button

After typing, click **"Ask AI"** or press **Enter** to:
- Parse your natural language query
- Extract relevant filters automatically
- Apply them to your search

## 💡 Example Queries

### Song Searches
- `"sai songs in sanskrit"`
- `"fast tempo devi bhajans"`
- `"simple level songs with slow tempo"`
- `"show me all hamsadhwani raga songs"`
- `"krishna songs in hindi language"`

### Pitch Searches
- `"C# pitch for all singers"`
- `"devi songs sung in D#"`
- `"which pitches are available for sai songs"`

## 🔧 Technical Details

### Model Used
- **Qwen2-0.5B** - quantized to 4-bit (f16)
- Size: ~100-150MB (ultra-lightweight!)
- Optimized for instruction following and parsing
- Runs locally in browser via WebGPU
- Specifically chosen for speed, reliability, and small size

### Privacy
- ✅ 100% local processing
- ✅ No data sent to servers
- ✅ No API keys required
- ✅ Works offline after initial download

### Performance
- **First load**: 10-40 seconds (downloading model)
- **Subsequent loads**: 1-3 seconds (loading from cache)
- **Query processing**: 0.3-1.5 seconds per query
- **Memory usage**: ~500MB-1.5GB during operation

## 🎯 How It Works

1. **You type**: "Show me sai songs in sanskrit"
2. **AI parses**: 
   ```json
   {
     "deity": "sai",
     "language": "sanskrit"
   }
   ```
3. **System applies**: Filters automatically applied
4. **Results show**: Only matching songs

## 🔄 Fallback Modes

If AI search fails or is unavailable:

1. **Regular search** still works (text matching)
2. **Advanced search** filters remain available
3. **No data loss** - all search methods coexist

## ⚙️ Browser-Specific Setup

### Chrome/Edge
1. Update to version 113+
2. Ensure hardware acceleration is enabled:
   - Go to `chrome://settings/system`
   - Enable "Use hardware acceleration"
3. Enable WebGPU (usually enabled by default)

### Safari
1. Update to macOS Sonoma (14.0+) or iOS 17+
2. Update Safari to version 17+
3. WebGPU enabled by default

### Checking WebGPU Support
Visit: `https://webgpureport.org/`

## 🐛 Troubleshooting

### Common Error Messages

#### "WebGPU not available. Please use Chrome/Edge 113+ with hardware acceleration enabled."
**Solutions**:
1. **Update browser**: Ensure Chrome/Edge 113+ or Safari 17+
2. **Enable hardware acceleration**:
   - Chrome/Edge: `chrome://settings/system` → Enable "Use hardware acceleration"
   - Safari: Enabled by default
3. **Check GPU drivers**: Update your graphics drivers
4. **Verify WebGPU**: Visit https://webgpureport.org/

#### "Network error loading model. Check your internet connection and try again."
**Solutions**:
- Check your internet connection
- Try again when connection is stable
- If using VPN/proxy, try without it
- Check firewall isn't blocking model downloads

#### "Insufficient memory. Please close other tabs and try again."
**Solutions**:
- Close unused browser tabs
- Close other applications
- Restart your browser
- Upgrade RAM if issue persists (need 4GB+ available)

#### "Failed to load AI model: [other error]"
**General solutions**:
1. **Refresh the page** and try again
2. **Clear browser cache**:
   - Chrome/Edge: `chrome://settings/clearBrowserData`
   - Safari: Safari → Preferences → Privacy → Manage Website Data
3. **Check disk space**: Ensure 500MB+ free space
4. **Try incognito/private mode**: Rules out extension conflicts
5. **Update browser** to the latest version

### Model fails to load (no specific error)
**Debugging steps**:
1. Open browser console (F12)
2. Look for red error messages
3. Try disabling browser extensions
4. Check if other WebGPU apps work (visit https://webkit.org/demos/webgpu/)

### Query not understanding correctly
**Tips**:
- Be more specific: "sai songs" vs "sai"
- Use known keywords: deity names, languages, tempos
- Break complex queries into parts
- Use advanced search for very specific needs
- Try rephrasing your query

### Model loads but doesn't respond
**Solutions**:
- Wait 5-10 seconds (first query is slower)
- Check browser console for errors
- Try disabling and re-enabling AI search
- Restart browser if issue persists

## 🔒 Security & Privacy

- Model runs in browser sandbox
- No network calls after model download
- No telemetry or tracking
- Model cached in browser storage (IndexedDB)
- Can be cleared via browser settings

## 📊 Performance Optimization

### For Better Performance:
1. **Close unused tabs** - Frees GPU memory
2. **Use hardware acceleration** - Faster inference
3. **Wait for model cache** - First load is slower
4. **Restart browser periodically** - Clears memory leaks

### Disabling AI Search:
Click **"AI Search ON"** to disable and free resources.

## 🆚 AI Search vs Regular Search

| Feature | AI Search | Regular Search |
|---------|-----------|----------------|
| Natural language | ✅ Yes | ❌ Keywords only |
| Query understanding | ✅ Smart | ❌ Literal |
| Typo tolerance | ✅ Good | ⚠️ Limited |
| Setup required | ✅ 100-150MB download | ✅ Instant |
| Performance | ⚠️ 0.3-1.5s per query | ✅ Instant |
| Works offline | ✅ Yes | ✅ Yes |
| Browser support | ⚠️ Limited | ✅ All |

## 📱 Mobile Support

### iOS (Safari 17+)
- ✅ Supported on iPhone 12+ with iOS 17+
- ⚠️ Slower performance than desktop
- ⚠️ Higher battery usage

### Android
- ⚠️ Chrome 113+ with compatible GPU
- ⚠️ Performance varies by device
- ❌ Not recommended for older devices

## 🚫 When NOT to Use AI Search

Consider regular search if:
- Limited RAM (<4GB)
- Older device/browser
- Very slow internet connection
- Battery concerns (mobile)
- Need instant results (<1s)

## 🔮 Future Enhancements

Potential improvements:
- Smaller models (faster loading)
- Voice input
- Multi-turn conversations
- Query refinement suggestions
- Learning from corrections

## 📞 Support

If AI search isn't working:
1. Check browser version and WebGPU support
2. Try disabling/re-enabling AI search
3. Clear browser cache
4. Fall back to regular/advanced search
5. Check browser console for errors

## 🌟 Best Practices

1. **First time**: Wait for full model download before using
2. **Complex queries**: Break into simpler parts if AI misunderstands
3. **Verify results**: Check if filters match your intent
4. **Combine methods**: Use AI + Advanced filters for precision
5. **Provide feedback**: Note what works/doesn't for improvements

