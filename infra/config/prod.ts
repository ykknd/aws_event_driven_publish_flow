import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import { createBaseConfig } from "./base";

export const prodConfig = {
  ...createBaseConfig("prod"),
  isProduction: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
  terminationProtection: true,
  logRetention: logs.RetentionDays.ONE_MONTH,
};

