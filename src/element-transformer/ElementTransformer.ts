import * as path from 'path';
import * as ts from 'typescript';

require('ts-node').register();

export interface ElementTransformerOptions {
	elementPrefix: string;
	customElementFiles: string[];
}

export default function elementTransformer<T extends ts.Node>(
	program: ts.Program,
	{ customElementFiles, elementPrefix }: ElementTransformerOptions
): ts.TransformerFactory<T> {
	const checker = program.getTypeChecker();

	const customElementFilesIncludingDefaults = customElementFiles.map((file) => {
		try {
			return require.resolve(path.resolve(file));
		} catch (e) {
			return file;
		}
	});

	function findVariable(node: ts.Node, defaultExportType: ts.Type) {
		if (
			defaultExportType &&
			ts.isVariableStatement(node) &&
			node.declarationList &&
			node.declarationList.declarations
		) {
			const declarations = node.declarationList.declarations;
			for (let i = 0; i < declarations.length; i++) {
				const variableSymbol = declarations[i].name && checker.getSymbolAtLocation(declarations[i].name);
				if (variableSymbol && defaultExportType === checker.getTypeOfSymbolAtLocation(variableSymbol, node)) {
					return { variableSymbol, variableNode: declarations[i] };
				}
			}
		}
	}

	const preparedElementPrefix = elementPrefix
		.toLowerCase()
		.replace(/[^a-z]/g, '-')
		.replace(/[-{2,]/g, '-')
		.replace(/^-(.*?)-?$/, '$1')
		.trim();

	return (context) => {
		const visit: any = (node: ts.Node) => {
			const moduleSymbol = checker.getSymbolAtLocation(node.getSourceFile());
			const [defaultExport = undefined] = moduleSymbol
				? checker.getExportsOfModule(moduleSymbol).filter((symbol) => symbol.escapedName === 'default')
				: [];
			const classSymbol =
				ts.isClassDeclaration(node) && node.name ? checker.getSymbolAtLocation(node.name) : undefined;
			// const isVariableStatement = ts.isVariableStatement(node);
			const defaultExportType =
				defaultExport && checker.getTypeOfSymbolAtLocation(defaultExport, node.getSourceFile());

			if (!defaultExportType) {
				return ts.visitEachChild(node, (child) => visit(child), context);
			}

			const { variableSymbol = undefined, variableNode = undefined } =
				findVariable(node, defaultExportType) || {};

			let widgetName = '';
			const attributes: string[] = [];
			const properties: string[] = [];
			const events: string[] = [];

			function parsePropertyType(prop: ts.Symbol, locationNode: ts.Node) {
				const type = checker.getTypeOfSymbolAtLocation(prop, locationNode);
				const name = prop.getName();
				let types = [type];

				const intersectionType = type as ts.UnionOrIntersectionType;

				if (intersectionType.types && intersectionType.types.length > 0) {
					types = intersectionType.types;
				}

				types = types.filter((type) => checker.typeToString(type) !== 'undefined');

				if (types.length === 1) {
					if (
						name.indexOf('on') === 0 &&
						checker.getSignaturesOfType(types[0], ts.SignatureKind.Call).length > 0
					) {
						events.push(name);
					} else if (checker.typeToString(types[0]) === 'string') {
						attributes.push(name);
					} else {
						properties.push(name);
					}
				} else {
					if (types.some((type) => Boolean(type.flags & ts.TypeFlags.StringLike))) {
						attributes.push(name);
					} else {
						properties.push(name);
					}
				}
			}

			if (
				customElementFilesIncludingDefaults.indexOf(path.resolve(node.getSourceFile().fileName)) !== -1 &&
				defaultExport &&
				variableSymbol &&
				variableNode
			) {
				const initializer = variableNode.initializer;
				if (initializer && ts.isCallExpression(initializer)) {
					const call = initializer as ts.CallExpression;
					const renderOptionsCallback = call.arguments[0];
					let typeOfOptions: ts.Type | undefined;
					if (ts.isFunctionLike(renderOptionsCallback) && renderOptionsCallback.parameters[0]) {
						typeOfOptions = checker.getTypeAtLocation(renderOptionsCallback.parameters[0]);
					} else if (ts.isIdentifier(renderOptionsCallback)) {
						const functionType = checker.getTypeAtLocation(renderOptionsCallback);
						const signatures = functionType.getCallSignatures();
						for (const signature of signatures) {
							if (signature.getParameters()[0]) {
								typeOfOptions = checker.getTypeOfSymbolAtLocation(
									signature.getParameters()[0],
									renderOptionsCallback
								);
								if (typeOfOptions.getProperty('properties')) {
									break;
								}
							}
						}
					}

					if (typeOfOptions && typeOfOptions.getProperty('properties')) {
						const properties = typeOfOptions.getProperty('properties');
						const typeOfProperties =
							properties && checker.getTypeOfSymbolAtLocation(properties, variableNode);

						if (typeOfProperties && typeOfProperties.getCallSignatures()) {
							const propertyCallSignatures = typeOfProperties.getCallSignatures();
							let propertyType;
							for (const propertyCallSignature of propertyCallSignatures) {
								if (!propertyCallSignature.getParameters().length) {
									propertyType = propertyCallSignature.getReturnType();
								}
							}
							if (propertyType) {
								propertyType.getProperties().forEach((prop) => {
									parsePropertyType(prop, variableNode);
								});
								widgetName = variableNode.name!.getText();
							}
						}
					}
				}
			} else if (
				customElementFilesIncludingDefaults.indexOf(path.resolve(node.getSourceFile().fileName)) !== -1 &&
				classSymbol &&
				defaultExportType === checker.getTypeOfSymbolAtLocation(classSymbol, node)
			) {
				const classNode = node as ts.ClassDeclaration;
				if (classNode.heritageClauses && classNode.heritageClauses.length > 0) {
					widgetName = classNode.name!.getText();

					const [
						{
							types: [{ typeArguments = [] }]
						}
					] = classNode.heritageClauses;

					if (typeArguments.length) {
						const widgetPropNode = typeArguments[0];
						const widgetPropNodeSymbol = checker.getSymbolAtLocation(widgetPropNode.getChildAt(0));

						if (widgetPropNodeSymbol) {
							const widgetPropType = checker.getDeclaredTypeOfSymbol(widgetPropNodeSymbol);
							const widgetProps = widgetPropType.getProperties();

							widgetProps.forEach((prop) => {
								parsePropertyType(prop, widgetPropNode);
							});
						}
					}
				}
			}

			if (widgetName) {
				const propertyAccess = ts.createPropertyAccess(
					ts.createIdentifier(widgetName),
					'__customElementDescriptor'
				);
				const tagName = `${preparedElementPrefix}-${widgetName
					.replace(/([a-z])([A-Z])/g, '$1-$2')
					.toLowerCase()}`;

				const customElementDeclaration = ts.createObjectLiteral([
					ts.createPropertyAssignment('tagName', ts.createLiteral(tagName)),
					ts.createPropertyAssignment(
						'attributes',
						ts.createArrayLiteral(attributes.map((item) => ts.createLiteral(item)))
					),
					ts.createPropertyAssignment(
						'properties',
						ts.createArrayLiteral(properties.map((item) => ts.createLiteral(item)))
					),
					ts.createPropertyAssignment(
						'events',
						ts.createArrayLiteral(events.map((item) => ts.createLiteral(item)))
					)
				]);

				const existingDescriptor = ts.createBinary(
					propertyAccess,
					ts.SyntaxKind.BarBarToken,
					ts.createObjectLiteral()
				);

				return [
					node,
					ts.createExpressionStatement(
						ts.createAssignment(
							propertyAccess,
							ts.createObjectLiteral([
								ts.createSpreadAssignment(customElementDeclaration),
								ts.createSpreadAssignment(existingDescriptor)
							])
						)
					)
				];
			}

			return ts.visitEachChild(node, (child) => visit(child), context);
		};

		return (node) => ts.visitNode(node, visit);
	};
}
