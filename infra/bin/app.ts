#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { defaultConfig } from "../config/default";
import { StorageStack } from "../lib/storage-stack";
import { NotificationStack } from "../lib/notification-stack";
import { ComputeStack } from "../lib/compute-stack";
import { OrchestrationStack } from "../lib/orchestration-stack";

const app = new cdk.App();

const storage = new StorageStack(app, "PublishFlowStorageStack", {
  config: defaultConfig,
});

const notification = new NotificationStack(app, "PublishFlowNotificationStack", {
  config: defaultConfig,
});

const compute = new ComputeStack(app, "PublishFlowComputeStack", {
  config: defaultConfig,
  artifactsBucket: storage.artifactsBucket,
  jobStateTable: storage.jobStateTable,
});

new OrchestrationStack(app, "PublishFlowOrchestrationStack", {
  config: defaultConfig,
  artifactsBucket: storage.artifactsBucket,
  jobStateTable: storage.jobStateTable,
  cluster: compute.cluster,
  taskDefinition: compute.taskDefinition,
  containerName: compute.containerName,
  notificationTopic: notification.topic,
});

