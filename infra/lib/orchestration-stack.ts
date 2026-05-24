import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import { OrchestrationStackProps } from "./types";

export class OrchestrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OrchestrationStackProps) {
    super(scope, id, props);

    const senderEmail =
      this.node.tryGetContext("senderEmail") ??
      ssm.StringParameter.valueFromLookup(this, props.config.senderEmailParameterName);
    const taskSizeProfilesJson = JSON.stringify(props.config.taskSizeProfiles);

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
      taskDefinition: props.readinessTaskDefinition,
      assignPublicIp: false,
      launchTarget: new tasks.EcsFargateLaunchTarget(),
      securityGroups: [props.taskSecurityGroup],
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      containerOverrides: [
        {
          containerDefinition: props.readinessTaskDefinition.defaultContainer!,
          command: ["python", "/app/engine/app/check_readiness.py"],
          environment: [
            { name: "JOB_BUCKET", value: sfn.JsonPath.stringAt("$.bucket") },
            { name: "JOB_KEY", value: sfn.JsonPath.stringAt("$.job_key") },
            { name: "RETRY_COUNT", value: sfn.JsonPath.stringAt("$.retry_count") },
            { name: "READINESS_OUTPUT_PATH", value: "/tmp/readiness.json" },
            { name: "JOB_STATE_TABLE", value: props.jobStateTable.tableName },
            { name: "TASK_SIZE_PROFILES_JSON", value: taskSizeProfilesJson },
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

    const fetchGiveUpNotificationStatus = new tasks.DynamoGetItem(this, "FetchGiveUpNotificationStatus", {
      table: props.jobStateTable,
      key: {
        job_key: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt("$.job_key")),
      },
      resultPath: "$.notification_status",
    });

    const fetchReadinessFailureNotificationStatus = new tasks.DynamoGetItem(this, "FetchReadinessFailureNotificationStatus", {
      table: props.jobStateTable,
      key: {
        job_key: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt("$.job_key")),
      },
      resultPath: "$.notification_status",
    });

    const createRunAnalysisTask = (profileName: keyof typeof props.analysisTaskDefinitions, idSuffix: string) =>
      new tasks.EcsRunTask(this, `RunAnalysis${idSuffix}`, {
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        cluster: props.cluster,
        taskDefinition: props.analysisTaskDefinitions[profileName],
        assignPublicIp: false,
        launchTarget: new tasks.EcsFargateLaunchTarget(),
        securityGroups: [props.taskSecurityGroup],
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        containerOverrides: [
          {
            containerDefinition: props.analysisTaskDefinitions[profileName].defaultContainer!,
            command: ["python", "/app/engine/app/run_analysis.py"],
            environment: [
              { name: "JOB_BUCKET", value: sfn.JsonPath.stringAt("$.bucket") },
              { name: "JOB_KEY", value: sfn.JsonPath.stringAt("$.job_key") },
              { name: "OUTPUT_BUCKET", value: props.artifactsBucket.bucketName },
              { name: "OUTPUT_PREFIX", value: sfn.JsonPath.format("outputs/{}", sfn.JsonPath.stringAt("$.status.Item.job_id.S")) },
              { name: "JOB_STATE_TABLE", value: props.jobStateTable.tableName },
              { name: "TASK_SIZE_PROFILE", value: sfn.JsonPath.stringAt("$.status.Item.task_size_profile.S") },
            ],
          },
        ],
        resultPath: sfn.JsonPath.DISCARD,
      });

    const runSmallAnalysis = createRunAnalysisTask("small", "Small");
    const runMediumAnalysis = createRunAnalysisTask("medium", "Medium");
    const runLargeAnalysis = createRunAnalysisTask("large", "Large");
    const runMaxAnalysis = createRunAnalysisTask("max", "Max");

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

    const notifyGiveUp = new tasks.CallAwsService(this, "NotifyGiveUp", {
      service: "sesv2",
      action: "sendEmail",
      iamResources: ["*"],
      parameters: {
        FromEmailAddress: senderEmail,
        Destination: {
          ToAddresses: sfn.JsonPath.listAt("$.notification_status.Item.notification_to.SS"),
        },
        Content: {
          Simple: {
            Subject: {
              Data: sfn.JsonPath.format(
                "[GIVE UP] {}",
                sfn.JsonPath.stringAt("$.notification_status.Item.notification_subject.S"),
              ),
            },
            Body: {
              Text: {
                Data: sfn.JsonPath.format(
                  "ジョブID: {}\nレポート種別: {}\n未充足対象: {}\n状態: 最大リトライ回数に達しました。",
                  sfn.JsonPath.stringAt("$.notification_status.Item.job_id.S"),
                  sfn.JsonPath.stringAt("$.notification_status.Item.report_type.S"),
                  sfn.JsonPath.stringAt("$.notification_status.Item.missing_targets_text.S"),
                ),
              },
            },
          },
        },
      },
      resultPath: sfn.JsonPath.DISCARD,
    });

    const notifyFailure = new tasks.CallAwsService(this, "NotifyFailure", {
      service: "sesv2",
      action: "sendEmail",
      iamResources: ["*"],
      parameters: {
        FromEmailAddress: senderEmail,
        Destination: {
          ToAddresses: sfn.JsonPath.listAt("$.notification_status.Item.notification_to.SS"),
        },
        Content: {
          Simple: {
            Subject: {
              Data: sfn.JsonPath.format(
                "[FAILURE] {}",
                sfn.JsonPath.stringAt("$.notification_status.Item.notification_subject.S"),
              ),
            },
            Body: {
              Text: {
                Data: sfn.JsonPath.format(
                  "ジョブID: {}\nレポート種別: {}\nエラー: {}\n詳細: {}",
                  sfn.JsonPath.stringAt("$.notification_status.Item.job_id.S"),
                  sfn.JsonPath.stringAt("$.notification_status.Item.report_type.S"),
                  sfn.JsonPath.stringAt("$.error.Error"),
                  sfn.JsonPath.stringAt("$.error.Cause"),
                ),
              },
            },
          },
        },
      },
      resultPath: sfn.JsonPath.DISCARD,
    });

    const notifySuccess = new tasks.CallAwsService(this, "NotifySuccess", {
      service: "sesv2",
      action: "sendEmail",
      iamResources: ["*"],
      parameters: {
        FromEmailAddress: senderEmail,
        Destination: {
          ToAddresses: sfn.JsonPath.listAt("$.notification_status.Item.notification_to.SS"),
        },
        Content: {
          Simple: {
            Subject: {
              Data: sfn.JsonPath.stringAt("$.notification_status.Item.notification_subject.S"),
            },
            Body: {
              Text: {
                Data: sfn.JsonPath.format(
                  "ジョブID: {}\nレポート種別: {}\nPPTX: {}\n有効期限: {}",
                  sfn.JsonPath.stringAt("$.notification_status.Item.job_id.S"),
                  sfn.JsonPath.stringAt("$.notification_status.Item.report_type.S"),
                  sfn.JsonPath.stringAt("$.notification_status.Item.pptx_presigned_url.S"),
                  sfn.JsonPath.stringAt("$.notification_status.Item.pptx_presigned_url_expires_at.S"),
                ),
              },
            },
          },
        },
      },
      resultPath: sfn.JsonPath.DISCARD,
    });

    const createFetchNotificationStatusTask = (idSuffix: string) =>
      new tasks.DynamoGetItem(this, `Fetch${idSuffix}NotificationStatus`, {
        table: props.jobStateTable,
        key: {
          job_key: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt("$.job_key")),
        },
        resultPath: "$.notification_status",
      });

    const createNotifyFailureTask = (idSuffix: string) =>
      new tasks.CallAwsService(this, `NotifyFailure${idSuffix}`, {
        service: "sesv2",
        action: "sendEmail",
        iamResources: ["*"],
        parameters: {
          FromEmailAddress: senderEmail,
          Destination: {
            ToAddresses: sfn.JsonPath.listAt("$.notification_status.Item.notification_to.SS"),
          },
          Content: {
            Simple: {
              Subject: {
                Data: sfn.JsonPath.format(
                  "[FAILURE] {}",
                  sfn.JsonPath.stringAt("$.notification_status.Item.notification_subject.S"),
                ),
              },
              Body: {
                Text: {
                  Data: sfn.JsonPath.format(
                    "ジョブID: {}\\nレポート種別: {}\\nエラー: {}\\n詳細: {}",
                    sfn.JsonPath.stringAt("$.notification_status.Item.job_id.S"),
                    sfn.JsonPath.stringAt("$.notification_status.Item.report_type.S"),
                    sfn.JsonPath.stringAt("$.error.Error"),
                    sfn.JsonPath.stringAt("$.error.Cause"),
                  ),
                },
              },
            },
          },
        },
        resultPath: sfn.JsonPath.DISCARD,
      });

    const createSuccessNotificationChain = (idSuffix: string, analysisTask: tasks.EcsRunTask) =>
      analysisTask.next(createFetchNotificationStatusTask(`Success${idSuffix}`)).next(notifySuccess);

    const createFailureNotificationChain = (idSuffix: string) =>
      createFetchNotificationStatusTask(`AnalysisFailure${idSuffix}`).next(createNotifyFailureTask(idSuffix));

    const selectAnalysisTaskSize = new sfn.Choice(this, "SelectAnalysisTaskSize")
      .when(
        sfn.Condition.stringEquals("$.status.Item.task_size_profile.S", "small"),
        createSuccessNotificationChain("Small", runSmallAnalysis),
      )
      .when(
        sfn.Condition.stringEquals("$.status.Item.task_size_profile.S", "medium"),
        createSuccessNotificationChain("Medium", runMediumAnalysis),
      )
      .when(
        sfn.Condition.stringEquals("$.status.Item.task_size_profile.S", "large"),
        createSuccessNotificationChain("Large", runLargeAnalysis),
      )
      .otherwise(createSuccessNotificationChain("Max", runMaxAnalysis));

    const retryLimitReached = new sfn.Choice(this, "RetryLimitReached")
      .when(
        sfn.Condition.numberGreaterThanEquals("$.retry_count", props.config.maxRetries),
        fetchGiveUpNotificationStatus.next(notifyGiveUp),
      )
      .otherwise(runReadiness);

    const readinessBranch = new sfn.Choice(this, "InputsReady")
      .when(
        sfn.Condition.booleanEquals("$.status.Item.ready.BOOL", true),
        selectAnalysisTaskSize,
      )
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

    runReadiness.addCatch(fetchReadinessFailureNotificationStatus.next(notifyFailure), { resultPath: "$.error" });
    runSmallAnalysis.addCatch(createFailureNotificationChain("Small"), { resultPath: "$.error" });
    runMediumAnalysis.addCatch(createFailureNotificationChain("Medium"), { resultPath: "$.error" });
    runLargeAnalysis.addCatch(createFailureNotificationChain("Large"), { resultPath: "$.error" });
    runMaxAnalysis.addCatch(createFailureNotificationChain("Max"), { resultPath: "$.error" });
  }
}
