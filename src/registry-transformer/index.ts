import * as ts from 'typescript';
import * as path from 'path';

const dModulePath = ['@dojo/widget-core/d'];
const wPragma = 'w';
const prefix = '__autoRegistyItem_';
const registryBagName = '__autoRegistry';
const registryDecoratorModulePath = '@dojo/widget-core/decorators/registry';

const registryTransformer = function(this: { bundlePaths: string[] }, context: any) {
	const lazyPaths = this.bundlePaths;
	const registryBag: any = {};
	const moduleBag: any = {};

	let addedRegistryImport = false;
	let wName: string;
	let contextPath: string;
	let moduleIdentifier: ts.Expression;

	const visitor: any = (node: any) => {
		if (node.kind === ts.SyntaxKind.ImportDeclaration) {
			if (
				lazyPaths.indexOf(
					path.resolve(contextPath, node.moduleSpecifier.text).replace(`${process.cwd()}/`, '')
				) !== -1
			) {
				const importClause = node.importClause;
				if (importClause.name) {
					moduleBag[importClause.name.escapedText] = node.moduleSpecifier.text;
				} else if (importClause.namedBindings) {
					importClause.namedBindings.elements.forEach((element: any) => {
						moduleBag[element.name.escapedText] = node.moduleSpecifier.text;
					});
				}
			} else if (dModulePath.indexOf(node.moduleSpecifier.text) !== -1) {
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
		if (wName) {
			if (node.kind === ts.SyntaxKind.CallExpression) {
				if (node.expression.escapedText === wName && node.arguments && node.arguments.length) {
					const text = node.arguments[0].escapedText;
					if (moduleBag[text]) {
						node.arguments[0] = ts.createLiteral(`${prefix}${text}`);
						registryBag[text] = moduleBag[text];
						ts.updateCall(node, node.expression, node.typeArguments, node.arguments);
					}
				}
			} else if (node.kind === ts.SyntaxKind.ClassDeclaration && !addedRegistryImport) {
				const call = ts.createCall(ts.createPropertyAccess(moduleIdentifier, 'registry'), undefined, [
					ts.createIdentifier(registryBagName)
				]);
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
		contextPath = path.dirname(path.relative(process.cwd(), node.getSourceFile().fileName));
		const moduleSpecifier = ts.createLiteral(registryDecoratorModulePath);
		const importIdentifier = ts.createIdentifier('registry');
		const importSpecifier = ts.createImportSpecifier(undefined, importIdentifier);
		const namedImport = ts.createNamedImports([importSpecifier]);
		const importClause = ts.createImportClause(undefined, namedImport);
		const importDeclaration = ts.createImportDeclaration(undefined, undefined, importClause, moduleSpecifier);
		moduleIdentifier = ts.getGeneratedNameForNode(importDeclaration);

		let result = ts.visitNode(node, visitor);
		if (addedRegistryImport) {
			const registryItems = Object.keys(registryBag).map((registryLabel: string) => {
				const modulePath = registryBag[registryLabel];
				return ts.createPropertyAssignment(
					`'${prefix}${registryLabel}'`,
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

export default (bundlePaths: string[]) => registryTransformer.bind({ bundlePaths });
