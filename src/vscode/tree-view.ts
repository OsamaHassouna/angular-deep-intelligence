import * as vscode from 'vscode';
import { AnalysisDiagnostic, RuleCategory, Severity } from '../analyzers/analyzer.types';
import { ProjectStats } from '../scanner/project-model';

type TreeItem = CategoryNode | RuleNode | DiagnosticNode | StatsNode;

export class AdiTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private diagnostics: AnalysisDiagnostic[] = [];
  private stats: ProjectStats | null = null;
  private healthScore = 0;

  update(diagnostics: AnalysisDiagnostic[], stats: ProjectStats, healthScore: number): void {
    this.diagnostics = diagnostics;
    this.stats = stats;
    this.healthScore = healthScore;
    this._onDidChangeTreeData.fire(null);
  }

  clear(): void {
    this.diagnostics = [];
    this.stats = null;
    this.healthScore = 0;
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      return this.getRootItems();
    }

    if (element instanceof CategoryNode) {
      return this.getRuleNodes(element.category);
    }

    if (element instanceof RuleNode) {
      return this.getDiagnosticNodes(element.ruleId);
    }

    return [];
  }

  private getRootItems(): TreeItem[] {
    if (!this.stats) {
      return [new StatsNode('No scan results. Run "ADI: Scan Project" to start.', '')];
    }

    const items: TreeItem[] = [];

    // Health score header
    const scoreIcon = this.healthScore >= 80 ? '$(pass)' : this.healthScore >= 50 ? '$(warning)' : '$(error)';
    items.push(new StatsNode(`${scoreIcon} Health Score: ${this.healthScore}/100`, ''));

    // Project stats
    items.push(new StatsNode(
      `$(file-code) ${this.stats.fileCount} files`,
      `${this.stats.componentCount} components, ${this.stats.serviceCount} services, ${this.stats.moduleCount} modules`
    ));

    // Categories with issue counts
    const categories = this.getCategoryCounts();
    for (const [category, count] of categories) {
      if (count > 0) {
        items.push(new CategoryNode(category, count));
      }
    }

    if (this.diagnostics.length === 0) {
      items.push(new StatsNode('$(check) No issues found!', ''));
    }

    return items;
  }

  private getCategoryCounts(): Map<RuleCategory, number> {
    const counts = new Map<RuleCategory, number>();
    for (const diag of this.diagnostics) {
      counts.set(diag.category, (counts.get(diag.category) || 0) + 1);
    }
    return counts;
  }

  private getRuleNodes(category: RuleCategory): TreeItem[] {
    const ruleMap = new Map<string, { name: string; count: number; severity: Severity }>();

    for (const diag of this.diagnostics) {
      if (diag.category !== category) continue;
      const existing = ruleMap.get(diag.ruleId);
      if (existing) {
        existing.count++;
      } else {
        ruleMap.set(diag.ruleId, {
          name: diag.ruleId,
          count: 1,
          severity: diag.severity,
        });
      }
    }

    return Array.from(ruleMap.entries()).map(
      ([ruleId, info]) => new RuleNode(ruleId, info.name, info.count, info.severity)
    );
  }

  private getDiagnosticNodes(ruleId: string): TreeItem[] {
    return this.diagnostics
      .filter(d => d.ruleId === ruleId)
      .slice(0, 50) // Cap at 50 per rule to keep the tree manageable
      .map(d => new DiagnosticNode(d));
  }
}

class StatsNode extends vscode.TreeItem {
  constructor(label: string, description: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
  }
}

class CategoryNode extends vscode.TreeItem {
  constructor(
    public readonly category: RuleCategory,
    count: number,
  ) {
    const icons: Record<RuleCategory, string> = {
      'anti-pattern': '$(bug)',
      'performance': '$(dashboard)',
      'migration': '$(arrow-up)',
      'architecture': '$(symbol-structure)',
    };
    const labels: Record<RuleCategory, string> = {
      'anti-pattern': 'Anti-Patterns',
      'performance': 'Performance',
      'migration': 'Migration',
      'architecture': 'Architecture',
    };

    super(`${icons[category]} ${labels[category]} (${count})`, vscode.TreeItemCollapsibleState.Expanded);
  }
}

class RuleNode extends vscode.TreeItem {
  constructor(
    public readonly ruleId: string,
    name: string,
    count: number,
    severity: Severity,
  ) {
    const severityIcon = severity === 'error' ? '$(error)' :
      severity === 'warning' ? '$(warning)' :
      severity === 'info' ? '$(info)' : '$(lightbulb)';

    super(`${severityIcon} ${name} (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `${count} occurrence${count > 1 ? 's' : ''} of ${name}`;
  }
}

class DiagnosticNode extends vscode.TreeItem {
  constructor(diagnostic: AnalysisDiagnostic) {
    const fileName = diagnostic.location.file.relativePath.split('/').pop() || '';
    super(fileName, vscode.TreeItemCollapsibleState.None);

    this.description = `Line ${diagnostic.location.line + 1}: ${diagnostic.message}`;
    this.tooltip = new vscode.MarkdownString(
      `**${diagnostic.ruleId}**\n\n${diagnostic.message}\n\n${diagnostic.suggestion || ''}`
    );

    // Click to navigate to the file and line
    const uri = vscode.Uri.parse(diagnostic.location.file.uri);
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [
        uri,
        {
          selection: new vscode.Range(
            diagnostic.location.line, diagnostic.location.column >= 0 ? diagnostic.location.column : 0,
            diagnostic.location.line, diagnostic.location.column >= 0 ? diagnostic.location.column + 20 : 80
          ),
        },
      ],
    };

    this.resourceUri = uri;
    this.iconPath = new vscode.ThemeIcon(
      diagnostic.severity === 'error' ? 'error' :
      diagnostic.severity === 'warning' ? 'warning' :
      'info'
    );
  }
}
