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

	function createCustomElementExpression(
		identifier: string,
		widgetName: string,
		attributes: string[],
		properties: string[],
		events: string[]
	) {
		const propertyAccess = ts.createPropertyAccess(ts.createIdentifier(identifier), '__customElementDescriptor');
		const tagName = `${preparedElementPrefix}-${widgetName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`;

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
			ts.createPropertyAssignment('events', ts.createArrayLiteral(events.map((item) => ts.createLiteral(item))))
		]);

		const existingDescriptor = ts.createBinary(propertyAccess, ts.SyntaxKind.BarBarToken, ts.createObjectLiteral());

		return ts.createExpressionStatement(
			ts.createAssignment(
				propertyAccess,
				ts.createObjectLiteral([
					ts.createSpreadAssignment(customElementDeclaration),
					ts.createSpreadAssignment(existingDescriptor)
				])
			)
		);
	}

	return (context) => {
		const visit: any = (node: ts.Node) => {
			const moduleSymbol = checker.getSymbolAtLocation(node.getSourceFile());
			const [defaultExport = undefined] = moduleSymbol
				? checker.getExportsOfModule(moduleSymbol).filter((symbol) => symbol.escapedName === 'default')
				: [];
			const classSymbol =
				ts.isClassDeclaration(node) && node.name ? checker.getSymbolAtLocation(node.name) : undefined;

			const defaultExportType =
				defaultExport && checker.getTypeOfSymbolAtLocation(defaultExport, node.getSourceFile());

			if (!defaultExportType) {
				return ts.visitEachChild(node, (child) => visit(child), context);
			}

			const variableNode = ts.isVariableDeclaration(node) && node;
			const variableSymbol =
				variableNode && variableNode.name ? checker.getSymbolAtLocation(variableNode.name) : undefined;

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
				variableNode &&
				variableSymbol &&
				defaultExportType === checker.getTypeOfSymbolAtLocation(variableSymbol, node)
			) {
				const initializer = variableNode.initializer;
				if (initializer && ts.isCallExpression(initializer)) {
					const call = initializer as ts.CallExpression;
					const renderOptionsCallback = call.arguments[0];
					let typeOfOptions: ts.Type | undefined;
					if (
						renderOptionsCallback &&
						ts.isFunctionLike(renderOptionsCallback) &&
						renderOptionsCallback.parameters[0]
					) {
						typeOfOptions = checker.getTypeAtLocation(renderOptionsCallback.parameters[0]);
					} else if (renderOptionsCallback && ts.isIdentifier(renderOptionsCallback)) {
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
						const optionProperties = typeOfOptions.getProperty('properties');
						const typeOfProperties =
							optionProperties && checker.getTypeOfSymbolAtLocation(optionProperties, variableNode);

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

								const updatedNode = ts.updateVariableDeclaration(
									variableNode,
									variableNode.name,
									variableNode.type,
									ts.createCall(
										ts.createArrowFunction(
											undefined,
											undefined,
											[],
											undefined,
											undefined,
											ts.createBlock(
												[
													ts.createVariableStatement(undefined, [
														ts.createVariableDeclaration(
															ts.createIdentifier('temp'),
															undefined,
															variableNode.initializer
														)
													]),
													createCustomElementExpression(
														'temp',
														widgetName,
														attributes,
														properties,
														events
													),
													ts.createReturn(ts.createIdentifier('temp'))
												],
												true
											)
										),
										undefined,
										undefined
									)
								);

								return [updatedNode];
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

					return [
						node,
						createCustomElementExpression(widgetName, widgetName, attributes, properties, events)
					];
				}
			}

			return ts.visitEachChild(node, (child) => visit(child), context);
		};

		return (node) => ts.visitNode(node, visit);
	};
}
