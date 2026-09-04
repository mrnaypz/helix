# Helix

Hyperliquid execution desk for a New York session price-action strategy. You chart support and resistance each morning. The bot watches 5-minute candles during the cash session for a break, a few bars of consolidation, and an engulfing continuation.

## Daily workflow

1. Chart your levels as you already do.
2. Enter them on **Levels** (resistance / support + price, per market).
3. Start the engine on the **Desk** when you want it armed. It will not take entries before 09:30 America/New_York.
4. A 5m close back through a level invalidates it. No trade. Chart a new level to re-arm that market — if the engine is already running, that is enough. You do not restart.
5. One market at a time, always 10x. First trigger wins. Size is 70% of the account as margin. Stop is −0.5% of price and target is +1% (5% / 10% ROE at 10x). After +0.55% the stop moves to break-even. After +0.8% it waits five 5m candles and exits if the target is still open.
6. It flattens at 16:00 ET by default. Kill switch is on the desk.

Paper mode is the default. No Hyperliquid orders are sent until you add an agent wallet and switch execution to live.

## Morning start (Windows + phone)

Do this after you open the laptop. You do not need Brave left open. You do not re-enable Tailscale Serve unless the phone URL dies.

1. Plug in if you can. Sleep = Never, or the lid-close will kill the bot.
2. Open **Ubuntu**. Wait until you see `harry@Napier`.
3. Start Helix:

```bash
cd ~/hyperliquid-strategy
npm run dev
```

Wait until it says Ready (or the local URL). Leave this Ubuntu window open.

4. Phone: Tailscale VPN **on**. At home, the `https://….ts.net` bookmark is fine. Away from home, prefer the IP bookmark below. Chart levels, then hit **Start** on the desk.

That is the whole sync. The phone is a remote for the Ubuntu process. Closing the phone or Brave does not stop the bot. Closing Ubuntu, `Ctrl+C`, sleep, or shutdown does.

### Away from home

Leaving Wi-Fi often breaks Tailscale DNS. The app shows **DNS unavailable**, and the `https://….ts.net` page will not load even though Helix is still running.

On the phone, in this order:

1. Confirm the laptop is still awake at home (lid open or Sleep = Never, Ubuntu still showing `npm run dev`).
2. Tailscale app → disconnect, wait 5 seconds, connect again. Do this after you are on cellular, not while still on home Wi-Fi.
3. Open the **IP** bookmark, not the `.ts.net` name: `http://100.98.58.62` (no port). That skips DNS.

Add HTTP Serve once on the PC so that IP works (PowerShell, not Ubuntu):

```powershell
& "C:\Program Files\Tailscale\tailscale.exe" serve --bg --yes 43187
& "C:\Program Files\Tailscale\tailscale.exe" serve --bg --http=80 43187
& "C:\Program Files\Tailscale\tailscale.exe" serve status
```

Bookmark both URLs status prints. Use `.ts.net` at home if you want. Use `http://100.x.x.x` when you leave.

If DNS unavailable persists: Tailscale phone settings → turn **off** “Use Tailscale DNS”. Then only the `http://100.x` bookmark will work, which is enough for Helix.

Do **not** use `http://100.x.x.x:43187`. That port is inside Ubuntu, not on Windows.

Serve is already on from the first setup. Only if both bookmarks fail, re-run the two `serve --bg` lines above.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43187](http://127.0.0.1:43187).

## Phone

The phone is a remote for the same process. Keep Ubuntu open and `npm run dev` running. Closing the browser does not stop the bot; closing Ubuntu does.

Do **not** open `http://100.x.x.x:43187` if Helix is running in WSL (Ubuntu). Tailscale on Windows cannot see that port. Laptop Brave works because Windows forwards `127.0.0.1` into Ubuntu. The phone needs that same hop.

### Tailscale Serve (WSL on Windows)

1. Ubuntu: `npm run dev` until Helix is Ready. Confirm Brave on the laptop still opens [http://127.0.0.1:43187](http://127.0.0.1:43187).
2. Phone: install [Tailscale](https://tailscale.com), sign in with the **same account** as the PC, and leave the VPN connected.
3. **Windows PowerShell** (not Ubuntu). If `tailscale` is not found, use the full path:

```powershell
& "C:\Program Files\Tailscale\tailscale.exe" serve reset
& "C:\Program Files\Tailscale\tailscale.exe" serve --bg --yes 43187
& "C:\Program Files\Tailscale\tailscale.exe" serve --bg --http=80 43187
& "C:\Program Files\Tailscale\tailscale.exe" serve status
```

4. Status prints an `https://….ts.net` URL (home / DNS) and, if you added `--http=80`, an `http://100.x.x.x` URL (cellular / no DNS). Bookmark both. Never use `:43187` on the phone.

Serve stays on across reboots until you run `tailscale serve reset`. You still have to start Ubuntu and `npm run dev` each day.

If the phone still fails, run these on the **PC** and read the errors:

```powershell
# Must return HTML / a 200. If this fails, WSL is not forwarding localhost.
curl.exe -I http://127.0.0.1:43187

& "C:\Program Files\Tailscale\tailscale.exe" status
& "C:\Program Files\Tailscale\tailscale.exe" serve status
```

- Laptop Brave works, PowerShell `curl` fails → restart Ubuntu (`wsl --shutdown` in PowerShell, then open Ubuntu and `npm run dev` again).
- `curl` works, phone does not → Tailscale is off, wrong account, DNS unavailable on cellular, or you opened `:43187` instead of `http://100.x` / the `.ts.net` URL.
- You can ignore old `netsh portproxy` / firewall rules for this. Serve does not use them.

### Public tunnel

Set a PIN first so strangers cannot start or kill the bot:

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
