# Notes for Claude

- Mobile-first web app for a yearly Nagar Kirtan (procession). Tabs: Home, Schedule, Nagar Kirtan (live map), Parking, Grounds.
- Event: Gurdwara Gur Nanak Parkash, Fresno. Dev site: https://ggnp.gurdevs.com (DNS at Google Cloud DNS, CNAME to the dev CloudFront distribution).
- Wording: user-facing text always says "Nagar Kirtan", never "parade". Code identifiers (tab id `parade`, `followsParade`) stay as they are.
- Phones are the main screen; design at 390 px wide and check light and dark.
- Visual style follows the event poster: royal blue primary, saffron/gold accents, warm cream background; Baloo Paaji 2 headings (covers Gurmukhi), Figtree body. Home has a poster-style blue banner with Gurmukhi title, date and dedication (text in `content.json`). The committee rejected green; do not use green anywhere. Tokens are in `app/src/styles/tokens.css`; use them instead of new hex values.
- Plain JavaScript + Vite, no framework. Keep it that way unless the owner asks.
- Hosting: S3 + CloudFront via CDK in `infra/`, region us-west-2. Stacks `NagarKirtan-dev-site` and `NagarKirtan-prod-site`.
- Deploys only through GitHub Actions (OIDC role, no keys). Pushing to `main` deploys dev. Never trigger the production workflow; the owner does that.
- Planned live data: visitors poll `live.json` (cached a few seconds by CloudFront); the lead phone and admins write through a small API (API Gateway + Lambda), guarded by passcodes in SSM. Keep secrets out of the repo; it is public.
- Commit and push small, working steps; check `npm run build` and `npm run synth` before pushing.
