import { SourceFile } from 'ts-morph';
import { ArtifactType } from './project-model';

export function classifyArtifact(relativePath: string, sourceFile: SourceFile | null): ArtifactType {
  if (relativePath.endsWith('.html')) {
    return 'template';
  }

  if (relativePath.endsWith('.scss') || relativePath.endsWith('.css')) {
    return 'style';
  }

  // Route detection by filename (before AST check so it works without sourceFile)
  if (
    relativePath.endsWith('.routing.ts') ||
    relativePath.endsWith('-routing.module.ts') ||
    relativePath.endsWith('.routes.ts') ||
    relativePath.endsWith('app-routing.module.ts')
  ) {
    return 'route';
  }

  if (!sourceFile) {
    return 'source';
  }

  // AST-based classification: check decorators on classes
  for (const cls of sourceFile.getClasses()) {
    if (cls.getDecorator('Component')) {
      return 'component';
    }
    if (cls.getDecorator('Directive')) {
      return 'directive';
    }
    if (cls.getDecorator('Pipe')) {
      return 'pipe';
    }
    if (cls.getDecorator('NgModule')) {
      return 'module';
    }
    if (cls.getDecorator('Injectable')) {
      return 'service';
    }
  }

  // Fallback: filename conventions (for files without class decorators)
  if (relativePath.endsWith('.component.ts')) {
    return 'component';
  }
  if (relativePath.endsWith('.directive.ts')) {
    return 'directive';
  }
  if (relativePath.endsWith('.pipe.ts')) {
    return 'pipe';
  }
  if (relativePath.endsWith('.service.ts')) {
    return 'service';
  }
  if (relativePath.endsWith('.module.ts')) {
    return 'module';
  }

  // Check for route-related content in AST
  const fullText = sourceFile.getFullText();
  if (fullText.includes('provideRouter') || /:\s*Routes\b/.test(fullText)) {
    return 'route';
  }

  return 'source';
}
