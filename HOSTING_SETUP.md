# Firebase Hosting: LifeLog Landing Page

This repo now includes a simple Firebase Hosting landing page for the LifeLog open beta.

## What's included
- `firebase.json` updated with Hosting config (public dir = `public`)
- `public/index.html` with:
  - Title, tagline, features
  - Firebase Analytics (compat) wired
  - Tracked Join button (`join_beta_click`)
  - Responsive, mobile-friendly styles

## Prereqs
- Already ran `firebase login`
- Have a Firebase project created

## Quick setup
1. Initialize hosting (if not already connected to a project):
   - When prompted:
     - Public directory: `public`
     - Not a single-page app: `No`
     - Overwrite `index.html`: `Yes` (safe, we keep our file)

2. Replace the Firebase config inside `public/index.html` with your real values.

3. Optionally update the Play testing link if your package differs:
   - Current link uses `com.anonymous.lifelog` from Android `applicationId`.

## Deploy
Run:

```sh
firebase deploy
```

Firebase will output a `web.app` URL you can share in campaigns.

## Notes
- If you use Google Ads, consider adding the conversion tracking snippet. We can add this later.
- For SPA needs, you can switch to rewrite rules in `firebase.json` (not needed here).
