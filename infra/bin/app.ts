import * as path from "path";
import { App, Tags } from "aws-cdk-lib";
import { SiteStack } from "../lib/site-stack";
import { stages } from "../lib/config";

// Production (ggnp.gurdevs.com) and dev; see lib/config.ts.
const app = new App();
const siteDir = path.join(__dirname, "../../app/dist");

for (const cfg of Object.values(stages)) {
  const stack = new SiteStack(app, cfg.stackName, {
    stage: cfg.label,
    siteDir,
    domain: cfg.domain,
    retainBucket: cfg.retainBucket,
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-west-2" },
    description: `Nagar Kirtan app (${cfg.label}): static site on S3 + CloudFront`,
  });
  Tags.of(stack).add("project", "nagar-kirtan");
  Tags.of(stack).add("stage", cfg.label);
}
