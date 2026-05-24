import { prodConfig } from "./prod";
import { stagingConfig } from "./staging";
import { AppConfig, Stage } from "./types";

const SUPPORTED_STAGES: Stage[] = ["staging", "prod"];

export function resolveConfig(inputStage?: string): AppConfig {
  const stage = (inputStage ?? "staging") as Stage;
  if (!SUPPORTED_STAGES.includes(stage)) {
    throw new Error(`Unsupported stage '${inputStage}'. Expected one of: ${SUPPORTED_STAGES.join(", ")}`);
  }

  return stage === "prod" ? prodConfig : stagingConfig;
}

export type { AppConfig, Stage, TaskSizeProfile, TaskSizeProfileName } from "./types";
