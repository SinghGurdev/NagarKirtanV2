// Custom web addresses per stage. A CloudFront distribution can only answer
// for a domain when it has an ACM certificate for it in us-east-1.
// Neither value is secret.

export interface StageDomain {
  domainName: string;
  /** ACM certificate ARN in us-east-1 covering domainName; null until issued. */
  certificateArn: string | null;
}

export const domains: Record<"dev" | "prod", StageDomain | null> = {
  dev: {
    domainName: "ggnp.gurdevs.com",
    certificateArn: null,
  },
  prod: null,
};
