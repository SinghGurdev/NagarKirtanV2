import * as path from "path";
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { StageDomain } from "./config";

export interface SiteStackProps extends StackProps {
  stage: "dev" | "prod";
  /** Folder with the built app (app/dist). */
  siteDir: string;
  /** Custom web address; only applied once its certificate ARN is set. */
  domain?: StageDomain | null;
  /** Keep the bucket (and its files) if the stack is deleted. */
  retainBucket?: boolean;
}

/**
 * Serves the built app from a private S3 bucket through CloudFront.
 * Hashed files in /assets are cached for a year; index.html and the data
 * files are always re-checked so a new deploy shows up on the next load.
 */
export class SiteStack extends Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);
    const bucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: props.retainBucket ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !props.retainBucket,
    });

    const custom = props.domain?.certificateArn ? props.domain : null;

    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      comment: `Nagar Kirtan ${props.stage}`,
      ...(custom && {
        domainNames: [custom.domainName],
        certificate: acm.Certificate.fromCertificateArn(this, "SiteCertificate", custom.certificateArn!),
      }),
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      // Unknown paths fall back to the app shell (tabs use #/ routes).
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: Duration.seconds(0) },
      ],
    });

    // Vite's hashed build output (assets/) never changes once published.
    const assets = new s3deploy.BucketDeployment(this, "DeployAssets", {
      sources: [s3deploy.Source.asset(path.join(props.siteDir, "assets"))],
      destinationBucket: bucket,
      destinationKeyPrefix: "assets/",
      cacheControl: [s3deploy.CacheControl.fromString("public, max-age=31536000, immutable")],
      prune: false,
    });

    // Everything else (index.html, data/*.json) is re-checked on every load.
    const rest = new s3deploy.BucketDeployment(this, "DeployIndex", {
      sources: [s3deploy.Source.asset(props.siteDir, { exclude: ["assets", "assets/**"] })],
      destinationBucket: bucket,
      cacheControl: [s3deploy.CacheControl.fromString("no-cache")],
      prune: false,
      distribution,
      distributionPaths: ["/*"],
    });
    rest.node.addDependency(assets);

    new CfnOutput(this, "SiteUrl", {
      value: custom ? `https://${custom.domainName}` : `https://${distribution.distributionDomainName}`,
    });
    new CfnOutput(this, "CloudFrontDomain", { value: distribution.distributionDomainName });
    new CfnOutput(this, "BucketName", { value: bucket.bucketName });
  }
}
