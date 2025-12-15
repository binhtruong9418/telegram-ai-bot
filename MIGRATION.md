# Migration Guide: Gemini to YesScale AI

This document outlines the changes made to migrate from Google Gemini AI to YesScale AI.

## Overview

YesScale AI is an OpenAI-compatible API service that provides access to multiple AI models (GPT-4, Claude, Gemini, DeepSeek, etc.) without requiring VPN and at competitive pricing.

## Key Benefits of YesScale AI

✅ **No VPN Required**: Direct global access without restrictions  
✅ **Multiple Models**: Access GPT-4o, Claude 3, Gemini, DeepSeek, and more with one API key  
✅ **Cost-Effective**: Lower pricing than official APIs  
✅ **Fast & Reliable**: Faster than official APIs with 99.99% uptime  
✅ **OpenAI Compatible**: Easy integration with existing OpenAI-based code  
✅ **No Account Risk**: No suspension or proxy requirements

## What Changed

### 1. Dependencies

- **Removed**: `@google/generative-ai` (Gemini SDK)
- **No new dependencies**: Uses native `fetch` API (Node.js 18+)

### 2. Configuration Files

- **Created**: `src/config/yescale.config.ts`
- **Replaced**: `src/config/gemini.config.ts` (can be removed)

### 3. Service Files

- **Created**: `src/services/yescale.service.ts`
- **Replaced**: `src/services/gemini.service.ts` (can be removed)

### 4. Environment Variables

#### Old (.env):

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_TEXT_MODEL=gemini-pro
GEMINI_VISION_MODEL=gemini-pro-vision
GEMINI_TEMPERATURE=0.7
GEMINI_MAX_TOKENS=2048
GEMINI_TOP_K=40
GEMINI_TOP_P=0.95
```

#### New (.env):

```env
YESCALE_API_KEY=your_yescale_api_key
YESCALE_BASE_URL=https://api.yescale.io/v1
YESCALE_TEXT_MODEL=gpt-4o
YESCALE_VISION_MODEL=gpt-4o
YESCALE_TEMPERATURE=0.7
YESCALE_MAX_TOKENS=2048
YESCALE_TOP_P=0.95
YESCALE_TIMEOUT=60000
```

### 5. Available Models

You can use any of these models with YesScale:

**Text & Vision Models:**

- `gpt-4o` (recommended - latest GPT-4 with vision)
- `gpt-4-turbo`
- `gpt-4`
- `gpt-3.5-turbo`
- `claude-3-opus`
- `claude-3-sonnet`
- `claude-3-haiku`
- `gemini-2.5-flash`
- `gemini-pro`
- `gemini-pro-vision`
- `deepseek-chat`
- And many more...

Check the full list at: https://im06lq19wz.apifox.cn/

## Migration Steps

### Step 1: Get YesScale API Key

1. Visit [yescale.io](https://yescale.io/)
2. Register for an account (get $1 free credit)
3. Go to Dashboard → API Keys
4. Create a new API key
5. Choose the appropriate token group:
    - `openai` - for GPT models (ratio: 1x)
    - `claude` - for Claude models (ratio: 1.75x)
    - `gemini` - for Gemini models (ratio: 1x)
    - `deepseek` - for DeepSeek models (ratio: 1x)

### Step 2: Update Environment Variables

1. Copy `.env.example` to `.env` if you haven't already
2. Update your `.env` file:

    ```env
    # Replace GEMINI_API_KEY with:
    YESCALE_API_KEY=sk-your-yescale-api-key-here

    # Update model names (recommended):
    YESCALE_TEXT_MODEL=gpt-4o
    YESCALE_VISION_MODEL=gpt-4o

    # Or keep using Gemini models through YesScale:
    # YESCALE_TEXT_MODEL=gemini-2.5-flash
    # YESCALE_VISION_MODEL=gemini-2.5-flash
    ```

### Step 3: Install Dependencies

```bash
# Remove old Gemini dependency
npm uninstall @google/generative-ai

# Install/update dependencies (no new packages needed!)
npm install
```

### Step 4: Build and Run

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## Feature Comparison

| Feature                  | Gemini SDK             | YesScale AI                    |
| ------------------------ | ---------------------- | ------------------------------ |
| **Text Generation**      | ✅                     | ✅                             |
| **Image Analysis**       | ✅                     | ✅                             |
| **File Attachments**     | ✅                     | ✅                             |
| **Streaming**            | ✅                     | ✅                             |
| **Conversation History** | ✅                     | ✅                             |
| **Multiple Models**      | ❌ (Gemini only)       | ✅ (GPT, Claude, Gemini, etc.) |
| **Global Access**        | ❌ (VPN may be needed) | ✅ (No VPN required)           |
| **Cost**                 | Standard pricing       | Competitive pricing            |

## API Format Changes

### Request Format

**Old (Gemini):**

```typescript
const result = await model.generateContent({
    contents: [
        {
            role: "user",
            parts: [{ text: "Hello" }],
        },
    ],
});
```

**New (YesScale - OpenAI format):**

```typescript
const response = await fetch("https://api.yescale.io/v1/chat/completions", {
    method: "POST",
    headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
    }),
});
```

### Vision/Image Analysis

**Old (Gemini):**

```typescript
const result = await visionModel.generateContent([
    { text: "Describe this image" },
    {
        inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
        },
    },
]);
```

**New (YesScale):**

```typescript
const response = await fetch("https://api.yescale.io/v1/chat/completions", {
    method: "POST",
    headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: "Describe this image" },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`,
                        },
                    },
                ],
            },
        ],
    }),
});
```

## Code Changes Summary

All handler files have been updated to use the new YesScale service:

- `src/bot/handlers/text.handler.ts` - Text message handling
- `src/bot/handlers/photo.handler.ts` - Photo handling
- `src/bot/handlers/image.handler.ts` - Image analysis
- `src/bot/handlers/document.handler.ts` - Document handling

The service interface remains the same, so no changes to handler logic were needed!

## Troubleshooting

### API Key Issues

- Ensure your API key starts with `sk-`
- Check that you have sufficient balance
- Verify the token group matches your model choice

### Model Not Found

- Check the model name spelling
- Ensure your token group supports the model
- See available models at: https://im06lq19wz.apifox.cn/

### Connection Issues

- YesScale doesn't require VPN
- Check API status: https://status.yescale.io/status/global
- Verify your firewall allows outbound HTTPS connections

### Rate Limiting

- YesScale has different rate limits per plan
- Check your dashboard for current limits
- Consider upgrading if you hit limits frequently

## Support

- **YesScale Documentation**: https://im06lq19wz.apifox.cn/
- **YesScale Status**: https://status.yescale.io/status/global
- **YesScale Telegram**: https://t.me/yescaleai
- **Bot Issues**: Check `logs/error.log`

## Additional Resources

- [YesScale API Documentation](https://im06lq19wz.apifox.cn/)
- [Supported Models List](https://im06lq19wz.apifox.cn/doc-6031870)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference) (compatible format)

---

**Note**: Old Gemini configuration files are kept for reference but are no longer used. You can safely delete:

- `src/config/gemini.config.ts`
- `src/services/gemini.service.ts`
