import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";

export type Stage = "staging" | "prod";

export interface AppConfig {
  stage: Stage;
  namePrefix: string;
  stateMachineName: string;
  publisherRoleName: string;
  artifactsBucketName: string;
  jobStateTableName: string;
  clusterName: string;
  logGroupName: string;
  notificationTopicName: string;
  notificationDisplayName: string;
  taskDefinitionFamily: string;
  containerName: string;
  ruleName: string;
  waitHours: number;
  maxRetries: number;
  isProduction: boolean;
  removalPolicy: cdk.RemovalPolicy;
  terminationProtection: boolean;
  logRetention: logs.RetentionDays;
}

