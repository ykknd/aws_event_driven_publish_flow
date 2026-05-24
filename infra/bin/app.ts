#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { resolveConfig } from "../config";
import { StorageStack } from "../lib/storage-stack";
import { ComputeStack } from "../lib/compute-stack";
import { OrchestrationStack } from "../lib/orchestration-stack";

const app = new cdk.App();
const config = resolveConfig(app.node.tryGetContext("stage"));

cdk.Tags.of(app).add("Application", "publish_flow");
cdk.Tags.of(app).add("Stage", config.stage);

const commonStackProps = {
  config,
  terminationProtection: config.terminationProtection,
};

const storage = new StorageStack(app, `PublishFlowStorageStack-${config.stage}`, commonStackProps);

const compute = new ComputeStack(app, `PublishFlowComputeStack-${config.stage}`, {
  ...commonStackProps,
  artifactsBucket: storage.artifactsBucket,
  jobStateTable: storage.jobStateTable,
});

new OrchestrationStack(app, `PublishFlowOrchestrationStack-${config.stage}`, {
  ...commonStackProps,
  artifactsBucket: storage.artifactsBucket,
  jobStateTable: storage.jobStateTable,
  cluster: compute.cluster,
  readinessTaskDefinition: compute.readinessTaskDefinition,
  analysisTaskDefinitions: compute.analysisTaskDefinitions,
  containerName: compute.containerName,
  taskSecurityGroup: compute.taskSecurityGroup,
});
