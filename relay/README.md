# Chill Flight relay

The relay for [flying together](../README.md#flying-together): a Cloudflare Worker with one Durable Object per room. It knows nothing about the game. Each message a player sends is passed on to everyone else in their room, tagged with who sent it, so game updates never need it redeployed.

- **Rooms:** `wss://<relay>/room/<CODE>?mode=create|join&seed=<n>&name=<host>`. `create` is refused if the code is in use and `join` if there's no such room (coming back after a dropped connection is a join too), so only the game's random codes start rooms. Up to 4 players. An empty room can be rejoined for 10 minutes, then it's forgotten (an alarm clears its storage).
- **Messages:** any JSON object up to 1 KB, passed on with `f` set to the sender's id. The relay sends `welcome` (your id, the room's seed and host, who's there), `joined` and `left`. A refused join is closed with a code: 4001 full, 4004 no such room, 4009 code in use, 4000 bad request. A player sending more than 20 messages a second on average (bursts of 40; the game sends 5) is disconnected with 4029.
- **Who may connect:** browsers and app webviews send an `Origin` header, and only the ones in `ALLOWED_ORIGINS` (`wrangler.toml`) get in, plus `localhost` on any port. This keeps other websites off the relay, but it isn't real security: a script outside a browser can send any Origin. What keeps the relay cheap and safe is the 4-player cap, the message size and rate limits, a brake on repeated failed joins (10 a minute per address), and the free plan stopping rather than billing.
- **Cost:** the free Workers plan includes SQLite-backed Durable Objects. Rooms hibernate while nobody is sending. When the day's free allowance runs out, joins fail until the next day and the game carries on solo.

The rules (who may join, which origins, what's passed on) are plain functions in `src/rules.js`, tested by `npm run test:multiplayer` in the game's folder.

## Deploy

Once signed in to Cloudflare (`npx -y wrangler login`), deploy from the project root:

```bash
npm run relay:deploy
```

Or from within this folder:

```bash
npx -y wrangler deploy
```

It prints the relay's address, like `https://chill-flight-relay.<account>.workers.dev`. Put it in `DEFAULT_RELAY` in `../multiplayer.js` as `wss://…` (that shows the 👥 button). After that it only needs deploying again if `src/` or `wrangler.toml` change, for example to allow a new origin.

## Run locally

From the project root:

```bash
npm run relay:dev
```

Or from within this folder:

```bash
npx -y wrangler dev
```

Then open the game with `?relay=ws://localhost:8787`.
