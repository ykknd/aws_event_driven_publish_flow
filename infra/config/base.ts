import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import { AppConfig, Stage } from "./types";

export function createBaseConfig(stage: Stage): AppConfig {
  const namePrefix = `publish-flow-${stage}`;
  const networkParamPrefix = `/publish-flow/${stage}/network`;

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
    taskDefinitionFamily: `${namePrefix}-engine`,
    containerName: `${namePrefix}-engine`,
    ruleName: `${namePrefix}-jobs-created`,
    vpcIdParameterName: `${networkParamPrefix}/vpc-id`,
    privateSubnetIdsParameterName: `${networkParamPrefix}/private-subnet-ids`,
    s3VpcEndpointIdParameterName: `${networkParamPrefix}/s3-vpce-id`,
    allowedCidrsParameterName: `${networkParamPrefix}/allowed-cidrs`,
    waitHours: 3,
    maxRetries: 80,
    isProduction: false,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    terminationProtection: false,
    logRetention: logs.RetentionDays.ONE_WEEK,
  };
}
