import { readFile, writeFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { createHash } from "node:crypto";
import ts from "typescript";

const baselinePath = ".architecture-baseline.json";
const update = process.argv.includes("--update-baseline");
const controls = new Set(["input", "button", "select", "textarea", "label"]);
// Reviewed native controls that intentionally preserve existing mobile UI.
// These are component-owned adapters, not route-level controls.
const reviewedNativeAdapters = new Set([
  "src/components/composer.tsx:button",
  "src/components/pickers.tsx:input",
]);
const writes = new Set(["insert", "update", "delete", "upsert"]);
const printer = ts.createPrinter({ removeComments: true });
const findings = [];
const primitives = new Map();
const files = [];
for await (const file of glob("src/**/*.{ts,tsx}")) {
  if (file === "src/routeTree.gen.ts" || file === "src/integrations/supabase/types.ts") continue;
  files.push(file);
}
files.sort();
const sources = await Promise.all(
  files.map(async (file) => {
    const source = ts.createSourceFile(
      file,
      await readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    if (source.parseDiagnostics.length) throw new Error(`Cannot parse ${file}`);
    return { file, source };
  }),
);

// Exported component declarations in the registry define canonical names.
for (const { file, source } of sources) {
  if (!file.startsWith("src/components/ui/")) continue;
  const declared = new Set();
  const exported = new Set();
  for (const statement of source.statements) {
    const isExported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    const names = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.map((declaration) =>
          declaration.name.getText(source),
        )
      : ts.isFunctionDeclaration(statement) && statement.name
        ? [statement.name.text]
        : [];
    for (const name of names) {
      if (/^[A-Z]/.test(name)) {
        declared.add(name);
        if (isExported) exported.add(name);
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements)
        exported.add(element.propertyName?.text ?? element.name.text);
    }
  }
  for (const name of exported) {
    if (!declared.has(name)) continue;
    const owners = primitives.get(name) ?? new Set();
    owners.add(file);
    primitives.set(name, owners);
  }
}

for (const { file, source } of sources) {
  const route = file.startsWith("src/routes/") && file.endsWith(".tsx");
  const primitive = file.startsWith("src/components/ui/");
  const text = (node) => printer.printNode(ts.EmitHint.Unspecified, node, source);
  const add = (rule, node, detail) => {
    const fingerprint = createHash("sha256")
      .update(`${rule}:${file}:${text(node)}`)
      .digest("hex");
    findings.push({
      rule,
      file,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      fingerprint,
      detail,
    });
  };
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (controls.has(tag)) {
        if (route) add("route-native-control", node, `<${tag}> must be owned by a component`);
        else if (!primitive && !reviewedNativeAdapters.has(`${file}:${tag}`))
          add(
            "noncanonical-native-control",
            node,
            `<${tag}> must compose a canonical primitive or document a reviewed adapter`,
          );
      }
      if (route) {
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) continue;
          const name = attribute.name.getText(source);
          const ownedByComponent = node.attributes.properties.some(
            (property) =>
              ts.isJsxAttribute(property) &&
              property.name.getText(source) === "data-component-owned",
          );
          if ((name === "className" || name === "style") && !ownedByComponent)
            add("route-ui-style", attribute, "Use component variants instead of route styling");
          if (name.startsWith("on") && /^[a-z]/.test(tag))
            add("route-native-handler", attribute, "Move native UI handlers into components");
        }
      }
    }
    if (
      (ts.isVariableDeclaration(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
      const owners = primitives.get(node.name.text);
      if (owners && (owners.size > 1 || !owners.has(file)))
        add(
          "duplicate-primitive",
          node,
          `${node.name.text} is canonical in ${[...owners].join(", ")}`,
        );
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      writes.has(node.expression.name.text)
    ) {
      let receiver = node.expression.expression;
      while (ts.isCallExpression(receiver) && ts.isPropertyAccessExpression(receiver.expression)) {
        const method = receiver.expression;
        if (method.name.text === "from") {
          const client = method.expression.getText(source);
          if (
            !client.includes(".storage") &&
            /supabase/i.test(client) &&
            !file.startsWith("src/routes/api/")
          ) {
            add("direct-protected-write", node, "Use a data-layer SECURITY DEFINER RPC");
          }
          break;
        }
        receiver = method.expression;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

let baseline = [];
try {
  baseline = JSON.parse(await readFile(baselinePath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const counts = (items) => {
  const result = new Map();
  for (const item of items) result.set(item.fingerprint, (result.get(item.fingerprint) ?? 0) + 1);
  return result;
};
const remaining = counts(baseline);
const newFindings = findings.filter((finding) => {
  const count = remaining.get(finding.fingerprint) ?? 0;
  if (!count) return true;
  remaining.set(finding.fingerprint, count - 1);
  return false;
});
if (update) {
  await writeFile(baselinePath, `${JSON.stringify(findings, null, 2)}\n`);
  console.log(`Architecture baseline updated: ${findings.length} findings. Review every addition.`);
} else if (newFindings.length) {
  for (const finding of newFindings)
    console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.detail}`);
  console.error(`${newFindings.length} new architecture violations.`);
  process.exitCode = 1;
} else {
  console.log(
    `Architecture check passed: ${findings.length} existing findings, no new violations.`,
  );
  const removed = [...remaining.values()].reduce((sum, value) => sum + value, 0);
  if (removed) console.log(`Remove ${removed} obsolete baseline entries after cleanup.`);
}
