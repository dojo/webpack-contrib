import * as ts from 'typescript';
import * as path from 'path';

const dImportPath = '@dojo/widget-core/d';
const wPragma = 'w';
const registryItemPrefix = '__autoRegistryItem_';
const registryBagName = '__autoRegistryItems';
const registryDecoratorNamedImport = 'registry';
const registryDecoratorNamedImportAlias = '__autoRegistry';
const registryDecoratorModulePath = '@dojo/widget-core/decorators/registry';

function createArrowFuncForDefaultImport(modulePath: string) {
	return ts.createCall((ts as any).createSignatureDeclaration(ts.SyntaxKind.ImportKeyword), undefined, [
		ts.createLiteral(`${modulePath}`)
	]);
}

function createRegistryItemsObject(registryVariableName: ts.Identifier, registry: { [index: string]: string }) {
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
	private classMap = new Map<ts.Node, any>();

	constructor(options: any) {
		this.context = options.context;
		this.contextPath = options.contextPath;
		this.bundlePaths = options.bundlePaths;
		this.basePath = options.basePath;
		this.legacyModule = options.legacyModule;
		this.root = options.root;
	}

	public visit(node: ts.Node) {
		if (ts.isImportDeclaration(node)) {
			const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
			const targetPath = path.resolve(this.contextPath, importPath).replace(`${this.basePath}${path.sep}`, '');

			if (this.bundlePaths.indexOf(targetPath) !== -1) {
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
		return ts.visitEachChild(node, this.visit.bind(this), this.context);
	}

	private addRegistryDecoratorToClasses(
		registryIdentifier: ts.Identifier,
		nodeStatements: ts.NodeArray<ts.Statement>
	) {
		const statements = [...nodeStatements];
		const registryStatements: ts.Statement[] = [];

		this.classMap.forEach((registry: any, key: ts.Node) => {
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

	private replaceWidgetClassWithString(node: ts.CallExpression) {
		const text = node.arguments[0].getText();
		const targetClass = this.findParentClass(node);
		if (targetClass) {
			const registryItems = this.classMap.get(targetClass) || {};
			registryItems[text] = this.modulesMap.get(text);
			this.classMap.set(targetClass, registryItems);
			const registryIdentifier = ts.createLiteral(`${registryItemPrefix}${text}`);
			return ts.updateCall(node, node.expression, node.typeArguments, [
				registryIdentifier,
				...node.arguments.slice(1)
			]);
		}
		return node;
	}

	private removeImportStatements(nodes: ts.Statement[]) {
		const importsToRemove: string[] = [];
		this.classMap.forEach((registry: any, key: ts.Node) => {
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
	this: { basePath: string; bundlePaths: string[] },
	context: ts.TransformationContext
) {
	const basePath = this.basePath;
	const bundlePaths = this.bundlePaths;
	const opts = context.getCompilerOptions();
	const { module } = opts;
	const legacyModule =
		module === ts.ModuleKind.CommonJS || module === ts.ModuleKind.AMD || module === ts.ModuleKind.UMD;
	return function(node: ts.SourceFile) {
		const root = node;
		const contextPath = path.dirname(path.relative(basePath, node.getSourceFile().fileName));
		const visitor = new Visitor({ context, contextPath, bundlePaths, basePath, legacyModule, root });
		let result = ts.visitNode(node, visitor.visit.bind(visitor));
		return visitor.end(result);
	};
};

export default (basePath: string, bundlePaths: string[]) => registryTransformer.bind({ bundlePaths, basePath });
