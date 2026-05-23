import * as cdk from "aws-cdk-lib";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as path from "path";
import { ComputeStackProps } from "./types";

export class ComputeStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly taskDefinition: ecs.FargateTaskDefinition;
  public readonly containerName = "publish-flow-engine";

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "PipelineVpc", {
      maxAzs: 2,
      natGateways: 0,
    });

    this.cluster = new ecs.Cluster(this, "PipelineCluster", {
      vpc,
    });

    const publisherManagedPolicies = [
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
    ];
    const publisherCustomPolicyStatements: iam.PolicyStatement[] = [];

    const publisherRole = new iam.Role(this, "PublisherRole", {
      roleName: "publisher",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Shared ECS task and execution role for publish_flow",
      managedPolicies: publisherManagedPolicies,
    });

    publisherCustomPolicyStatements.forEach((statement) => {
      publisherRole.addToPrincipalPolicy(statement);
    });

    this.taskDefinition = new ecs.FargateTaskDefinition(this, "PipelineTaskDefinition", {
      memoryLimitMiB: 2048,
      cpu: 1024,
      taskRole: publisherRole,
      executionRole: publisherRole,
    });

    const useDockerAsset = this.node.tryGetContext("useDockerAsset") === "true";
    const image = useDockerAsset
      ? ecs.ContainerImage.fromAsset(path.resolve(__dirname, "../.."), {
          file: "engine/Dockerfile",
          platform: ecrAssets.Platform.LINUX_AMD64,
        })
      : ecs.ContainerImage.fromRegistry("public.ecr.aws/docker/library/python:3.11-slim");

    const logGroup = new logs.LogGroup(this, "EngineLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.taskDefinition.addContainer(this.containerName, {
      image,
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: "engine",
      }),
      environment: {
        PYTHONPATH: "/app",
      },
    });

    props.artifactsBucket.grantReadWrite(publisherRole);
    props.jobStateTable.grantReadWriteData(publisherRole);
  }
}
