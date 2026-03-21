import * as vscode from 'vscode';
import { DependencyGraph } from './dependency-extractor';

const D3_CDN = 'https://d3js.org/d3.v7.min.js';

export class DependencyGraphPanel {
  private static currentPanel: DependencyGraphPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposed = false;

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.onDidDispose(() => {
      this.disposed = true;
      DependencyGraphPanel.currentPanel = undefined;
    });
  }

  static show(graph: DependencyGraph): DependencyGraphPanel {
    // Reuse existing panel if open
    if (DependencyGraphPanel.currentPanel && !DependencyGraphPanel.currentPanel.disposed) {
      DependencyGraphPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      DependencyGraphPanel.currentPanel.update(graph);
      return DependencyGraphPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'adiDependencyGraph',
      'ADI: Dependency Graph',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    const instance = new DependencyGraphPanel(panel);
    instance.update(graph);

    // Handle messages from webview (file open requests)
    panel.webview.onDidReceiveMessage(message => {
      if (message.command === 'openFile' && message.uri) {
        const uri = vscode.Uri.parse(message.uri);
        vscode.window.showTextDocument(uri);
      }
    });

    DependencyGraphPanel.currentPanel = instance;
    return instance;
  }

  update(graph: DependencyGraph): void {
    this.panel.webview.html = buildHtml(graph);
  }
}

function buildHtml(graph: DependencyGraph): string {
  const graphJson = JSON.stringify({
    nodes: graph.nodes,
    edges: graph.edges,
    circularChains: graph.circularChains,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${D3_CDN}; style-src 'unsafe-inline';">
  <title>ADI Dependency Graph</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-foreground, #ccc);
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
      overflow: hidden;
    }

    #toolbar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 36px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      background: var(--vscode-sideBar-background, #252526);
      border-bottom: 1px solid var(--vscode-panel-border, #333);
      font-size: 13px;
    }
    #toolbar .stats {
      opacity: 0.7;
      margin-left: auto;
    }
    #toolbar button {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      border: none;
      padding: 4px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    #toolbar button:hover {
      background: var(--vscode-button-hoverBackground, #1177bb);
    }

    #legend {
      position: absolute;
      bottom: 12px;
      left: 12px;
      z-index: 10;
      background: var(--vscode-sideBar-background, #252526);
      border: 1px solid var(--vscode-panel-border, #333);
      border-radius: 4px;
      padding: 10px 14px;
      font-size: 12px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    #tooltip {
      position: absolute;
      display: none;
      background: var(--vscode-editorHoverWidget-background, #2d2d2d);
      border: 1px solid var(--vscode-editorHoverWidget-border, #454545);
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 12px;
      pointer-events: none;
      z-index: 20;
      max-width: 300px;
    }
    #tooltip .tt-name { font-weight: bold; margin-bottom: 4px; }
    #tooltip .tt-type { opacity: 0.7; }
    #tooltip .tt-path { opacity: 0.6; font-size: 11px; margin-top: 2px; }

    #graph-container {
      position: absolute;
      top: 36px;
      left: 0;
      right: 0;
      bottom: 0;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .node-label {
      fill: var(--vscode-foreground, #ccc);
      font-size: 11px;
      pointer-events: none;
      text-anchor: middle;
    }

    .edge {
      stroke-opacity: 0.4;
      fill: none;
    }
    .edge.circular {
      stroke-opacity: 0.9;
    }

    .edge-arrow {
      fill-opacity: 0.4;
    }
    .edge-arrow.circular {
      fill-opacity: 0.9;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <strong>ADI Dependency Graph</strong>
    <button id="btn-zoom-fit" title="Fit graph to viewport">Fit View</button>
    <button id="btn-zoom-in" title="Zoom in">+</button>
    <button id="btn-zoom-out" title="Zoom out">-</button>
    <span class="stats" id="stats"></span>
  </div>

  <div id="legend">
    <div class="legend-item"><span class="legend-dot" style="background:#4fc3f7"></span> Component</div>
    <div class="legend-item"><span class="legend-dot" style="background:#81c784"></span> Service</div>
    <div class="legend-item"><span class="legend-dot" style="background:#ce93d8"></span> Module</div>
    <div class="legend-item"><span class="legend-dot" style="background:#ffb74d"></span> Directive</div>
    <div class="legend-item"><span class="legend-dot" style="background:#fff176"></span> Pipe</div>
    <div class="legend-item" style="margin-top:6px">
      <svg width="30" height="12"><line x1="0" y1="6" x2="30" y2="6" stroke="#ef5350" stroke-width="2.5" stroke-dasharray="4,2"/></svg>
      Circular dependency
    </div>
  </div>

  <div id="tooltip">
    <div class="tt-name"></div>
    <div class="tt-type"></div>
    <div class="tt-path"></div>
  </div>

  <div id="graph-container">
    <svg id="graph"></svg>
  </div>

  <script src="${D3_CDN}"></script>
  <script>
    const vscode = acquireVsCodeApi();
    const data = ${graphJson};

    const nodeColors = {
      component: '#4fc3f7',
      service: '#81c784',
      module: '#ce93d8',
      directive: '#ffb74d',
      pipe: '#fff176',
    };

    const nodeRadius = (d) => {
      const base = 8;
      const deps = data.edges.filter(e =>
        (e.source.id || e.source) === d.id || (e.target.id || e.target) === d.id
      ).length;
      return base + Math.min(deps * 1.5, 16);
    };

    // Stats
    document.getElementById('stats').textContent =
      data.nodes.length + ' nodes, ' + data.edges.length + ' edges' +
      (data.circularChains.length > 0 ? ', ' + data.circularChains.length + ' circular chain(s)' : '');

    // SVG setup - use the container dimensions, not window
    const container = document.getElementById('graph-container');
    const svg = d3.select('#graph');
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || (window.innerHeight - 36);

    // Spread nodes randomly across the viewport to avoid initial clump
    const nodeCount = data.nodes.length;
    const spread = Math.sqrt(nodeCount) * 40;
    data.nodes.forEach(n => {
      n.x = width / 2 + (Math.random() - 0.5) * spread;
      n.y = height / 2 + (Math.random() - 0.5) * spread;
    });

    // Arrow markers
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('class', 'edge-arrow')
      .attr('fill', '#888');

    defs.append('marker')
      .attr('id', 'arrow-circular')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('class', 'edge-arrow circular')
      .attr('fill', '#ef5350');

    // Zoom container
    const g = svg.append('g');

    const zoom = d3.zoom()
      .scaleExtent([0.05, 6])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // Scale forces based on graph size
    const chargeStrength = Math.min(-200, -800 - nodeCount * 5);
    const linkDistance = Math.max(80, 60 + nodeCount * 0.5);

    // Force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.edges).id(d => d.id).distance(linkDistance))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35))
      .force('x', d3.forceX(width / 2).strength(0.03))
      .force('y', d3.forceY(height / 2).strength(0.03));

    // Edges
    const link = g.append('g')
      .selectAll('line')
      .data(data.edges)
      .enter()
      .append('line')
      .attr('class', d => 'edge' + (d.isCircular ? ' circular' : ''))
      .attr('stroke', d => d.isCircular ? '#ef5350' : '#666')
      .attr('stroke-width', d => d.isCircular ? 2.5 : 1.2)
      .attr('stroke-dasharray', d => d.isCircular ? '6,3' : 'none')
      .attr('marker-end', d => d.isCircular ? 'url(#arrow-circular)' : 'url(#arrow)');

    // Nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(data.nodes)
      .enter()
      .append('circle')
      .attr('r', nodeRadius)
      .attr('fill', d => nodeColors[d.type] || '#999')
      .attr('stroke', '#222')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragStart)
        .on('drag', dragging)
        .on('end', dragEnd));

    // Labels
    const label = g.append('g')
      .selectAll('text')
      .data(data.nodes)
      .enter()
      .append('text')
      .attr('class', 'node-label')
      .attr('dy', d => nodeRadius(d) + 14)
      .text(d => shortenLabel(d.label));

    // Tooltip
    const tooltip = document.getElementById('tooltip');
    node
      .on('mouseover', (event, d) => {
        tooltip.style.display = 'block';
        tooltip.querySelector('.tt-name').textContent = d.label;
        tooltip.querySelector('.tt-type').textContent = d.type;
        tooltip.querySelector('.tt-path').textContent = d.filePath;
      })
      .on('mousemove', (event) => {
        tooltip.style.left = (event.clientX + 12) + 'px';
        tooltip.style.top = (event.clientY - 8) + 'px';
      })
      .on('mouseout', () => {
        tooltip.style.display = 'none';
      })
      .on('dblclick', (event, d) => {
        vscode.postMessage({ command: 'openFile', uri: d.fileUri });
      });

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

    // Drag handlers
    function dragStart(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragging(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragEnd(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Fit-to-viewport helper
    function fitToView(animate) {
      const bounds = g.node().getBBox();
      if (bounds.width === 0 || bounds.height === 0) return;
      const pad = 80;
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      const scale = Math.min(
        (w - pad * 2) / bounds.width,
        (h - pad * 2) / bounds.height,
        2
      );
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const tx = w / 2 - cx * scale;
      const ty = h / 2 - cy * scale;
      const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
      if (animate) {
        svg.transition().duration(500).call(zoom.transform, transform);
      } else {
        svg.call(zoom.transform, transform);
      }
    }

    // Toolbar actions
    document.getElementById('btn-zoom-fit').addEventListener('click', () => {
      fitToView(true);
    });
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      svg.transition().duration(300).call(zoom.scaleBy, 1.5);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      svg.transition().duration(300).call(zoom.scaleBy, 0.67);
    });

    function shortenLabel(name) {
      return name
        .replace(/Component$/, '')
        .replace(/Service$/, 'Svc')
        .replace(/Module$/, 'Mod')
        .replace(/Directive$/, 'Dir');
    }

    // Auto-fit: once early (so user sees something), and again when settled
    let hasFitEarly = false;
    simulation.on('tick.fit', () => {
      if (!hasFitEarly && simulation.alpha() < 0.5) {
        hasFitEarly = true;
        fitToView(false);
      }
    });

    simulation.on('end', () => {
      fitToView(true);
    });
  </script>
</body>
</html>`;
}
