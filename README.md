# Helix

Paper and live execution desk for Hyperliquid perpetual futures. The engine reads live candles and mids from Hyperliquid, evaluates a dual-EMA trend strategy with ATR risk, and either simulates fills or places IOC orders through an agent wallet.

Your own trading rules are not in this repo yet. Helix ships a complete, tunable starter strategy so you can run the full loop (data → signal → risk → paper fill → desk) immediately. Replace `src/lib/strategy/ema-crossover.ts` once you send the real spec.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43187](http://127.0.0.1:43187). The desk starts in **paper mode** and does not place orders.

Headless engine (same paper/live loop, no UI):

```bash
npm run bot
```

Tests:

```bash
npm test
```

## Hyperliquid live (optional)

1. Create or use a Hyperliquid account. Prefer **testnet** first: `https://app.hyperliquid-testnet.xyz`.
2. Generate an **API / agent wallet** at the API page. Approve it from your main wallet. Agent keys can trade; they cannot withdraw.
3. Put the **main account address** and **agent private key** in `.env.local`:

```bash
HL_ACCOUNT_ADDRESS=0xYourMainWallet
HL_AGENT_PRIVATE_KEY=0xAgentPrivateKey
HL_NETWORK=testnet
HL_LIVE_CONFIRM=I_UNDERSTAND
```

4. On the Strategy page, switch execution to **Live Hyperliquid**. The desk refuses live mode if any of the three gates are missing.

Never paste a seed that can withdraw. Never commit `.env.local`.

## What the starter strategy does

- Universe: BTC, ETH, SOL perps (editable)
- Timeframe: 15m closed candles
- Entry: 9/21 EMA crossover, optional trend filter vs the slow EMA
- Exit: opposite cross, ATR stop (1.8×), ATR take (3.2×)
- Size: 1% equity risk / stop distance, capped at 3× leverage
- Guards: max 2 positions, 3% UTC daily loss halt, 45-minute cooldown after a stop, kill switch

## What I still need from you

See the in-app **Runbook** for the full operating plan. Short version:

- Your actual entry, exit, and filter rules
- Risk budget and coins you will trade
- Agent wallet only when you are ready to leave paper

Once it is live you still operate it: keep the process online, watch the first sessions, fund/defund in the official Hyperliquid app, rotate keys if needed, and use the kill switch or the Hyperliquid UI if the host is down.
