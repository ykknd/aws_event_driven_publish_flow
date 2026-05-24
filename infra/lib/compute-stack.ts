import * as cdk from "aws-cdk-lib";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as path from "path";
import { ComputeStackProps } from "./types";
import { TaskSizeProfileName } from "../config";

export class ComputeStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly readinessTaskDefinition: ecs.FargateTaskDefinition;
  public readonly analysisTaskDefinitions: Record<TaskSizeProfileName, ecs.FargateTaskDefinition>;
  public readonly containerName: string;
  public readonly taskSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const vpcId =
      this.node.tryGetContext("vpcId") ??
      ssm.StringParameter.valueFromLookup(this, props.config.vpcIdParameterName);
    const privateSubnetIdsValue =
      this.node.tryGetContext("privateSubnetIds") ??
      ssm.StringParameter.valueFromLookup(this, props.config.privateSubnetIdsParameterName);
    const privateSubnetIds = privateSubnetIdsValue
      .split(",")
      .map((subnetId: string) => subnetId.trim())
      .filter(Boolean);

    const vpc = ec2.Vpc.fromVpcAttributes(this, "ExistingVpc", {
      vpcId,
      availabilityZones: cdk.Stack.of(this).availabilityZones,
      privateSubnetIds,
    });

    this.cluster = new ecs.Cluster(this, "PipelineCluster", {
      vpc,
      clusterName: props.config.clusterName,
    });

    this.taskSecurityGroup = new ec2.SecurityGroup(this, "TaskSecurityGroup", {
      vpc,
      allowAllOutbound: true,
      description: `Security group for ${props.config.namePrefix} ECS tasks`,
    });

    const publisherManagedPolicies = [
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
    ];
    const publisherCustomPolicyStatements: iam.PolicyStatement[] = [
      new iam.PolicyStatement({
        actions: [
          "athena:BatchGetQueryExecution",
          "athena:GetQueryExecution",
          "athena:GetQueryResults",
          "athena:StartQueryExecution",
          "athena:StopQueryExecution",
          "glue:GetDatabase",
          "glue:GetDatabases",
          "glue:GetPartition",
          "glue:GetPartitions",
          "glue:GetTable",
          "glue:GetTables",
        ],
        resources: ["*"],
      }),
    ];

    const publisherRole = new iam.Role(this, "PublisherRole", {
      roleName: props.config.publisherRoleName,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Shared ECS task and execution role for publish_flow",
      managedPolicies: publisherManagedPolicies,
    });

    publisherCustomPolicyStatements.forEach((statement) => {
      publisherRole.addToPrincipalPolicy(statement);
    });

    const useDockerAsset = this.node.tryGetContext("useDockerAsset") === "true";
    const image = useDockerAsset
      ? ecs.ContainerImage.fromAsset(path.resolve(__dirname, "../.."), {
          file: "engine/Dockerfile",
          platform: ecrAssets.Platform.LINUX_AMD64,
        })
      : ecs.ContainerImage.fromRegistry("public.ecr.aws/docker/library/python:3.11-slim");

    const logGroup = new logs.LogGroup(this, "EngineLogGroup", {
      logGroupName: props.config.logGroupName,
      retention: props.config.logRetention,
      removalPolicy: props.config.removalPolicy,
    });

    this.containerName = props.config.containerName;

    const createTaskDefinition = (
      id: string,
      family: string,
      cpu: number,
      memoryLimitMiB: number,
    ): ecs.FargateTaskDefinition => {
      const taskDefinition = new ecs.FargateTaskDefinition(this, id, {
        memoryLimitMiB,
        cpu,
        family,
        taskRole: publisherRole,
        executionRole: publisherRole,
      });

      taskDefinition.addContainer(this.containerName, {
        image,
        logging: ecs.LogDrivers.awsLogs({
          logGroup,
          streamPrefix: "engine",
        }),
        memoryReservationMiB: 512,
        environment: {
          PYTHONPATH: "/app",
        },
      });

      return taskDefinition;
    };

    this.readinessTaskDefinition = createTaskDefinition(
      "ReadinessTaskDefinition",
      `${props.config.taskDefinitionFamily}-readiness`,
      512,
      1024,
    );

    this.analysisTaskDefinitions = props.config.taskSizeProfiles.reduce(
      (definitions, profile) => {
        definitions[profile.name] = createTaskDefinition(
          `${profile.name[0].toUpperCase()}${profile.name.slice(1)}AnalysisTaskDefinition`,
          `${props.config.taskDefinitionFamily}-${profile.name}`,
          profile.cpu,
          profile.memoryLimitMiB,
        );
        return definitions;
      },
      {} as Record<TaskSizeProfileName, ecs.FargateTaskDefinition>,
    );

    props.artifactsBucket.grantReadWrite(publisherRole);
    props.jobStateTable.grantReadWriteData(publisherRole);
  }
}
