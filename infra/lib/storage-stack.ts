import * as cdk from "aws-cdk-lib";
import * as ddb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { StackPropsWithConfig } from "./types";

export class StorageStack extends cdk.Stack {
  public readonly artifactsBucket: s3.Bucket;
  public readonly jobStateTable: ddb.Table;

  constructor(scope: Construct, id: string, props: StackPropsWithConfig) {
    super(scope, id, props);

    const s3VpcEndpointId =
      this.node.tryGetContext("s3VpceId") ??
      ssm.StringParameter.valueFromLookup(this, props.config.s3VpcEndpointIdParameterName);
    const allowedCidrsValue =
      this.node.tryGetContext("allowedCidrs") ??
      ssm.StringParameter.valueFromLookup(this, props.config.allowedCidrsParameterName);
    const allowedCidrs = allowedCidrsValue
      .split(",")
      .map((cidr: string) => cidr.trim())
      .filter(Boolean);

    this.artifactsBucket = new s3.Bucket(this, "ArtifactsBucket", {
      bucketName: props.config.artifactsBucketName,
      eventBridgeEnabled: true,
      autoDeleteObjects: !props.config.isProduction,
      removalPolicy: props.config.removalPolicy,
      enforceSSL: true,
      versioned: props.config.isProduction,
    });

    this.jobStateTable = new ddb.Table(this, "JobStateTable", {
      tableName: props.config.jobStateTableName,
      partitionKey: { name: "job_key", type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: props.config.isProduction
        ? { pointInTimeRecoveryEnabled: true }
        : undefined,
      removalPolicy: props.config.removalPolicy,
    });

    this.artifactsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "DenyObjectReadOutsideVpcEndpointAndAllowedCidrs",
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ["s3:GetObject", "s3:GetObjectVersion"],
        resources: [this.artifactsBucket.arnForObjects("*")],
        conditions: {
          StringNotEqualsIfExists: {
            "aws:SourceVpce": s3VpcEndpointId,
          },
          NotIpAddressIfExists: {
            "aws:SourceIp": allowedCidrs,
          },
        },
      }),
    );

    this.artifactsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "DenyBucketListOutsideVpcEndpointAndAllowedCidrs",
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ["s3:ListBucket"],
        resources: [this.artifactsBucket.bucketArn],
        conditions: {
          StringNotEqualsIfExists: {
            "aws:SourceVpce": s3VpcEndpointId,
          },
          NotIpAddressIfExists: {
            "aws:SourceIp": allowedCidrs,
          },
        },
      }),
    );
  }
}
