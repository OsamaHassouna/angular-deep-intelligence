import { SourceFile, SyntaxKind, Decorator, ObjectLiteralExpression, PropertyAssignment } from 'ts-morph';

export function getDecoratorByName(sourceFile: SourceFile, name: string): Decorator | undefined {
  for (const cls of sourceFile.getClasses()) {
    const decorator = cls.getDecorator(name);
    if (decorator) {
      return decorator;
    }
  }
  return undefined;
}

export function getDecoratorArgObject(decorator: Decorator): ObjectLiteralExpression | undefined {
  const args = decorator.getArguments();
  if (args.length === 0) {
    return undefined;
  }
  const first = args[0];
  if (first.getKind() === SyntaxKind.ObjectLiteralExpression) {
    return first as ObjectLiteralExpression;
  }
  return undefined;
}

export function getDecoratorProperty(decorator: Decorator, propertyName: string): PropertyAssignment | undefined {
  const obj = getDecoratorArgObject(decorator);
  if (!obj) {
    return undefined;
  }
  const prop = obj.getProperty(propertyName);
  if (prop && prop.getKind() === SyntaxKind.PropertyAssignment) {
    return prop as PropertyAssignment;
  }
  return undefined;
}

export function getDecoratorPropertyValue(decorator: Decorator, propertyName: string): string | undefined {
  const prop = getDecoratorProperty(decorator, propertyName);
  if (!prop) {
    return undefined;
  }
  return prop.getInitializer()?.getText();
}

export function hasMethod(sourceFile: SourceFile, methodName: string): boolean {
  for (const cls of sourceFile.getClasses()) {
    if (cls.getMethod(methodName)) {
      return true;
    }
  }
  return false;
}

export function getMethodBody(sourceFile: SourceFile, methodName: string): string | undefined {
  for (const cls of sourceFile.getClasses()) {
    const method = cls.getMethod(methodName);
    if (method) {
      return method.getBody()?.getText();
    }
  }
  return undefined;
}

export function hasPropertyWithType(sourceFile: SourceFile, typeName: string): boolean {
  for (const cls of sourceFile.getClasses()) {
    for (const prop of cls.getProperties()) {
      const typeText = prop.getType().getText();
      if (typeText.includes(typeName)) {
        return true;
      }
    }
  }
  return false;
}

export function getConstructorParams(sourceFile: SourceFile): Array<{ name: string; type: string }> {
  const params: Array<{ name: string; type: string }> = [];
  for (const cls of sourceFile.getClasses()) {
    const ctor = cls.getConstructors()[0];
    if (ctor) {
      for (const param of ctor.getParameters()) {
        params.push({
          name: param.getName(),
          type: param.getType().getText(),
        });
      }
    }
  }
  return params;
}
