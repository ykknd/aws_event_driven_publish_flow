import * as cdk from "aws-cdk-lib";
import * as ddb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { StackPropsWithConfig } from "./types";

export class StorageStack extends cdk.Stack {
  public readonly artifactsBucket: s3.Bucket;
  public readonly jobStateTable: ddb.Table;

  constructor(scope: Construct, id: string, props: StackPropsWithConfig) {
    super(scope, id, props);

    this.artifactsBucket = new s3.Bucket(this, "ArtifactsBucket", {
      eventBridgeEnabled: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true,
    });

    this.jobStateTable = new ddb.Table(this, "JobStateTable", {
      partitionKey: { name: "job_key", type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}

