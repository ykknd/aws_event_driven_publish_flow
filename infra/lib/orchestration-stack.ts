import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import { OrchestrationStackProps } from "./types";

export class OrchestrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OrchestrationStackProps) {
    super(scope, id, props);

    const loadContext = new sfn.Pass(this, "LoadContext", {
      parameters: {
        "bucket.$": "$.detail.bucket.name",
        "job_key.$": "$.detail.object.key",
        "retry_count": 0,
      },
    });

    const runReadiness = new tasks.EcsRunTask(this, "RunReadinessCheck", {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      cluster: props.cluster,
      taskDefinition: props.taskDefinition,
      assignPublicIp: true,
      launchTarget: new tasks.EcsFargateLaunchTarget(),
      containerOverrides: [
        {
          containerDefinition: props.taskDefinition.defaultContainer!,
          command: ["python", "/app/engine/app/check_readiness.py"],
          environment: [
            { name: "JOB_BUCKET", value: sfn.JsonPath.stringAt("$.bucket") },
            { name: "JOB_KEY", value: sfn.JsonPath.stringAt("$.job_key") },
            { name: "RETRY_COUNT", value: sfn.JsonPath.stringAt("$.retry_count") },
            { name: "READINESS_OUTPUT_PATH", value: "/tmp/readiness.json" },
            { name: "JOB_STATE_TABLE", value: props.jobStateTable.tableName },
          ],
        },
      ],
      resultPath: sfn.JsonPath.DISCARD,
    });

    const fetchStatus = new tasks.DynamoGetItem(this, "FetchJobStatus", {
      table: props.jobStateTable,
      key: {
        job_key: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt("$.job_key")),
      },
      resultPath: "$.status",
    });

    const runAnalysis = new tasks.EcsRunTask(this, "RunAnalysis", {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      cluster: props.cluster,
      taskDefinition: props.taskDefinition,
      assignPublicIp: true,
      launchTarget: new tasks.EcsFargateLaunchTarget(),
      containerOverrides: [
        {
          containerDefinition: props.taskDefinition.defaultContainer!,
          command: ["python", "/app/engine/app/run_analysis.py"],
          environment: [
            { name: "JOB_BUCKET", value: sfn.JsonPath.stringAt("$.bucket") },
            { name: "JOB_KEY", value: sfn.JsonPath.stringAt("$.job_key") },
            { name: "OUTPUT_BUCKET", value: props.artifactsBucket.bucketName },
            { name: "OUTPUT_PREFIX", value: sfn.JsonPath.format("outputs/{}", sfn.JsonPath.stringAt("$.status.Item.job_id.S")) },
            { name: "JOB_STATE_TABLE", value: props.jobStateTable.tableName },
          ],
        },
      ],
      resultPath: sfn.JsonPath.DISCARD,
    });

    const waitThreeHours = new sfn.Wait(this, "Wait3Hours", {
      time: sfn.WaitTime.duration(cdk.Duration.hours(props.config.waitHours)),
    });

    const incrementRetry = new sfn.Pass(this, "IncrementRetryCount", {
      parameters: {
        "bucket.$": "$.bucket",
        "job_key.$": "$.job_key",
        "status.$": "$.status",
        "retry_count.$": "States.MathAdd($.retry_count, 1)",
      },
    });

    const giveUp = new tasks.SnsPublish(this, "NotifyGiveUp", {
      topic: props.notificationTopic,
      message: sfn.TaskInput.fromText(`${props.config.namePrefix} job gave up after max retries`),
      subject: `${props.config.namePrefix} give up`,
      resultPath: sfn.JsonPath.DISCARD,
    });

    const notifyFailure = new tasks.SnsPublish(this, "NotifyFailure", {
      topic: props.notificationTopic,
      message: sfn.TaskInput.fromText(`${props.config.namePrefix} workflow failed`),
      subject: `${props.config.namePrefix} failure`,
      resultPath: sfn.JsonPath.DISCARD,
    });

    const notifySuccess = new tasks.SnsPublish(this, "NotifySuccess", {
      topic: props.notificationTopic,
      message: sfn.TaskInput.fromText(`${props.config.namePrefix} workflow succeeded`),
      subject: `${props.config.namePrefix} success`,
      resultPath: sfn.JsonPath.DISCARD,
    });

    const retryLimitReached = new sfn.Choice(this, "RetryLimitReached")
      .when(sfn.Condition.numberGreaterThanEquals("$.retry_count", props.config.maxRetries), giveUp)
      .otherwise(runReadiness);

    const readinessBranch = new sfn.Choice(this, "InputsReady")
      .when(sfn.Condition.booleanEquals("$.status.Item.ready.BOOL", true), runAnalysis.next(notifySuccess))
      .otherwise(waitThreeHours.next(incrementRetry).next(retryLimitReached));

    const definition = loadContext
      .next(runReadiness)
      .next(fetchStatus)
      .next(readinessBranch);

    const stateMachine = new sfn.StateMachine(this, "PublishFlowStateMachine", {
      stateMachineName: props.config.stateMachineName,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: cdk.Duration.days(11),
    });

    stateMachine.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutTargets", "events:PutRule", "events:DescribeRule"],
        resources: ["*"],
      }),
    );

    const rule = new events.Rule(this, "JobCreatedRule", {
      ruleName: props.config.ruleName,
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          bucket: {
            name: [props.artifactsBucket.bucketName],
          },
          object: {
            key: [{ prefix: "jobs/" }],
          },
        },
      },
    });

    rule.addTarget(new targets.SfnStateMachine(stateMachine));

    runReadiness.addCatch(notifyFailure, { resultPath: "$.error" });
    runAnalysis.addCatch(notifyFailure, { resultPath: "$.error" });
  }
}
