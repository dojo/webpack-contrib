import * as ts from 'typescript';
import * as path from 'path';
const shared = require('./shared');

const dImportPath = '@dojo/framework/widget-core/d';
const wPragma = 'w';
const registryItemPrefix = '__autoRegistryItem_';
const registryBagName = '__autoRegistryItems';
const registryDecoratorNamedImport = 'registry';
const registryDecoratorNamedImportAlias = '__autoRegistry';
const fakeComponentName = 'Loadable__';
const registryDecoratorModulePath = '@dojo/framework/widget-core/decorators/registry';

type Registry = { [index: string]: string };

interface VisitorOptions {
	context: ts.TransformationContext;
	root: ts.SourceFile;
	contextPath: string;
	basePath: string;
	bundlePaths: string[];
	legacyModule: boolean;
	analyze: boolean;
}

function createArrowFuncForDefaultImport(modulePath: string) {
	return ts.createCall((ts as any).createSignatureDeclaration(ts.SyntaxKind.ImportKeyword), undefined, [
		ts.createLiteral(`${modulePath}`)
	]);
}

function createRegistryItemsObject(registryVariableName: ts.Identifier, registry: Registry) {
	const registryItems = Object.keys(registry).map((label) => {
		const modulePath = registry[label];
		const importCall = createArrowFuncForDefaultImport(modulePath);
		return ts.createPropertyAssignment(
			`'${registryItemPrefix}${label}'`,
			ts.createArrowFunction(undefined, undefined, [], undefined, undefined, importCall)
		);
	});
	return ts.createVariableStatement(
		undefined,
		ts.createVariableDeclarationList([
			ts.createVariableDeclaration(registryVariableName, undefined, ts.createObjectLiteral(registryItems, false))
		])
	);
}

class Visitor {
	private context: ts.TransformationContext;
	private root: ts.SourceFile;
	private contextPath: string;
	private basePath: string;
	private bundlePaths: string[];
	private legacyModule: boolean;
	private wPragma: undefined | string;
	private modulesMap = new Map<string, string>();
	private classMap = new Map<ts.Node, Registry>();
	private needsLoadable = false;
	private analyze = false;

	constructor(options: VisitorOptions) {
		this.context = options.context;
		this.contextPath = options.contextPath;
		this.bundlePaths = options.bundlePaths;
		this.basePath = options.basePath;
		this.legacyModule = options.legacyModule;
		this.root = options.root;
		this.analyze = options.analyze;
	}

	public visit(node: ts.Node) {
		if (ts.isImportDeclaration(node)) {
			const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
			const targetPath = path.posix
				.resolve(this.contextPath, importPath)
				.replace(`${this.basePath}${path.posix.sep}`, '');

			if ((this.analyze && importPath.match(/^(\.|\.\.)/)) || this.bundlePaths.indexOf(targetPath) !== -1) {
				this.setLazyImport(node);
			} else if (dImportPath === importPath) {
				this.setWPragma(node);
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

	private addRegistryDecoratorToClasses(
		registryIdentifier: ts.Identifier,
		nodeStatements: ts.NodeArray<ts.Statement>
	) {
		const statements = [...nodeStatements];
		const registryStatements: ts.Statement[] = [];

		this.classMap.forEach((registry: Registry, key: ts.Node) => {
			const registryVariableName = ts.createUniqueName(registryBagName);
			registryStatements.push(createRegistryItemsObject(registryVariableName, registry));

			const index = this.root.statements.findIndex((node: ts.Node) => node === key);

			let node = statements[index] as ts.ClassDeclaration;
			let registryCall: ts.CallExpression;
			if (this.legacyModule) {
				registryCall = ts.createCall(
					ts.createPropertyAccess(registryIdentifier, registryDecoratorNamedImport),
					undefined,
					[registryVariableName]
				);
			} else {
				registryCall = ts.createCall(registryIdentifier, undefined, [registryVariableName]);
			}

			const decorator = ts.createDecorator(registryCall);

			node = ts.updateClassDeclaration(
				node,
				[decorator, ...(node.decorators || [])],
				node.modifiers,
				node.name,
				node.typeParameters,
				node.heritageClauses || [],
				node.members
			);

			statements[index] = node;
		});
		return [...registryStatements, ...statements];
	}

	public end(node: ts.SourceFile) {
		if (!this.classMap.size) {
			return node;
		}

		const moduleSpecifier = ts.createLiteral(registryDecoratorModulePath);
		const importIdentifier = ts.createIdentifier(registryDecoratorNamedImport);
		const aliasIdentifier = ts.createIdentifier(registryDecoratorNamedImportAlias);
		const importSpecifier = ts.createImportSpecifier(importIdentifier, aliasIdentifier);
		const namedImport = ts.createNamedImports([importSpecifier]);
		const importClause = ts.createImportClause(undefined, namedImport);
		const registryImport = ts.createImportDeclaration(undefined, undefined, importClause, moduleSpecifier);
		const registryIdentifier = this.legacyModule
			? ts.getGeneratedNameForNode(registryImport)
			: importSpecifier.name;

		let statements = this.addRegistryDecoratorToClasses(registryIdentifier, node.statements);
		statements = this.removeImportStatements(statements);

		if (this.needsLoadable) {
			const obj = ts.createObjectLiteral([
				ts.createPropertyAssignment(ts.createIdentifier('type'), ts.createLiteral('registry'))
			]);
			const decl = ts.createVariableDeclaration(fakeComponentName, undefined, obj);
			const stmt = ts.createVariableStatement(undefined, [decl]);
			statements.unshift(stmt);
		}

		return ts.updateSourceFileNode(node, [registryImport, ...statements]);
	}

	private setLazyImport(node: ts.ImportDeclaration) {
		const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
		const importClause = node.importClause;
		if (importClause && importClause.name && importClause.name.text) {
			this.modulesMap.set(importClause.name.text, importPath);
		}
	}

	private setWPragma(node: ts.ImportDeclaration) {
		if (node.importClause) {
			const namedBindings = node.importClause.namedBindings as ts.NamedImports;
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

	private replaceTSXElementWithLoadable(inputNode: ts.JsxSelfClosingElement | ts.JsxElement) {
		let node: ts.JsxOpeningLikeElement;
		if (ts.isJsxElement(inputNode)) {
			node = inputNode.openingElement;
		} else {
			node = inputNode;
		}
		const text = node.tagName.getText();
		if (this.modulesMap.get(text)) {
			const targetClass = this.findParentClass(inputNode);
			if (targetClass) {
				const registryItems = this.classMap.get(targetClass) || {};
				registryItems[text] = this.modulesMap.get(text) as string;
				this.classMap.set(targetClass, registryItems);
				const registryIdentifier = ts.createLiteral(`${registryItemPrefix}${text}`);
				const registryAttribute = ts.createJsxAttribute(
					ts.createIdentifier('__autoRegistryItem'),
					registryIdentifier
				);
				this.setSharedModules(`${registryItemPrefix}${text}`, registryItems[text]);
				const attrs = ts.updateJsxAttributes(node.attributes, [
					...node.attributes.properties,
					registryAttribute
				]);
				this.needsLoadable = true;
				if (ts.isJsxElement(inputNode)) {
					const openingElement = ts.updateJsxOpeningElement(
						node as ts.JsxOpeningElement,
						ts.createIdentifier(fakeComponentName),
						attrs
					);
					const closingElement = ts.updateJsxClosingElement(
						inputNode.closingElement,
						ts.createIdentifier(fakeComponentName)
					);
					return ts.updateJsxElement(inputNode, openingElement, inputNode.children, closingElement);
				} else {
					return ts.updateJsxSelfClosingElement(inputNode, ts.createIdentifier(fakeComponentName), attrs);
				}
			}
		}
		return inputNode;
	}

	private setSharedModules(registryItemName: string, modulePath: string) {
		if (this.analyze) {
			const targetPath = path.posix
				.resolve(this.contextPath, modulePath)
				.replace(`${this.basePath}${path.posix.sep}`, '');
			shared.modules = shared.modules || {};
			shared.modules[registryItemName] = targetPath;
		}
	}

	private replaceWidgetClassWithString(node: ts.CallExpression) {
		const text = node.arguments[0].getText();
		const targetClass = this.findParentClass(node);
		if (targetClass) {
			const registryItems = this.classMap.get(targetClass) || {};
			registryItems[text] = this.modulesMap.get(text) as string;
			this.classMap.set(targetClass, registryItems);
			const registryIdentifier = ts.createLiteral(`${registryItemPrefix}${text}`);
			this.setSharedModules(`${registryItemPrefix}${text}`, registryItems[text]);
			return ts.updateCall(node, node.expression, node.typeArguments, [
				registryIdentifier,
				...node.arguments.slice(1)
			]);
		}
		return node;
	}

	private removeImportStatements(nodes: ts.Statement[]) {
		const importsToRemove: string[] = [];
		this.classMap.forEach((registry: Registry, key: ts.Node) => {
			Object.keys(registry).forEach((label) => {
				importsToRemove.push(registry[label]);
			});
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

	private findParentClass(node: ts.Node): ts.Node | undefined {
		let parent = node.parent;
		while (parent) {
			if (ts.isClassDeclaration(parent)) {
				return parent;
			}
			parent = parent.parent;
		}
	}
}

const registryTransformer = function(
	this: { basePath: string; bundlePaths: string[]; analyze: boolean },
	context: ts.TransformationContext
) {
	const basePath = this.basePath;
	const bundlePaths = this.bundlePaths;
	const analyze = this.analyze;
	const opts = context.getCompilerOptions();
	const { module } = opts;
	const legacyModule =
		module === ts.ModuleKind.CommonJS || module === ts.ModuleKind.AMD || module === ts.ModuleKind.UMD;
	return function(node: ts.SourceFile) {
		const root = node;
		const contextPath = path.dirname(path.relative(basePath, node.getSourceFile().fileName));
		const visitor = new Visitor({ context, contextPath, bundlePaths, basePath, legacyModule, root, analyze });
		let result = ts.visitNode(node, visitor.visit.bind(visitor));
		return visitor.end(result);
	};
};

export default (basePath: string, bundlePaths: string[], analyze: boolean = false) =>
	registryTransformer.bind({ bundlePaths, basePath, analyze });
