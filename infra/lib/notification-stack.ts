import * as cdk from "aws-cdk-lib";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { StackPropsWithConfig } from "./types";

export class NotificationStack extends cdk.Stack {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: StackPropsWithConfig) {
    super(scope, id, props);

    this.topic = new sns.Topic(this, "PipelineNotifications", {
      displayName: "publish-flow notifications",
    });
  }
}

