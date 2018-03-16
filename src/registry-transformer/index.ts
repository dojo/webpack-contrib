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
	const registryBag: { [index: string]: string } = {};
	const moduleBag: { [index: string]: string } = {};
	const namedImportBag: { [index: string]: boolean } = {};
	let hasLazyModules = false;

	let addedRegistryImport = false;
	let wName: string;
	let contextPath: string;
	let moduleIdentifier: ts.Expression;

	const visitor: any = (node: any) => {
		if (node.kind === ts.SyntaxKind.ImportDeclaration) {
			const targetPath = path.resolve(contextPath, node.moduleSpecifier.text).replace(`${basePath}/`, '');
			// is the import a specified lazy module?
			if (lazyPaths.indexOf(targetPath) !== -1) {
				const importClause = node.importClause;
				const importPath = node.moduleSpecifier.text;
				// default import
				if (importClause.name) {
					moduleBag[importClause.name.escapedText] = importPath;
					// support a single named import also, anything else we can't elide
				} else if (importClause.namedBindings && importClause.namedBindings.elements.length === 1) {
					importClause.namedBindings.elements.forEach((element: any) => {
						moduleBag[element.name.escapedText] = importPath;
						namedImportBag[element.name.escapedText] = true;
					});
				}
				hasLazyModules = true;
				// is this the import of d? if so find the w pragma
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
		// if we found a pragma and we have lazy modules
		if (wName && hasLazyModules) {
			if (node.kind === ts.SyntaxKind.CallExpression) {
				// is this a w call
				if (node.expression.escapedText === wName && node.arguments && node.arguments.length) {
					const text = node.arguments[0].escapedText;
					// does it exist as a lazy module?
					if (moduleBag[text]) {
						node.arguments[0] = ts.createLiteral(`${registryItemPrefix}${text}`);
						// add to registry object for later
						registryBag[text] = moduleBag[text];
						// turn first arg of w call from widget class into generated string
						ts.updateCall(node, node.expression, node.typeArguments, node.arguments);
					}
				}
			} else if (node.kind === ts.SyntaxKind.ClassDeclaration && !addedRegistryImport) {
				let call;
				// a bit hacky but, if we are a non es module, make a property access in lieu of a named import
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
			// create a registry object with the keys and import of the module itself
			const registryItems = Object.keys(registryBag).map((registryLabel) => {
				const modulePath = registryBag[registryLabel];
				let importCall;
				if (namedImportBag[registryLabel]) {
					importCall = ts.createCall(
						ts.createPropertyAccess(
							ts.createCall(
								(ts as any).createSignatureDeclaration(ts.SyntaxKind.ImportKeyword),
								undefined,
								[ts.createLiteral(`${modulePath}`)]
							),
							ts.createIdentifier('then')
						),
						undefined,
						[
							ts.createArrowFunction(
								undefined,
								undefined,
								[ts.createParameter(undefined, undefined, undefined, ts.createIdentifier('module'))],
								undefined,
								undefined,
								ts.createPropertyAccess(
									ts.createIdentifier('module'),
									ts.createIdentifier(registryLabel)
								)
							)
						]
					);
				} else {
					importCall = ts.createCall(
						(ts as any).createSignatureDeclaration(ts.SyntaxKind.ImportKeyword),
						undefined,
						[ts.createLiteral(`${modulePath}`)]
					);
				}
				return ts.createPropertyAssignment(
					`'${registryItemPrefix}${registryLabel}'`,
					ts.createArrowFunction(undefined, undefined, [], undefined, undefined, importCall)
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
			const importsToRemove = Object.keys(registryBag).map((key) => registryBag[key]);
			// remove any imports that we have moved to the registry
			const filteredStatements = result.statements.filter((statement: any) => {
				if (
					statement.kind === ts.SyntaxKind.ImportDeclaration &&
					importsToRemove.indexOf(statement.moduleSpecifier.text) !== -1
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
