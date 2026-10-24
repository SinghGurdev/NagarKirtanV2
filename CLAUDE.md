# Notes for Claude

- Mobile-first web app for a yearly Nagar Kirtan (procession). Tabs: Home, Schedule, Nagar Kirtan (live map), Parking, Grounds.
- Event: Gurdwara Gur Nanak Parkash, Fresno. PRODUCTION is https://ggnp.gurdevs.com (DNS at Google Cloud DNS). Its stack is named `NagarKirtan-dev-site` for historical reasons; never rename it (that replaces the CloudFront distribution). DEV is the separate stack `NagarKirtan-staging-site` (cloudfront.net address, "Dev site" banner).
- Wording: user-facing text always says "Nagar Kirtan", never "parade". Code identifiers (tab id `parade`, `followsParade`) stay as they are.
- Phones are the main screen; design at 390 px wide and check light and dark.
- Visual style follows the event poster: royal blue primary, saffron/gold accents, warm cream background; Baloo Paaji 2 headings (covers Gurmukhi), Figtree body. Home has a poster-style blue banner with Gurmukhi title, date and dedication (text in `content.json`). The committee rejected green; do not use green anywhere. Tokens are in `app/src/styles/tokens.css`; use them instead of new hex values.
- Plain JavaScript + Vite, no framework. Keep it that way unless the owner asks.
- Hosting: S3 + CloudFront via CDK in `infra/`, region us-west-2. Stage settings in `infra/lib/config.ts`.
- Deploys only through GitHub Actions (OIDC role, no keys). Pushing to `main` deploys DEV only. Never trigger the production workflow; the owner does that. Verify changes on the dev site, then tell the owner they are ready for production.
- Live data: the lead phone opens the hidden page `#/lead`, signs in with a passcode (Secrets Manager secret `<stack>/lead-passcode`) and POSTs its GPS to a Lambda function URL (`infra/lambda/live`), which writes `live/state.json` to the bucket. Visitors poll that file every 5 s. `config/api.json` tells the app the endpoint URL. Logic is in `compute.mjs`; test with `node tools/test-live.mjs`. Keep secrets out of the repo; it is public.
- Commit and push small, working steps; check `npm run build` and `npm run synth` before pushing.
- The owner edits `app/public/data/content.json` directly on GitHub. Always `git fetch` and rebase onto `origin/main` before pushing, keep their wording, and never hide `git push` errors.
