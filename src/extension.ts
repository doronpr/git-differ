import * as vscode from "vscode";
import { newCompareWithBranch } from "./cmd/compareWithBranch";
import { newCompareWithCommit } from "./cmd/compareWithCommit";
import { newCompareWithMaster } from "./cmd/compareWithMaster";
import { API, GitExtension } from "./git";

export function activate(context: vscode.ExtensionContext) {
  const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git")!.exports;
  const gitApi: API = gitExtension.getAPI(1);

  const compareWithCommit = newCompareWithCommit(gitApi);
  const compareWithBranch = newCompareWithBranch(gitApi);
  const compareWithMaster = newCompareWithMaster(gitApi);

  context.subscriptions.push(compareWithBranch, compareWithCommit, compareWithMaster);
}

export function deactivate() {}
