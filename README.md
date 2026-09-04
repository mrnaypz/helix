# Helix

Hyperliquid execution desk for a New York session price-action strategy. You chart support and resistance each morning. The bot watches 5-minute candles during the cash session for a break, a few bars of consolidation, and an engulfing continuation.

## Daily workflow

1. Chart your levels as you already do.
2. Enter them on **Levels** (resistance / support + price, per market).
3. Start the engine on the **Desk** when you want it armed. It will not take entries before 09:30 America/New_York.
4. A 5m close back through a level invalidates it. No trade. Chart a new level to re-arm that market — if the engine is already running, that is enough. You do not restart.
5. One market at a time. First trigger wins. Size is 70% of the account as margin. Stop is 5% ROE and target is 10% ROE (at 10x that is 0.5% / 1% of price).
6. It flattens at 16:00 ET by default. Kill switch is on the desk.

Paper mode is the default. No Hyperliquid orders are sent until you add an agent wallet and switch execution to live.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43187](http://127.0.0.1:43187).

## Phone

The phone is a remote for the same process. Keep the Next.js desk running on a machine that stays on (`npm run start` after `npm run build`, or `npm run dev`).

**Private (recommended):** install [Tailscale](https://tailscale.com) on that machine and on your phone. Open `http://<tailscale-ip>:43187`. Do not port-forward the desk.

**Public tunnel:** set a PIN first so strangers cannot start or kill the bot:

```bash
HELIX_PIN=your-phone-pin
```

Then point Cloudflare Tunnel or ngrok at port 43187. Safari/Chrome will show Unlock. After that, Share → Add to Home Screen (iPhone) or Install app (Android).

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
