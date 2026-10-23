# Nagar Kirtan V2

Mobile web app for the yearly Nagar Kirtan at Gurdwara Gur Nanak Parkash, Fresno: live Nagar Kirtan map, schedule, parking and a map of the Gurdwara grounds.

## Layout

| Folder | What it is |
| --- | --- |
| `app/` | The web app: plain HTML, CSS and JavaScript, built with Vite. One module per tab in `app/src/tabs/`. Colors live in `app/src/styles/tokens.css`. |
| `infra/` | AWS infrastructure as code (CDK, TypeScript). `lib/site-stack.ts` hosts the app on S3 + CloudFront. |
| `.github/workflows/` | Deploys: `deploy-dev.yml` on every push to `main`, `deploy-prod.yml` when started by hand. |

## Work on it locally

```
npm ci
npm run dev        # opens the app on your network; visit it from your phone
npm run build      # builds app/dist
npm run synth      # checks the AWS code (needs a build first)
```

## Sites

| Site | Address | Updates when | AWS stack |
| --- | --- | --- | --- |
| **Production** | https://ggnp.gurdevs.com | You run GitHub > Actions > *Deploy production* > Run workflow | `NagarKirtan-dev-site` (old name kept on purpose, see `infra/lib/config.ts`) |
| **Dev** | Printed in each *Deploy dev* run summary (a cloudfront.net address) | Every push to `main` | `NagarKirtan-staging-site` |

The dev site shows a "Dev site" banner. Typical flow: change something (or edit `app/public/data/content.json` on GitHub), check it on the dev site, then run *Deploy production*.

GitHub signs in to AWS with a short-lived token through the `GitHub-NagarKirtan-deploy` IAM role, so no AWS keys are stored anywhere. The repo variables `AWS_ACCOUNT_ID` and `AWS_DEPLOY_ROLE_ARN` tell the workflows which account and role to use.
