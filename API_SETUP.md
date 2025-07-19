# API Configuration for VaporRick AI Bot

# Copy this file to .env and add your API keys
# DO NOT commit .env to version control

# ================================
# MARKET DATA APIs
# ================================

# Twelve Data (Free tier: 800 requests/day) - RECOMMENDED for stocks
# Get your free API key at: https://twelvedata.com/pricing
TWELVE_DATA_API_KEY=your_twelve_data_key_here

# Alpha Vantage (Free tier: 25 requests/day)
# Get your free API key at: https://www.alphavantage.co/support/#api-key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here

# ================================
# NEWS & SENTIMENT APIs
# ================================

# NewsAPI (Free tier: 1000 requests/month)
# Get your free API key at: https://newsapi.org/register
NEWS_API_KEY=your_news_api_key_here

# ================================
# SOCIAL MEDIA APIs (Optional)
# ================================

# Twitter API v2 (Paid - for advanced social sentiment)
TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here

# Reddit API (Free with rate limits)
REDDIT_CLIENT_ID=your_reddit_client_id_here
REDDIT_CLIENT_SECRET=your_reddit_client_secret_here

# ================================
# FREE ALTERNATIVES USED WHEN NO KEYS
# ================================

# When API keys are not provided, the app will use:
# - CoinGecko API (free, no key required) for crypto data
# - Yahoo Finance API (free, no key required) for stock data  
# - RSS feeds for news (free, no key required)
# - Simulated social sentiment (free, no API required)

# ================================
# HOW TO SET UP
# ================================

# 1. Copy this file and rename to .env
# 2. Add your API keys above
# 3. Restart the application
# 4. The app will automatically detect and use real data sources

# ================================
# RECOMMENDED SETUP (FREE TIER)
# ================================

# For best results with free APIs:
# 1. Get Twelve Data key (800 requests/day - BEST for stocks)
# 2. Get Alpha Vantage key (25 requests/day - backup for stocks)
# 3. Get NewsAPI key (1000 requests/month - good for sentiment analysis)
# 4. Use CoinGecko (no key needed) for crypto data
# 5. Use Yahoo Finance (no key needed) as fallback

# This setup provides excellent real data coverage with generous free tiers!
