import * as ts from 'typescript';
import * as path from 'path';
import * as minimatch from 'minimatch';
const shared = require('./shared');

const dImportPath = '@dojo/framework/core/vdom';
const wPragma = 'w';
const fakeComponentName = 'Loadable__';
const routeImportPath = '@dojo/framework/routing/Route';
const outletImportPath = '@dojo/framework/routing/Outlet';
const routeRendererName = 'renderer';
const routeIdName = 'id';
const routeName = 'Route';
const outletName = 'Outlet';

interface VisitorOptions {
	context: ts.TransformationContext;
	root: ts.SourceFile;
	contextPath: string;
	basePath: string;
	bundlePaths: string[];
	legacyModule: boolean;
	all: boolean;
	routes: string[];
	sync: boolean;
}

const {
	createSignatureDeclaration,
	createCall,
	createLiteral,
	createToken,
	createCallExpression,
	createStringLiteral
} =
	(ts as any).factory || ts;

function createArrowFuncForDefaultImport(modulePath: string) {
	if (createSignatureDeclaration) {
		return createCall(createSignatureDeclaration(ts.SyntaxKind.ImportKeyword), undefined, [
			createLiteral(`${modulePath}`)
		]);
	}
	return createCallExpression(createToken(ts.SyntaxKind.ImportKeyword), undefined, [
		createStringLiteral(`${modulePath}`)
	]);
}

class Visitor {
	private context: ts.TransformationContext;
	private contextPath: string;
	private basePath: string;
	private bundlePaths: string[];
	private wPragma: undefined | string;
	private routeName: undefined | string;
	private outletName: undefined | string;
	private modulesMap = new Map<string, string>();
	private ctorCountMap = new Map<string, number>();
	private needsLoadable = false;
	private all = false;
	private routes: string[] = [];
	private registryItems: any = {};
	private sync = false;

	constructor(options: VisitorOptions) {
		this.context = options.context;
		this.contextPath = options.contextPath;
		this.bundlePaths = options.bundlePaths;
		this.basePath = options.basePath;
		this.all = options.all;
		this.routes = options.routes;
		this.sync = options.sync;
	}

	public visit(node: ts.Node): any {
		if (ts.isImportDeclaration(node)) {
			const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
			if (importPath.match(/^(\.|\.\.)/)) {
				this.setLazyImport(node);
			} else if (dImportPath === importPath) {
				this.setWPragma(node);
			} else if (routeImportPath === importPath) {
				this.setRouteName(node);
			} else if (outletImportPath === importPath) {
				this.setOutletName(node);
			}
		}

		if (this.isWCall(node)) {
			const text = node.arguments[0].getText();
			if (this.modulesMap.get(text)) {
				node = this.replaceWidgetClassWithString(node);
			}
		}

		if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
			node = this.replaceTSXElementWithLoadable(node);
		}
		return ts.visitEachChild(node, this.visit.bind(this), this.context);
	}

	public end(node: ts.SourceFile) {
		let statements = [...node.statements];

		if (Object.keys(this.registryItems).length) {
			const registryItems = Object.keys(this.registryItems).map((label) => {
				const modulePath = this.registryItems[label];
				if (!this.sync) {
					const importCall = createArrowFuncForDefaultImport(modulePath);
					return ts.createPropertyAssignment(
						label,
						ts.createArrowFunction(undefined, undefined, [], undefined, undefined, importCall)
					);
				}
				return ts.createPropertyAssignment(label, ts.createIdentifier(label));
			});

			const registryStmt = ts.createVariableStatement(
				undefined,
				ts.createVariableDeclarationList([
					ts.createVariableDeclaration(
						'__autoRegistryItems',
						undefined,
						ts.createObjectLiteral(registryItems, false)
					)
				])
			);

			let index = 0;
			for (let i = 0; i < statements.length; i++) {
				if (!ts.isImportDeclaration(statements[i])) {
					index = i;
					break;
				}
			}

			statements.splice(index, 0, registryStmt);
			if (!this.sync) {
				statements = this.removeImportStatements(statements);
			}
		}

		if (this.needsLoadable) {
			const obj = ts.createObjectLiteral([
				ts.createPropertyAssignment(ts.createIdentifier('type'), ts.createLiteral('registry'))
			]);
			const decl = ts.createVariableDeclaration(fakeComponentName, undefined, obj);
			const stmt = ts.createVariableStatement(undefined, [decl]);

			let index = 0;
			for (let i = 0; i < statements.length; i++) {
				if (!ts.isImportDeclaration(statements[i])) {
					index = i;
					break;
				}
			}

			statements.splice(index, 0, stmt);
		}

		return ts.updateSourceFileNode(node, [...statements]);
	}

	private setLazyImport(node: ts.ImportDeclaration) {
		const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
		const importClause = node.importClause;
		if (importClause && importClause.name && importClause.name.text) {
			this.modulesMap.set(importClause.name.text, importPath);
		}
	}

	private setRouteName(node: ts.ImportDeclaration) {
		if (node.importClause) {
			const importClause = node.importClause;
			if (importClause && importClause.name && importClause.name.text) {
				this.routeName = importClause.name.text;
			} else if (importClause.namedBindings) {
				const namedBindings = importClause.namedBindings as ts.NamedImports;
				namedBindings.elements.some((element: ts.ImportSpecifier) => {
					const text = element.name.getText();
					if (
						text === routeName ||
						(element.propertyName && element.propertyName.escapedText === routeName)
					) {
						this.routeName = text;
						return true;
					}
					return false;
				});
			}
		}
	}

	private setOutletName(node: ts.ImportDeclaration) {
		if (node.importClause) {
			const importClause = node.importClause;
			if (importClause && importClause.name && importClause.name.text) {
				this.outletName = importClause.name.text;
			} else if (importClause.namedBindings) {
				const namedBindings = importClause.namedBindings as ts.NamedImports;
				namedBindings.elements.some((element: ts.ImportSpecifier) => {
					const text = element.name.getText();
					if (
						text === outletName ||
						(element.propertyName && element.propertyName.escapedText === outletName)
					) {
						this.outletName = text;
						return true;
					}
					return false;
				});
			}
		}
	}

	private setWPragma(node: ts.ImportDeclaration) {
		if (node.importClause) {
			const namedBindings = node.importClause.namedBindings as ts.NamedImports;
			if (namedBindings) {
				namedBindings.elements.some((element: ts.ImportSpecifier) => {
					const text = element.name.getText();
					if (text === wPragma || (element.propertyName && element.propertyName.escapedText === wPragma)) {
						this.wPragma = text;
						return true;
					}
					return false;
				});
			}
		}
	}

	private replaceTSXElementWithLoadable(inputNode: ts.JsxSelfClosingElement | ts.JsxElement) {
		let node: ts.JsxOpeningLikeElement;
		if (ts.isJsxElement(inputNode)) {
			node = inputNode.openingElement;
		} else {
			node = inputNode;
		}
		const text = node.tagName.getText();
		const importPath = this.modulesMap.get(text) as string;
		this.ctorCountMap.set(text, (this.ctorCountMap.get(text) || 0) + 1);
		if (importPath) {
			const targetPath = path.posix
				.resolve(this.contextPath, importPath)
				.replace(`${this.basePath}${path.posix.sep}`, '');

			this.log(text, targetPath);
			let routeName = this.routeName ? this.getRouteName(node) : undefined;
			if (!routeName && this.outletName) {
				routeName = this.getOutletRouteName(node);
			}
			if (
				this.all ||
				this.bundlePaths.indexOf(targetPath) !== -1 ||
				this.bundlePaths.some((bundlePattern) => minimatch(targetPath, bundlePattern)) ||
				(routeName && this.routes.indexOf(routeName) !== -1)
			) {
				this.registryItems[text] = this.modulesMap.get(text) as string;
				const registryItem = ts.createPropertyAccess(
					ts.createIdentifier('__autoRegistryItems'),
					ts.createIdentifier(text)
				);
				const registryExpr = ts.createObjectLiteral([
					ts.createPropertyAssignment(
						ts.createIdentifier('label'),
						ts.createLiteral(`__autoRegistryItem_${text}`)
					),
					ts.createPropertyAssignment(ts.createIdentifier('registryItem'), registryItem)
				]);
				const registryAttribute = ts.createJsxAttribute(
					ts.createIdentifier('__autoRegistryItem'),
					ts.createJsxExpression(undefined, registryExpr)
				);
				this.setSharedModules(`__autoRegistryItem_${text}`, {
					path: this.registryItems[text],
					routeName
				});
				const attrs = ts.updateJsxAttributes(node.attributes, [
					...node.attributes.properties,
					registryAttribute
				]);
				this.needsLoadable = true;
				this.ctorCountMap.set(text, (this.ctorCountMap.get(text) || 0) - 1);
				if (ts.isJsxElement(inputNode)) {
					let openingElement;
					openingElement = ts.updateJsxOpeningElement(
						node as ts.JsxOpeningElement,
						ts.createIdentifier(fakeComponentName),
						(node as any).typeArguments,
						attrs
					);
					const closingElement = ts.updateJsxClosingElement(
						inputNode.closingElement,
						ts.createIdentifier(fakeComponentName)
					);
					return ts.updateJsxElement(inputNode, openingElement, inputNode.children, closingElement);
				} else {
					return ts.updateJsxSelfClosingElement(
						inputNode,
						ts.createIdentifier(fakeComponentName),
						(inputNode as any).typeArguments,
						attrs
					);
				}
			}
		}
		return inputNode;
	}

	private setSharedModules(registryItemName: string, meta: { path: string; routeName: string | undefined }) {
		const targetPath = path.posix
			.resolve(this.contextPath, meta.path)
			.replace(`${this.basePath}${path.posix.sep}`, '');
		shared.modules = shared.modules || {};
		shared.modules[registryItemName] = shared.modules[registryItemName] || { path: targetPath, routeName: [] };
		if (meta.routeName) {
			shared.modules[registryItemName].routeName.push(meta.routeName);
		}
	}

	private log(name: string, path: string) {
		shared.all = shared.all || {};
		shared.all[name] = path;
	}

	private replaceWidgetClassWithString(node: ts.CallExpression) {
		const text = node.arguments[0].getText();
		const importPath = this.modulesMap.get(text) as string;
		const targetPath = path.posix
			.resolve(this.contextPath, importPath)
			.replace(`${this.basePath}${path.posix.sep}`, '');

		let routeName = this.routeName ? this.getRouteName(node) : undefined;
		if (!routeName && this.outletName) {
			routeName = this.getOutletRouteName(node);
		}
		this.ctorCountMap.set(text, (this.ctorCountMap.get(text) || 0) + 1);
		this.log(text, targetPath);
		if (
			this.all ||
			this.bundlePaths.indexOf(targetPath) !== -1 ||
			this.bundlePaths.some((bundlePattern) => minimatch(targetPath, bundlePattern)) ||
			(routeName && this.routes.indexOf(routeName) !== -1)
		) {
			this.ctorCountMap.set(text, (this.ctorCountMap.get(text) || 0) - 1);
			this.registryItems[text] = this.modulesMap.get(text) as string;
			const registryItem = ts.createPropertyAccess(
				ts.createIdentifier('__autoRegistryItems'),
				ts.createIdentifier(text)
			);
			const registryExpr = ts.createObjectLiteral([
				ts.createPropertyAssignment(
					ts.createIdentifier('label'),
					ts.createLiteral(`__autoRegistryItem_${text}`)
				),
				ts.createPropertyAssignment(ts.createIdentifier('registryItem'), registryItem)
			]);
			this.setSharedModules(`__autoRegistryItem_${text}`, { path: this.registryItems[text], routeName });
			return ts.updateCall(node, node.expression, node.typeArguments, [registryExpr, ...node.arguments.slice(1)]);
		}
		return node;
	}

	private removeImportStatements(nodes: ts.Statement[]) {
		const importsToRemove: string[] = [];
		Object.keys(this.registryItems).forEach((label) => {
			if (this.ctorCountMap.get(label) === 0) {
				importsToRemove.push(this.registryItems[label]);
			}
		});
		return nodes.filter((node: ts.Node) => {
			if (
				ts.isImportDeclaration(node) &&
				importsToRemove.indexOf((node.moduleSpecifier as ts.StringLiteral).text) !== -1
			) {
				return false;
			}
			return true;
		});
	}

	private isWCall(node: ts.Node): node is ts.CallExpression {
		return !!(
			this.wPragma &&
			this.modulesMap.size &&
			ts.isCallExpression(node) &&
			node.expression.getText() === this.wPragma &&
			node.arguments &&
			node.arguments.length
		);
	}

	private getRouteName(node: ts.Node): string | undefined {
		let parent = node.parent;
		while (parent) {
			if (
				(ts.isMethodDeclaration(parent) || ts.isPropertyAssignment(parent)) &&
				parent.name.getText() === routeRendererName
			) {
				const w = parent.parent!.parent as ts.Node;
				if (
					ts.isCallExpression(w) &&
					w.expression.getText() === this.wPragma &&
					ts.isIdentifier(w.arguments[0]) &&
					w.arguments[0].getText() === this.routeName &&
					ts.isObjectLiteralExpression(w.arguments[1])
				) {
					const objectLiteral = w.arguments[1] as ts.ObjectLiteralExpression;
					for (let i = 0; i < objectLiteral.properties.length; i++) {
						const property = objectLiteral.properties[i];
						if (
							ts.isPropertyAssignment(property) &&
							property.name.getText() === routeIdName &&
							ts.isStringLiteral(property.initializer)
						) {
							return property.initializer.text;
						}
					}
				}
			} else if (ts.isJsxAttribute(parent) && parent.name.getText() === routeRendererName) {
				const tsx = parent.parent!.parent as ts.JsxOpeningLikeElement;
				if (ts.isJsxOpeningLikeElement(tsx) && tsx.tagName.getText() === this.routeName) {
					const properties = tsx.attributes.properties;
					for (let i = 0; i < properties.length; i++) {
						const attribute = properties[i] as ts.JsxAttribute;
						if (
							attribute.name.getText() === routeIdName &&
							attribute.initializer &&
							ts.isStringLiteral(attribute.initializer)
						) {
							return attribute.initializer.text;
						}
					}
				}
			}
			parent = parent.parent;
		}
		return undefined;
	}

	private getOutletRouteName(node: ts.Node): string | undefined {
		let parent = node.parent;
		let text: string | undefined;
		while (parent) {
			if (ts.isPropertyAssignment(parent) && !text) {
				text = parent.name
					.getText()
					.replace(/^'/, '')
					.replace(/'$/, '');
			}
			if (ts.isCallExpression(parent) && parent.expression.getText() === this.wPragma) {
				if (ts.isIdentifier(parent.arguments[0]) && parent.arguments[0].getText() === this.outletName) {
					return text;
				}
				return undefined;
			} else if (ts.isJsxElement(parent)) {
				if (parent.openingElement.tagName.getText() === this.outletName) {
					return text;
				}
				return undefined;
			}
			parent = parent.parent;
		}
		return undefined;
	}
}

const registryTransformer = function(
	this: { basePath: string; bundlePaths: string[]; all: boolean; routes: string[]; sync: boolean },
	context: ts.TransformationContext
) {
	const basePath = this.basePath;
	const bundlePaths = this.bundlePaths;
	const all = this.all;
	const routes = this.routes;
	const opts = context.getCompilerOptions();
	const sync = this.sync;
	const { module } = opts;
	const legacyModule =
		module === ts.ModuleKind.CommonJS || module === ts.ModuleKind.AMD || module === ts.ModuleKind.UMD;
	return function(node: ts.SourceFile) {
		const root = node;
		const contextPath = path.dirname(path.relative(basePath, node.getSourceFile().fileName));
		const visitor = new Visitor({
			context,
			contextPath,
			bundlePaths,
			basePath,
			legacyModule,
			root,
			all,
			routes,
			sync
		});
		let result = ts.visitNode(node, visitor.visit.bind(visitor));
		return visitor.end(result);
	};
};

export default (
	basePath: string,
	bundlePaths: string[],
	all: boolean = false,
	routes: string[] = [],
	sync: boolean = false
) => registryTransformer.bind({ bundlePaths, basePath, all, routes, sync });
