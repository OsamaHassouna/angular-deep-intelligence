import * as vscode from 'vscode';

export interface AdiConfig {
  rules: {
    missingUnsubscribe: boolean;
    missingOnPush: boolean;
    oversizedComponent: boolean;
    directDomManipulation: boolean;
    templateMethodCalls: boolean;
    standaloneReadiness: boolean;
    signalsMigration: boolean;
    circularServiceDeps: boolean;
    lazyLoadingOpportunities: boolean;
    sharedModuleBloat: boolean;
  };
  oversizedThreshold: number;
  excludePaths: string[];
}

export function getConfig(): AdiConfig {
  const config = vscode.workspace.getConfiguration('adi');
  return {
    rules: {
      missingUnsubscribe: config.get<boolean>('rules.missingUnsubscribe', true),
      missingOnPush: config.get<boolean>('rules.missingOnPush', true),
      oversizedComponent: config.get<boolean>('rules.oversizedComponent', true),
      directDomManipulation: config.get<boolean>('rules.directDomManipulation', true),
      templateMethodCalls: config.get<boolean>('rules.templateMethodCalls', true),
      standaloneReadiness: config.get<boolean>('rules.standaloneReadiness', true),
      signalsMigration: config.get<boolean>('rules.signalsMigration', true),
      circularServiceDeps: config.get<boolean>('rules.circularServiceDeps', true),
      lazyLoadingOpportunities: config.get<boolean>('rules.lazyLoadingOpportunities', true),
      sharedModuleBloat: config.get<boolean>('rules.sharedModuleBloat', true),
    },
    oversizedThreshold: config.get<number>('oversizedThreshold', 300),
    excludePaths: config.get<string[]>('excludePaths', []),
  };
}
