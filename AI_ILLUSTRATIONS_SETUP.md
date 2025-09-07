# AI Illustrations Setup Guide

## Quick Setup

Your AI illustrations feature is implemented and ready to use! Here's how to enable it:

### Method 1: Browser Console (Fastest)

1. **Open the Koodo Reader app** in your browser (http://localhost:3000)
2. **Open browser console** (F12 or right-click → Inspect → Console)
3. **Copy and paste** the contents of `enable-ai-illustrations.js` into the console
4. **Press Enter** to run the script
5. **Reload the page** and open a book

### Method 2: Settings UI (Recommended)

1. **Open a book** in Koodo Reader
2. **Click the settings icon** (gear icon) in the reader interface
3. **Scroll down** to find the "AI Illustrations" section
4. **Enter your API key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtcmZlZGtvdkBnbWFpbC5jb20iLCJpYXQiOjE3Mzk0NTg2MTh9.M_42ijlTQmEPkprxul3hZc6VwNrj1D_t2PVTtu3yKXM`
5. **Click "Save"** to store the API key
6. **Toggle "Enable AI illustrations"** to ON
7. **Start reading** - illustrations will appear on every second page

## How It Works

- **Automatic Generation**: AI illustrations are generated automatically as you read
- **Every Second Page**: By default, illustrations appear on every second page (configurable)
- **Contextual**: Each illustration is based on the text content of that specific page
- **Cached**: Generated illustrations are cached for faster loading on subsequent visits
- **Non-intrusive**: Original book content remains unchanged

## Settings Options

- **Enable/Disable**: Toggle the feature on/off
- **Frequency**: Every page, every second page, or every third page
- **Image Quality**: Standard or High
- **Cache Size**: How much storage to use for cached illustrations (10-1000 MB)
- **Notifications**: Show/hide error notifications

## Troubleshooting

### No illustrations appearing?
1. Check that the feature is enabled in settings
2. Verify your API key is set correctly
3. Make sure you're on an eligible page (every second page by default)
4. Check browser console for any error messages

### API key issues?
- Make sure you copied the full API key without extra spaces
- Verify your Hyperbolic account has sufficient credits
- Check that the API key hasn't expired

### Performance issues?
- Reduce cache size in settings
- Change frequency to "every third page"
- Switch image quality to "standard"

## Technical Details

- **AI Provider**: Hyperbolic (https://hyperbolic.xyz)
- **Text Model**: openai/gpt-oss-20b (for generating image prompts)
- **Image Model**: FLUX.1-dev (for generating illustrations)
- **Storage**: IndexedDB for persistent caching, memory cache for active session
- **Security**: API keys stored securely in OS credential store

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Try disabling and re-enabling the feature
3. Clear the illustration cache in settings
4. Restart the application

The feature is fully implemented and should work seamlessly once enabled!