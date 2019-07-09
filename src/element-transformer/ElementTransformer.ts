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
			const variableSymbol =
				ts.isVariableDeclaration(node) && node.name ? checker.getSymbolAtLocation(node.name) : undefined;

			let widgetName: string = '';
			const attributes: string[] = [];
			const properties: string[] = [];
			const events: string[] = [];
			let propertyAccess: ts.PropertyAccessExpression | undefined = undefined;

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
				checker.getTypeOfSymbolAtLocation(defaultExport, node.getSourceFile()) ===
					checker.getTypeOfSymbolAtLocation(variableSymbol, node)
			) {
				const variableNode = node as ts.VariableDeclaration;
				const initializer = variableNode.initializer;
				if (initializer && ts.isCallExpression(initializer)) {
					const call = initializer as ts.CallExpression;
					const renderOptionsCallback = call.arguments[0];
					let optionsNode: ts.Node | undefined;
					if (ts.isFunctionLike(renderOptionsCallback)) {
						optionsNode = renderOptionsCallback.parameters[0];
					} else if (ts.isIdentifier(renderOptionsCallback)) {
						// TODO
						// const type = checker.getTypeAtLocation(renderOptionsCallback);
						// type.is
						// ts.isFunctionTypeNode(type)
						// (renderOptionsCallback as ts.Identifier).
						optionsNode = undefined;
					}

					if (optionsNode) {
						const typeOfOptions = checker.getTypeAtLocation(optionsNode);
						const properties = typeOfOptions.getProperty('properties');
						const typeOfProperties =
							properties && checker.getTypeOfSymbolAtLocation(properties, optionsNode);
						if (typeOfProperties) {
							typeOfProperties.getProperties().forEach((prop) => {
								parsePropertyType(prop, optionsNode!);
							});
							widgetName = variableNode.name!.getText();
							propertyAccess = ts.createPropertyAccess(
								ts.createIdentifier(widgetName),
								'__customElementDescriptor'
							);
						}
					}
				}
			} else if (
				customElementFilesIncludingDefaults.indexOf(path.resolve(node.getSourceFile().fileName)) !== -1 &&
				defaultExport &&
				classSymbol &&
				checker.getTypeOfSymbolAtLocation(defaultExport, node.getSourceFile()) ===
					checker.getTypeOfSymbolAtLocation(classSymbol, node)
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

					propertyAccess = ts.createPropertyAccess(
						ts.createPropertyAccess(ts.createIdentifier(widgetName), ts.createIdentifier('prototype')),
						'__customElementDescriptor'
					);
				}
			}

			if (widgetName && propertyAccess) {
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
					ts.createStatement(
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
