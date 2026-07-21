# Self-hosted example

Shows the whole point of Firstmile: **your app, your collector, your data.** No Firstmile
cloud is involved. The app sends events to a collector you run, and the data lands on a disk
you own.

Three services, three owners, all yours:

- **App** on `http://localhost:5173` (stands in for your product)
- **Collector** on `http://localhost:8787` (the service you deploy)
- **Data** in `./data/firstmile.db` (a file on your disk)

## Run it

```
1. cd firstmile
2. npm install && npm run build      # builds the SDK file the app loads
3. cd examples/self-hosted
4. docker compose up --build
```

Then:

```
5. open http://localhost:5173        # your app
6. click through the two steps
7. open http://localhost:8787        # your collector's dashboard
8. watch the session and funnel appear
```

## Prove the ownership

- **The data is yours.** After clicking through, look at `examples/self-hosted/data/`. Your
  events are in `firstmile.db` on your machine. Nothing left your infrastructure.
- **The endpoint is yours.** In `app.html`, `endpoint` is `http://localhost:8787`, your
  collector. Swap it for your deployed collector URL in production. There is no shared
  address to send to.
- **The privacy holds.** The app sets `debug: true`. Open the browser console and type an
  email: the SDK records that the field was filled, never the value.

## What changes in production

Only the endpoint. Deploy the collector anywhere (a VPS, AWS, Fly, Render, Kubernetes), give
it a public URL, and set `endpoint` to that URL. Set `ALLOWED_ORIGINS` on the collector to
your app's real origin, and set `DATABASE_URL` if you want Postgres instead of the SQLite
file.
