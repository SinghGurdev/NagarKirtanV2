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
    certificateArn: "arn:aws:acm:us-east-1:643594672445:certificate/08d73cd0-62b3-48b9-afcd-64f7e8faf79a",
  },
  prod: null,
};
