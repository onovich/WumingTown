export type WorkspacePackageKind = "app" | "package" | "tool";

export interface WorkspaceSmoke {
  readonly kind: WorkspacePackageKind;
  readonly packageName: string;
  readonly readiness: "skeleton";
}

export function defineWorkspaceSmoke(
  packageName: string,
  kind: WorkspacePackageKind,
): WorkspaceSmoke {
  return {
    kind,
    packageName,
    readiness: "skeleton",
  };
}
