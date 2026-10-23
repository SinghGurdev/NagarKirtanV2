// The two copies of the app. Neither value here is secret.
//
// PRODUCTION is the site people use: https://ggnp.gurdevs.com. Its AWS stack
// is still named "NagarKirtan-dev-site" because it started life as the dev
// site; renaming a stack would replace its CloudFront distribution (new
// address, DNS change, downtime), so the old name is kept on purpose.
// It only deploys when started by hand (GitHub > Actions > Deploy production).
//
// DEV is a separate copy for trying changes first. It deploys on every push
// to main and has its own CloudFront address.

export interface StageDomain {
  domainName: string;
  /** ACM certificate ARN in us-east-1 covering domainName. */
  certificateArn: string | null;
}

export interface StageConfig {
  /** CloudFormation stack name (never change for an existing stage). */
  stackName: string;
  label: "dev" | "prod";
  domain: StageDomain | null;
  /** Keep the S3 bucket if the stack is ever deleted. */
  retainBucket: boolean;
}

export const stages: Record<"prod" | "dev", StageConfig> = {
  prod: {
    stackName: "NagarKirtan-dev-site",
    label: "prod",
    domain: {
      domainName: "ggnp.gurdevs.com",
      certificateArn: "arn:aws:acm:us-east-1:643594672445:certificate/08d73cd0-62b3-48b9-afcd-64f7e8faf79a",
    },
    // Left as first deployed: switching this on an existing bucket would
    // remove its auto-delete helper mid-deploy. Revisit after the event.
    retainBucket: false,
  },
  dev: {
    stackName: "NagarKirtan-staging-site",
    label: "dev",
    domain: null,
    retainBucket: false,
  },
};
