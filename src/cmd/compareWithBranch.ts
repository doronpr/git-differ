import * as vscode from "vscode";
import { API, RefType } from "../git";

type Branch = {
  tags: (string | undefined)[];
  type: RefType;
  name?: string;
  commit?: string;
  remote?: string;
};

// Shared helper function to execute diff comparison
export async function executeDiffComparison(
  gitApi: API,
  uri: vscode.Uri,
  branchName: string
): Promise<void> {
  const gitUri = gitApi.toGitUri(uri, branchName);
  const filePath = uri.path.split("/").pop() || uri.path;

  await vscode.commands.executeCommand("vscode.diff", gitUri, uri, `${branchName} ↔ ${filePath}`);
}

// Helper function to find master or main branch automatically
export async function findMasterBranch(gitApi: API, uri: vscode.Uri): Promise<Branch | null> {
  try {
    // Get all local branches first
    const localBranches = await getBranches(gitApi, uri, false);

    // Look for master or main branch (in that order of preference)
    let masterBranch = localBranches.find((branch) => branch.name === "master");
    if (!masterBranch) {
      masterBranch = localBranches.find((branch) => branch.name === "main");
    }

    if (!masterBranch) {
      // If no local master/main, try remote branches
      const remoteBranches = await getBranches(gitApi, uri, true);
      masterBranch = remoteBranches.find(
        (branch) => branch.name === "origin/master" || branch.name === "origin/main"
      );
    }

    return masterBranch || null;
  } catch (error) {
    return null;
  }
}

export function newCompareWithBranch(gitApi: API): vscode.Disposable {
  return vscode.commands.registerCommand(
    "git-differ.compareWithBranch",
    async (uri: vscode.Uri | undefined) => {
      if (!uri) {
        uri = vscode.window.activeTextEditor?.document.uri;
      }
      if (!uri) {
        vscode.window.showErrorMessage("No file selected");
        return;
      }
      const localOnly = vscode.workspace
        .getConfiguration("git-differ")
        .get<boolean>("localOnly", false);
      const branches = await getBranches(gitApi, uri, !localOnly);

      const quickPickItems: vscode.QuickPickItem[] = genBranchQuickPickItems(branches, localOnly);

      const selectedBranch = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: "Select a branch to compare with",
      });

      if (!selectedBranch) {
        vscode.window.showErrorMessage("No branch selected");
        return;
      }

      const branch = branches.find((branch) => branch.name === selectedBranch.label);
      if (!branch) {
        vscode.window.showErrorMessage(`Branch not found: ${selectedBranch.label}`);
        return;
      }

      if (branch.name === undefined) {
        vscode.window.showErrorMessage(`Branch Name is undefined: ${selectedBranch.label}`);
        return;
      }

      try {
        await executeDiffComparison(gitApi, uri, branch.name);
      } catch (error) {
        vscode.window.showErrorMessage(`An error occurred: ${error}`);
      }
    }
  );
}

// UTILS

async function getBranches(gitApi: API, uri: vscode.Uri, remote: boolean): Promise<Branch[]> {
  const repo = gitApi.getRepository(uri);

  if (!repo) {
    vscode.window.showErrorMessage(`Repository not found for URI: ${uri.toString()}`);
    return [];
  }

  const branches = await repo.getBranches({ remote });

  const tags = await repo.getRefs({ pattern: "refs/tags/*" });

  const branchesWithTags = branches.map((branch) => {
    const branchTags = tags.filter((tag) => tag.commit === branch.commit);
    return {
      ...branch,
      tags: branchTags.map((tag) => tag.name),
    };
  });

  return branchesWithTags;
}

function genBranchQuickPickItems(branches: Branch[], localOnly: boolean): vscode.QuickPickItem[] {
  const localBranches = branches.filter((branch) => {
    if (!branch.remote) {
      return branch;
    }
  });

  const remoteBranches = branches.filter((branch) => {
    if (branch.remote) {
      return branch;
    }
  });

  const toQuickPickItems = (branches: Branch[], iconId: string): vscode.QuickPickItem[] => {
    return branches.map((branch) => {
      return {
        label: branch.name || "unknown",
        iconPath: new vscode.ThemeIcon(iconId),
        description: branch.tags.length ? `Tags: ${branch.tags.join(", ")}` : "",
      };
    });
  };

  const localBranchesItems = toQuickPickItems(localBranches, "git-branch");
  const remoteBranchesItems = toQuickPickItems(remoteBranches, "cloud");

  const divider = (label: string): vscode.QuickPickItem => {
    return {
      label,
      kind: -1,
    };
  };

  const dividerRemote = divider("remote branches");
  const dividerLocal = divider("local branches");

  if (localOnly) {
    return [dividerLocal, ...localBranchesItems];
  }

  return [dividerLocal, ...localBranchesItems, dividerRemote, ...remoteBranchesItems];
}
