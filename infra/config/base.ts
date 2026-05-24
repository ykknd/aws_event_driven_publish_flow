import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import { AppConfig, Stage, TaskSizeProfile } from "./types";

const defaultTaskSizeProfiles: TaskSizeProfile[] = [
  { name: "small", maxTargets: 5, cpu: 4096, memoryLimitMiB: 30720 },
  { name: "medium", maxTargets: 20, cpu: 8192, memoryLimitMiB: 61440 },
  { name: "large", maxTargets: 50, cpu: 16384, memoryLimitMiB: 81920 },
  { name: "max", cpu: 16384, memoryLimitMiB: 106496 },
];

export function createBaseConfig(stage: Stage): AppConfig {
  const namePrefix = `publish-flow-${stage}`;
  const networkParamPrefix = `/publish-flow/${stage}/network`;
  const notificationParamPrefix = `/publish-flow/${stage}/notification`;

  return {
    stage,
    namePrefix,
    stateMachineName: `${namePrefix}-state-machine`,
    publisherRoleName: `${namePrefix}-publisher`,
    artifactsBucketName: `${namePrefix}-artifacts-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
    jobStateTableName: `${namePrefix}-job-state`,
    clusterName: `${namePrefix}-cluster`,
    logGroupName: `/aws/ecs/${namePrefix}-engine`,
    notificationTopicName: `${namePrefix}-notifications`,
    notificationDisplayName: `${namePrefix} notifications`,
    senderEmailParameterName: `${notificationParamPrefix}/from-address`,
    taskDefinitionFamily: `${namePrefix}-engine`,
    containerName: `${namePrefix}-engine`,
    ruleName: `${namePrefix}-jobs-created`,
    vpcIdParameterName: `${networkParamPrefix}/vpc-id`,
    privateSubnetIdsParameterName: `${networkParamPrefix}/private-subnet-ids`,
    s3VpcEndpointIdParameterName: `${networkParamPrefix}/s3-vpce-id`,
    allowedCidrsParameterName: `${networkParamPrefix}/allowed-cidrs`,
    taskSizeProfiles: defaultTaskSizeProfiles,
    waitHours: 3,
    maxRetries: 80,
    isProduction: false,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    terminationProtection: false,
    logRetention: logs.RetentionDays.ONE_WEEK,
  };
}
