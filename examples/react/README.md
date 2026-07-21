# React example

Install the SDK and start it once, high in your app tree. Autocapture handles routing and
fields; you only call the manual API for things it cannot see (like a successful API
response that means the flow shipped).

```bash
npm install usecalibrate
```

```tsx
// src/calibrate.ts
import { calibrate } from "usecalibrate";

export const fm = calibrate({
  app: "my-app",
  endpoint: import.meta.env.VITE_CALIBRATE_ENDPOINT, // e.g. https://collector.example.com
});
```

```tsx
// src/main.tsx
import "./calibrate"; // side-effect import starts autocapture once

// ...render your app as usual
```

```tsx
// Anywhere you know the flow completed:
import { fm } from "./calibrate";

async function onSubmit() {
  const res = await createProject();
  if (res.ok) fm.shipped();
}
```

With a client router (React Router, TanStack Router, Next.js app router), Calibrate picks
up `history.pushState` automatically, so page and flow events appear with no extra code.
It never reads input values: only that a field was focused, filled, left blank, or errored.
