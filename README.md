# Customizable Telegram Recurring Post Bot

A flexible Telegram bot that allows users to create and manage their own recurring posts with custom intervals (minutes, hours, or days).

## Features

- 🔄 **Fully Customizable**: Create your own recurring posts with custom messages
- ⏱️ **Flexible Scheduling**: Set posts to repeat every X minutes, hours, or days
- 🖼️ **Image Support**: Include images with your messages
- 🌐 **Web Interface**: Easy-to-use web UI for managing your templates
- ☁️ **Serverless**: Runs on Cloudflare Workers with no servers to maintain
- 🔄 **CI/CD**: Automatic deployment via GitHub Actions

## Setup Instructions

### Prerequisites

- Telegram Bot Token (get from [@BotFather](https://t.me/botfather))
- Cloudflare Account
- GitHub Account

### Step 1: Cloudflare Setup

1. **Create a KV namespace**
   ```bash
   wrangler kv:namespace create "BOT_TEMPLATES"
   ```
   Copy the ID from the output

2. **Update wrangler.toml**
   - Replace `YOUR_KV_NAMESPACE_ID` with the ID from step 1
   - Replace `YOUR_CHAT_ID_HERE` with your Telegram chat ID

### Step 2: Configure Bot Token

1. **Set up your bot token securely**
   ```bash
   wrangler secret put BOT_TOKEN
   ```
   Enter your Telegram bot token when prompted

### Step 3: Deploy

1. **Install Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Deploy the worker**
   ```bash
   wrangler publish
   ```

### Step 4: GitHub Actions Setup

1. **Add these secrets to your GitHub repository**:
   - `CF_API_TOKEN` (from Cloudflare)
   - `TELEGRAM_BOT_TOKEN` (your bot token)
   - `TELEGRAM_CHAT_ID` (your chat ID)

## Using the Bot

After deploying, visit your Cloudflare Worker URL to access the web interface:

```
https://telegram-recurring-post-bot.[your-worker-subdomain].workers.dev
```

From there, you can:

1. **Create new message templates**
   - Set the message content
   - Choose how often to post (minutes, hours, days)
   - Optionally include an image

2. **Manage existing templates**
   - View all your scheduled messages
   - Send messages immediately
   - Delete templates you no longer need

## Finding Your Chat ID

To find your Telegram chat ID:
1. Send a message to your bot
2. Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Look for the `"chat":{"id":123456789}` value

## Customization

You can customize the bot further by editing the HTML interface in the `generateHtmlInterface()` function.

## Troubleshooting

### Common Issues

1. **Messages not sending**
   - Verify your bot token and chat ID are correct
   - Check Cloudflare logs for errors

2. **KV storage issues**
   - Ensure you've created the KV namespace correctly
   - Check that the binding in wrangler.toml matches your code

For more help, check the Cloudflare Workers documentation or open an issue on GitHub.
