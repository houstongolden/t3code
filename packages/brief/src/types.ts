import type { PrivateBriefState } from "./privateBrief.ts";
import type { ReviewedReference } from "./reviewLedger.ts";
/** Subset of the public you-md/v1 schema (you.md/<username>/you.json) that the brief reads. */
export interface YouProfile {
  readonly username?: string;
  readonly identity?: {
    readonly name?: string;
    readonly tagline?: string;
    readonly location?: string;
    readonly bio?: { readonly short?: string; readonly medium?: string; readonly long?: string };
  };
  readonly agent_directives?: {
    readonly communication_style?: string;
    readonly current_goal?: string;
    readonly decision_framework?: string;
    readonly default_stack?: string;
    readonly negative_prompts?: ReadonlyArray<string>;
  };
  readonly now?: { readonly focus?: ReadonlyArray<string>; readonly updated_at?: string };
  readonly projects?: ReadonlyArray<YouProject>;
  readonly goals?: ReadonlyArray<YouGoal>;
  readonly values?: ReadonlyArray<string>;
}

export interface YouProject {
  readonly memoryScope?: string;
  readonly name: string;
  readonly description?: string;
  readonly status?: string;
  readonly url?: string;
  /** Optional local hints: repo dir names or path fragments that map a cwd to this project. */
  readonly paths?: ReadonlyArray<string>;
  readonly northStar?: string;
}

export type GoalLevel = "personal" | "project" | "global";

export interface YouGoal {
  readonly title: string;
  readonly level: GoalLevel;
  readonly project?: string;
  readonly status?: string;
}

export interface SkillRef {
  readonly provenance?: "shared-skill-metadata" | "you-skill-metadata";
  readonly name: string;
  readonly description: string;
}

export type BriefSourceKind = "env-file" | "local-you" | "public-cache" | "cli-cache" | "fixture";

export interface BriefSources {
  readonly profile: YouProfile;
  readonly source: BriefSourceKind;
  readonly sourcePath: string;
  readonly skills: ReadonlyArray<SkillRef>;
}

export interface BriefInput {
  readonly privateBrief?: PrivateBriefState;
  readonly reviewedReferences?: ReadonlyArray<ReviewedReference>;
  readonly profile: YouProfile;
  readonly cwd?: string | null | undefined;
  readonly harness?: string;
  readonly skills?: ReadonlyArray<SkillRef>;
  readonly source?: BriefSourceKind;
}

export interface BriefResult {
  readonly privateStatus: PrivateBriefState["status"];
  readonly reviewedMemoryCount: number;
  readonly text: string;
  readonly bytes: number;
  readonly included: ReadonlyArray<string>;
  readonly truncated: ReadonlyArray<string>;
  readonly dropped: ReadonlyArray<string>;
  readonly activeProject?: string;
  readonly provenance: {
    readonly source: BriefSourceKind | "provided";
    readonly trust: "reference-only";
    readonly scope: "personal" | "project";
  };
}
