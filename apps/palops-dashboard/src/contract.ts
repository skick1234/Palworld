export type HttpMethod = "GET" | "POST" | "PUT";

export type ContractOperation = {
  method: HttpMethod;
  operationId: string;
  pathTemplate: string;
  mutation: boolean;
  summary: string;
};

type OpenApiReference = { $ref?: string };
type OpenApiOperation = {
  operationId?: string;
  summary?: string;
  parameters?: OpenApiReference[];
};
type OpenApiPathItem = OpenApiReference & Partial<Record<"get" | "post" | "put", OpenApiOperation>>;
type OpenApiDocument = {
  paths?: Record<string, OpenApiPathItem>;
  components?: { pathItems?: Record<string, OpenApiPathItem> };
};

function resolvePathItem(document: OpenApiDocument, pathItem: OpenApiPathItem): OpenApiPathItem {
  if (!pathItem.$ref) return pathItem;
  const name = pathItem.$ref.split("/").at(-1);
  return (name && document.components?.pathItems?.[name]) ?? {};
}

export function readOperations(document: OpenApiDocument): ContractOperation[] {
  const operations: ContractOperation[] = [];
  for (const [pathTemplate, pathItem] of Object.entries(document.paths ?? {})) {
    const resolved = resolvePathItem(document, pathItem);
    for (const method of ["get", "post", "put"] as const) {
      const operation = resolved[method];
      const operationId = operation?.operationId;
      if (!operationId) continue;
      operations.push({
        method: method.toUpperCase() as HttpMethod,
        operationId,
        pathTemplate,
        mutation: operation.parameters?.some((parameter) => parameter.$ref?.endsWith("/IdempotencyKey")) ?? false,
        summary: operation.summary ?? operationId,
      });
    }
  }
  return operations.sort((left, right) => {
    const dynamic = (value: string) => segments(value).filter((part) => part.startsWith("{")).length;
    return dynamic(left.pathTemplate) - dynamic(right.pathTemplate);
  });
}

function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export function matchOperation(operations: ContractOperation[], method: string, pathname: string): ContractOperation | null {
  const actual = segments(pathname);
  for (const operation of operations) {
    if (operation.method !== method) continue;
    const template = segments(operation.pathTemplate);
    if (template.length !== actual.length) continue;
    if (template.every((part, index) => (part.startsWith("{") && part.endsWith("}")) || part === actual[index])) return operation;
  }
  return null;
}
