# Helix

Hyperliquid execution desk for a New York session price-action strategy. You chart support and resistance each morning. The bot watches 5-minute candles during the cash session for a break, a pullback, and an engulfing continuation.

## Daily workflow

1. Chart your levels as you already do.
2. Enter them on **Levels** (resistance / support + price, per market).
3. Start the engine on the **Desk** when you want it armed. It will not take entries before 09:30 America/New_York.
4. During the NY session it only trades those levels. Stop sits beyond the pullback; target is 2R or the next level.
5. It flattens at 16:00 ET by default. Kill switch is on the desk.

Paper mode is the default. No Hyperliquid orders are sent until you add an agent wallet and switch execution to live.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43187](http://127.0.0.1:43187).

Headless engine:

```bash
npm run bot
```

Tests:

```bash
npm test
```

## Hyperliquid live (optional)

1. Prefer **testnet** first: `https://app.hyperliquid-testnet.xyz`.
2. Generate an **API / agent wallet**. Agent keys can trade; they cannot withdraw.
3. Put the **main account address** and **agent private key** in `.env.local`:

```bash
HL_ACCOUNT_ADDRESS=0xYourMainWallet
HL_AGENT_PRIVATE_KEY=0xAgentPrivateKey
HL_NETWORK=testnet
HL_LIVE_CONFIRM=I_UNDERSTAND
```

4. On Rules, switch execution to **Live Hyperliquid**.

Never paste a seed that can withdraw. Never commit `.env.local`.
