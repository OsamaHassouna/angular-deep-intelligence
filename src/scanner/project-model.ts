export type ArtifactType =
  | 'component'
  | 'directive'
  | 'pipe'
  | 'service'
  | 'module'
  | 'route'
  | 'template'
  | 'style'
  | 'source';

export interface FileImports {
  raw: string[];
  resolved: string[];
}

export interface AngularFile {
  relativePath: string;
  uri: string;
  extension: string;
  sizeBytes: number;
  lineCount: number;
  artifactType: ArtifactType;
  linkedTemplatePath: string | null;
  imports: FileImports;
  content: string;
}

export interface ProjectStats {
  fileCount: number;
  componentCount: number;
  serviceCount: number;
  routeCount: number;
  htmlCount: number;
  styleCount: number;
  pipeCount: number;
  directiveCount: number;
  moduleCount: number;
}

export interface ProjectIndex {
  rootPath: string;
  files: AngularFile[];
  fileMap: Map<string, AngularFile>;
  stats: ProjectStats;
  scannedAt: number;
}
