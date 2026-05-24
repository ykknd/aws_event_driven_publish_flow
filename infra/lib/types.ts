import * as cdk from "aws-cdk-lib";
import * as ddb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { AppConfig } from "../config";

export interface StackPropsWithConfig extends cdk.StackProps {
  config: AppConfig;
}

export interface ComputeStackProps extends StackPropsWithConfig {
  artifactsBucket: s3.IBucket;
  jobStateTable: ddb.ITable;
}

export interface OrchestrationStackProps extends ComputeStackProps {
  cluster: ecs.ICluster;
  taskDefinition: ecs.FargateTaskDefinition;
  containerName: string;
  taskSecurityGroup: ec2.ISecurityGroup;
}
