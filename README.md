# German Vocab Collector Starter

This starter gives you the first working milestone:
- sign in with Supabase magic link
- save a word manually
- load your own saved words

## Files

- `index.html` - app markup
- `styles.css` - minimal mobile-friendly styles
- `app.js` - frontend logic
- `config.example.js` - copy to `config.js` and fill in your Supabase values
- `supabase.sql` - table + RLS policies

## Setup

### 1. Create the table in Supabase
Open the Supabase SQL editor and run `supabase.sql`.

### 2. Create your local config file
Copy `config.example.js` to `config.js` and put your project URL and publishable/anon key there.

Example:

```js
export const SUPABASE_URL = 'https://abc123.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_xxx';
```

### 3. Add your local URL in Supabase Auth settings
For local development, use a local server like:

- `http://localhost:5500`
- or `http://127.0.0.1:5500`

Add the same URL as an allowed redirect URL in Supabase Auth settings.

### 4. Run a local server
From this folder:

```bash
python3 -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

## What to build next

After this works, the next additions should be:
1. Tatoeba sentence fetch button
2. free translation API button
3. desktop-only Anki upload
