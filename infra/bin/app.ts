import * as path from "path";
import { App, Tags } from "aws-cdk-lib";
import { SiteStack } from "../lib/site-stack";

// Two copies of the app: "dev" deploys on every push to main,
// "prod" deploys only when started by hand from GitHub Actions.
const app = new App();
const siteDir = path.join(__dirname, "../../app/dist");

for (const stage of ["dev", "prod"] as const) {
  const stack = new SiteStack(app, `NagarKirtan-${stage}-site`, {
    stage,
    siteDir,
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-west-2" },
    description: `Nagar Kirtan app (${stage}): static site on S3 + CloudFront`,
  });
  Tags.of(stack).add("project", "nagar-kirtan");
  Tags.of(stack).add("stage", stage);
}
