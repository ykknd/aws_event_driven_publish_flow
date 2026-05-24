import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";

export type Stage = "staging" | "prod";
export type TaskSizeProfileName = "small" | "medium" | "large" | "max";

export interface TaskSizeProfile {
  name: TaskSizeProfileName;
  maxTargets?: number;
  cpu: number;
  memoryLimitMiB: number;
}

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
  senderEmailParameterName: string;
  taskDefinitionFamily: string;
  containerName: string;
  ruleName: string;
  vpcIdParameterName: string;
  privateSubnetIdsParameterName: string;
  s3VpcEndpointIdParameterName: string;
  allowedCidrsParameterName: string;
  taskSizeProfiles: TaskSizeProfile[];
  waitHours: number;
  maxRetries: number;
  isProduction: boolean;
  removalPolicy: cdk.RemovalPolicy;
  terminationProtection: boolean;
  logRetention: logs.RetentionDays;
}
