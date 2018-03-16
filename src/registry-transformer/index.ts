import * as ts from 'typescript';
import * as path from 'path';

const dModulePath = '@dojo/widget-core/d';
const wPragma = 'w';
const registryItemPrefix = '__autoRegistryItem_';
const registryBagName = '__autoRegistryItems';
const registryDecoratorNamedImport = 'registry';
const registryDecoratorNamedImportAlias = '__autoRegistry';
const registryDecoratorModulePath = '@dojo/widget-core/decorators/registry';

const registryTransformer = function(this: { basePath: string; bundlePaths: string[] }, context: any) {
	const lazyPaths = this.bundlePaths;
	const basePath = this.basePath;
	const opts = context.getCompilerOptions();
	const { module } = opts;
	const registryBag: any = {};
	const moduleBag: any = {};
	let hasLazyModules = false;

	let addedRegistryImport = false;
	let wName: string;
	let contextPath: string;
	let moduleIdentifier: ts.Expression;

	const visitor: any = (node: any) => {
		if (node.kind === ts.SyntaxKind.ImportDeclaration) {
			const targetPath = path.resolve(contextPath, node.moduleSpecifier.text).replace(`${basePath}/`, '');
			if (lazyPaths.indexOf(targetPath) !== -1) {
				const importClause = node.importClause;
				const importPath = node.moduleSpecifier.text;
				if (importClause.name) {
					moduleBag[importClause.name.escapedText] = importPath;
				} else if (importClause.namedBindings) {
					importClause.namedBindings.elements.forEach((element: any) => {
						moduleBag[element.name.escapedText] = importPath;
					});
				}
				hasLazyModules = true;
			} else if (dModulePath === node.moduleSpecifier.text) {
				const namedBindings = node.importClause.namedBindings;
				if (namedBindings) {
					namedBindings.elements.forEach((element: any) => {
						if (
							element.name.escapedText === wPragma ||
							(element.propertyName && element.propertyName.escapedText === wPragma)
						) {
							wName = element.name.escapedText;
						}
					});
				}
			}
		}
		if (wName && hasLazyModules) {
			if (node.kind === ts.SyntaxKind.CallExpression) {
				if (node.expression.escapedText === wName && node.arguments && node.arguments.length) {
					const text = node.arguments[0].escapedText;
					if (moduleBag[text]) {
						node.arguments[0] = ts.createLiteral(`${registryItemPrefix}${text}`);
						registryBag[text] = moduleBag[text];
						ts.updateCall(node, node.expression, node.typeArguments, node.arguments);
					}
				}
			} else if (node.kind === ts.SyntaxKind.ClassDeclaration && !addedRegistryImport) {
				let call;
				if (module === ts.ModuleKind.CommonJS || module === ts.ModuleKind.AMD) {
					call = ts.createCall(
						ts.createPropertyAccess(moduleIdentifier, registryDecoratorNamedImport),
						undefined,
						[ts.createIdentifier(registryBagName)]
					);
				} else {
					call = ts.createCall(moduleIdentifier, undefined, [ts.createIdentifier(registryBagName)]);
				}
				const dec = ts.createDecorator(call);

				node = ts.updateClassDeclaration(
					node,
					[dec, ...(node.decorators || [])],
					node.modifiers,
					node.name,
					node.typeParameters,
					node.heritageClauses,
					node.members
				);
				addedRegistryImport = true;
			}
		}
		return ts.visitEachChild(node, visitor, context);
	};

	return function(node: any) {
		contextPath = path.dirname(path.relative(basePath, node.getSourceFile().fileName));
		const moduleSpecifier = ts.createLiteral(registryDecoratorModulePath);
		const importIdentifier = ts.createIdentifier(registryDecoratorNamedImport);
		const aliasIdentifier = ts.createIdentifier(registryDecoratorNamedImportAlias);
		const importSpecifier = ts.createImportSpecifier(importIdentifier, aliasIdentifier);
		const namedImport = ts.createNamedImports([importSpecifier]);
		const importClause = ts.createImportClause(undefined, namedImport);
		const importDeclaration = ts.createImportDeclaration(undefined, undefined, importClause, moduleSpecifier);
		if (module === ts.ModuleKind.CommonJS || module === ts.ModuleKind.AMD) {
			moduleIdentifier = ts.getGeneratedNameForNode(importDeclaration);
		} else {
			moduleIdentifier = importSpecifier.name;
		}

		let result = ts.visitNode(node, visitor);
		if (addedRegistryImport) {
			const registryItems = Object.keys(registryBag).map((registryLabel: string) => {
				const modulePath = registryBag[registryLabel];
				return ts.createPropertyAssignment(
					`'${registryItemPrefix}${registryLabel}'`,
					ts.createArrowFunction(
						undefined,
						undefined,
						[],
						undefined,
						undefined,
						ts.createCall((ts as any).createSignatureDeclaration(ts.SyntaxKind.ImportKeyword), undefined, [
							ts.createLiteral(`${modulePath}`)
						])
					)
				);
			});
			const registryStatement = ts.createVariableStatement(
				undefined,
				ts.createVariableDeclarationList([
					ts.createVariableDeclaration(
						registryBagName,
						undefined,
						ts.createObjectLiteral(registryItems, false)
					)
				])
			);
			const values = Object.keys(registryBag).map((key: string) => registryBag[key]);
			const filteredStatements = result.statements.filter((statement: any) => {
				if (
					statement.kind === ts.SyntaxKind.ImportDeclaration &&
					values.indexOf(statement.moduleSpecifier.text) !== -1
				) {
					return false;
				}
				return true;
			});
			result = ts.updateSourceFileNode(result, [importDeclaration, registryStatement, ...filteredStatements]);
		}
		return result;
	};
};

export default (basePath: string, bundlePaths: string[]) => registryTransformer.bind({ bundlePaths, basePath });
