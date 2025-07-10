// Professional trading symbols list for 2025
// Selected based on market cap, liquidity, growth potential, and emerging trends

export interface Symbol {
  symbol: string;
  name: string;
  category: 'tech' | 'finance' | 'healthcare' | 'energy' | 'crypto' | 'defi' | 'gaming' | 'ai' | 'space' | 'ev' | 'blockchain';
  marketCap?: 'large' | 'mid' | 'small';
  isActive: boolean;
  priority: 'high' | 'medium' | 'low';
}

export const TOP_TRADING_SYMBOLS: Symbol[] = [
  // Large Cap Tech Giants
  { symbol: 'AAPL', name: 'Apple Inc.', category: 'tech', marketCap: 'large', isActive: true, priority: 'high' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', category: 'tech', marketCap: 'large', isActive: true, priority: 'high' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'tech', marketCap: 'large', isActive: true, priority: 'high' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', category: 'tech', marketCap: 'large', isActive: true, priority: 'high' },
  { symbol: 'META', name: 'Meta Platforms Inc.', category: 'tech', marketCap: 'large', isActive: true, priority: 'high' },
  { symbol: 'TSLA', name: 'Tesla Inc.', category: 'ev', marketCap: 'large', isActive: true, priority: 'high' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', category: 'ai', marketCap: 'large', isActive: true, priority: 'high' },
  { symbol: 'NFLX', name: 'Netflix Inc.', category: 'tech', marketCap: 'large', isActive: true, priority: 'high' },

  // AI & Semiconductor Revolution
  { symbol: 'AMD', name: 'Advanced Micro Devices', category: 'ai', marketCap: 'large', isActive: true, priority: 'high' },
  { symbol: 'INTC', name: 'Intel Corporation', category: 'ai', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'QCOM', name: 'Qualcomm Inc.', category: 'ai', marketCap: 'large', isActive: true, priority: 'high' },
  { symbol: 'CRM', name: 'Salesforce Inc.', category: 'ai', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'ADBE', name: 'Adobe Inc.', category: 'ai', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'NOW', name: 'ServiceNow Inc.', category: 'ai', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'PLTR', name: 'Palantir Technologies', category: 'ai', marketCap: 'mid', isActive: true, priority: 'high' },

  // Electric Vehicles & Clean Energy
  { symbol: 'NIO', name: 'NIO Inc.', category: 'ev', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'XPEV', name: 'XPeng Inc.', category: 'ev', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'LI', name: 'Li Auto Inc.', category: 'ev', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'RIVN', name: 'Rivian Automotive', category: 'ev', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'LCID', name: 'Lucid Group Inc.', category: 'ev', marketCap: 'mid', isActive: true, priority: 'low' },
  { symbol: 'ENPH', name: 'Enphase Energy', category: 'energy', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'SEDG', name: 'SolarEdge Technologies', category: 'energy', marketCap: 'mid', isActive: true, priority: 'medium' },

  // Fintech & Digital Payments
  { symbol: 'PYPL', name: 'PayPal Holdings', category: 'finance', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'SQ', name: 'Block Inc.', category: 'finance', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'HOOD', name: 'Robinhood Markets', category: 'finance', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'COIN', name: 'Coinbase Global', category: 'crypto', marketCap: 'mid', isActive: true, priority: 'high' },
  { symbol: 'SOFI', name: 'SoFi Technologies', category: 'finance', marketCap: 'mid', isActive: true, priority: 'medium' },

  // Gaming & Metaverse
  { symbol: 'RBLX', name: 'Roblox Corporation', category: 'gaming', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'U', name: 'Unity Software', category: 'gaming', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'TTWO', name: 'Take-Two Interactive', category: 'gaming', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'EA', name: 'Electronic Arts', category: 'gaming', marketCap: 'large', isActive: true, priority: 'medium' },

  // Space & Defense
  { symbol: 'SPCE', name: 'Virgin Galactic', category: 'space', marketCap: 'small', isActive: true, priority: 'low' },
  { symbol: 'RKLB', name: 'Rocket Lab USA', category: 'space', marketCap: 'small', isActive: true, priority: 'low' },
  { symbol: 'LMT', name: 'Lockheed Martin', category: 'space', marketCap: 'large', isActive: true, priority: 'medium' },

  // Healthcare & Biotech
  { symbol: 'JNJ', name: 'Johnson & Johnson', category: 'healthcare', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'PFE', name: 'Pfizer Inc.', category: 'healthcare', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'MRNA', name: 'Moderna Inc.', category: 'healthcare', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'BNTX', name: 'BioNTech SE', category: 'healthcare', marketCap: 'mid', isActive: true, priority: 'medium' },

  // Cryptocurrencies - Major
  { symbol: 'BTC', name: 'Bitcoin', category: 'crypto', isActive: true, priority: 'high' },
  { symbol: 'ETH', name: 'Ethereum', category: 'crypto', isActive: true, priority: 'high' },
  { symbol: 'BNB', name: 'Binance Coin', category: 'crypto', isActive: true, priority: 'high' },
  { symbol: 'SOL', name: 'Solana', category: 'blockchain', isActive: true, priority: 'high' },
  { symbol: 'ADA', name: 'Cardano', category: 'blockchain', isActive: true, priority: 'medium' },
  { symbol: 'AVAX', name: 'Avalanche', category: 'blockchain', isActive: true, priority: 'high' },
  { symbol: 'DOT', name: 'Polkadot', category: 'blockchain', isActive: true, priority: 'medium' },
  { symbol: 'MATIC', name: 'Polygon', category: 'blockchain', isActive: true, priority: 'high' },
  { symbol: 'LINK', name: 'Chainlink', category: 'defi', isActive: true, priority: 'high' },
  { symbol: 'UNI', name: 'Uniswap', category: 'defi', isActive: true, priority: 'medium' },

  // Layer 1 Blockchains - Next Generation
  { symbol: 'ATOM', name: 'Cosmos', category: 'blockchain', isActive: true, priority: 'medium' },
  { symbol: 'NEAR', name: 'NEAR Protocol', category: 'blockchain', isActive: true, priority: 'medium' },
  { symbol: 'FTM', name: 'Fantom', category: 'blockchain', isActive: true, priority: 'medium' },
  { symbol: 'ALGO', name: 'Algorand', category: 'blockchain', isActive: true, priority: 'medium' },
  { symbol: 'FLOW', name: 'Flow', category: 'blockchain', isActive: true, priority: 'low' },
  { symbol: 'ICP', name: 'Internet Computer', category: 'blockchain', isActive: true, priority: 'medium' },
  { symbol: 'EGLD', name: 'MultiversX', category: 'blockchain', isActive: true, priority: 'medium' },

  // DeFi Protocols
  { symbol: 'AAVE', name: 'Aave', category: 'defi', isActive: true, priority: 'high' },
  { symbol: 'COMP', name: 'Compound', category: 'defi', isActive: true, priority: 'medium' },
  { symbol: 'MKR', name: 'Maker', category: 'defi', isActive: true, priority: 'medium' },
  { symbol: 'CRV', name: 'Curve DAO', category: 'defi', isActive: true, priority: 'medium' },
  { symbol: 'YFI', name: 'yearn.finance', category: 'defi', isActive: true, priority: 'medium' },
  { symbol: 'SUSHI', name: 'SushiSwap', category: 'defi', isActive: true, priority: 'low' },

  // Gaming & NFT Tokens
  { symbol: 'AXS', name: 'Axie Infinity', category: 'gaming', isActive: true, priority: 'medium' },
  { symbol: 'SAND', name: 'The Sandbox', category: 'gaming', isActive: true, priority: 'medium' },
  { symbol: 'MANA', name: 'Decentraland', category: 'gaming', isActive: true, priority: 'medium' },
  { symbol: 'ENJ', name: 'Enjin Coin', category: 'gaming', isActive: true, priority: 'low' },
  { symbol: 'CHZ', name: 'Chiliz', category: 'gaming', isActive: true, priority: 'low' },

  // Infrastructure & Oracles
  { symbol: 'FIL', name: 'Filecoin', category: 'blockchain', isActive: true, priority: 'medium' },
  { symbol: 'AR', name: 'Arweave', category: 'blockchain', isActive: true, priority: 'medium' },
  { symbol: 'GRT', name: 'The Graph', category: 'defi', isActive: true, priority: 'medium' },
  { symbol: 'BAND', name: 'Band Protocol', category: 'defi', isActive: true, priority: 'low' },

  // Meme Coins with Utility (High Risk)
  { symbol: 'DOGE', name: 'Dogecoin', category: 'crypto', isActive: true, priority: 'low' },
  { symbol: 'SHIB', name: 'Shiba Inu', category: 'crypto', isActive: true, priority: 'low' },

  // Emerging Trends 2025
  { symbol: 'APT', name: 'Aptos', category: 'blockchain', isActive: true, priority: 'high' },
  { symbol: 'SUI', name: 'Sui', category: 'blockchain', isActive: true, priority: 'high' },
  { symbol: 'ARB', name: 'Arbitrum', category: 'blockchain', isActive: true, priority: 'high' },
  { symbol: 'OP', name: 'Optimism', category: 'blockchain', isActive: true, priority: 'high' },
  { symbol: 'IMX', name: 'Immutable X', category: 'gaming', isActive: true, priority: 'medium' },
  { symbol: 'LDO', name: 'Lido DAO', category: 'defi', isActive: true, priority: 'medium' },
  { symbol: 'RPL', name: 'Rocket Pool', category: 'defi', isActive: true, priority: 'medium' },

  // Traditional Finance Integration
  { symbol: 'JPM', name: 'JPMorgan Chase', category: 'finance', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'BAC', name: 'Bank of America', category: 'finance', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'GS', name: 'Goldman Sachs', category: 'finance', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'V', name: 'Visa Inc.', category: 'finance', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'MA', name: 'Mastercard Inc.', category: 'finance', marketCap: 'large', isActive: true, priority: 'medium' },

  // Additional High-Volume Stocks
  { symbol: 'ORCL', name: 'Oracle Corporation', category: 'tech', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'CRM', name: 'Salesforce Inc.', category: 'tech', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'UBER', name: 'Uber Technologies', category: 'tech', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'LYFT', name: 'Lyft Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'low' },
  { symbol: 'SNOW', name: 'Snowflake Inc.', category: 'tech', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'DDOG', name: 'Datadog Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'ZM', name: 'Zoom Video', category: 'tech', marketCap: 'mid', isActive: true, priority: 'low' },
  { symbol: 'SHOP', name: 'Shopify Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'SPOT', name: 'Spotify Technology', category: 'tech', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'TWTR', name: 'Twitter Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'low' },
  { symbol: 'SNAP', name: 'Snap Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'low' },
  { symbol: 'PINS', name: 'Pinterest Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'low' },
  { symbol: 'ROKU', name: 'Roku Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'low' },
  { symbol: 'DOCU', name: 'DocuSign Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'low' },
  { symbol: 'ZS', name: 'Zscaler Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'OKTA', name: 'Okta Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'TWLO', name: 'Twilio Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'low' },
  { symbol: 'SPLK', name: 'Splunk Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'WDAY', name: 'Workday Inc.', category: 'tech', marketCap: 'large', isActive: true, priority: 'medium' },
  { symbol: 'VEEV', name: 'Veeva Systems', category: 'tech', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'NET', name: 'Cloudflare Inc.', category: 'tech', marketCap: 'mid', isActive: true, priority: 'medium' },
  { symbol: 'FSLY', name: 'Fastly Inc.', category: 'tech', marketCap: 'small', isActive: true, priority: 'low' },

  // Additional Emerging Crypto Assets
  { symbol: 'INJ', name: 'Injective Protocol', category: 'defi', isActive: true, priority: 'medium' },
  { symbol: 'SEI', name: 'Sei', category: 'blockchain', isActive: true, priority: 'medium' },
  { symbol: 'TIA', name: 'Celestia', category: 'blockchain', isActive: true, priority: 'medium' },
  { symbol: 'BLUR', name: 'Blur', category: 'defi', isActive: true, priority: 'medium' },
  { symbol: 'PEPE', name: 'Pepe', category: 'crypto', isActive: true, priority: 'low' },
  { symbol: 'WLD', name: 'Worldcoin', category: 'ai', isActive: true, priority: 'medium' },
  { symbol: 'FET', name: 'Fetch.ai', category: 'ai', isActive: true, priority: 'medium' },
  { symbol: 'AGIX', name: 'SingularityNET', category: 'ai', isActive: true, priority: 'medium' },
  { symbol: 'OCEAN', name: 'Ocean Protocol', category: 'ai', isActive: true, priority: 'medium' },
  { symbol: 'RLC', name: 'iExec RLC', category: 'ai', isActive: true, priority: 'low' },
];

// Filter functions for different strategies
export const getHighPrioritySymbols = (): Symbol[] => {
  return TOP_TRADING_SYMBOLS.filter(s => s.priority === 'high' && s.isActive);
};

export const getSymbolsByCategory = (category: string): Symbol[] => {
  return TOP_TRADING_SYMBOLS.filter(s => s.category === category && s.isActive);
};

export const getCryptoSymbols = (): Symbol[] => {
  return TOP_TRADING_SYMBOLS.filter(s => 
    ['crypto', 'defi', 'blockchain', 'gaming'].includes(s.category) && s.isActive
  );
};

export const getStockSymbols = (): Symbol[] => {
  return TOP_TRADING_SYMBOLS.filter(s => 
    ['tech', 'finance', 'healthcare', 'energy', 'ai', 'space', 'ev'].includes(s.category) && s.isActive
  );
};

export const getSymbolsForAutoTrading = (): Symbol[] => {
  // Return high-priority symbols with good liquidity for automated trading
  return TOP_TRADING_SYMBOLS.filter(s => 
    s.priority === 'high' && s.isActive && 
    (s.marketCap === 'large' || ['crypto', 'blockchain', 'defi'].includes(s.category))
  );
};

export default TOP_TRADING_SYMBOLS;
