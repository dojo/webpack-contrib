import * as ts from 'typescript';

require('ts-node').register();

function parseTagName(name: string) {
	return name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function discoverDescriptor(source: ts.Node, checker: ts.TypeChecker) {
	let tagName = undefined;
	let attributes: string[] = [];
	let properties: string[] = [];
	let events: string[] = [];

	function getPropertiesOfFactory(factory: ts.CallExpression) {
		const factoryIdentifier = factory.getChildAt(0);
		const symbol = checker.getSymbolAtLocation(factoryIdentifier);
		if (symbol) {
			const type = checker.getTypeOfSymbolAtLocation(symbol, factoryIdentifier);
			const callSignatures = type.getCallSignatures();
			if (callSignatures.length > 0) {
				const parameters = callSignatures[0].getParameters();

				if (parameters.length) {
					const callback = checker.getTypeOfSymbolAtLocation(parameters[0], factoryIdentifier) as
						| ts.TypeReference
						| undefined;
					if (callback && callback.objectFlags & ts.ObjectFlags.Reference) {
						const typeArguments = callback.typeArguments;

						if (typeArguments) {
							return typeArguments[0];
						}
					}
				}
			}
		}

		return null;
	}

	const visit: any = (node: ts.Node) => {
		const moduleSymbol = checker.getSymbolAtLocation(node.getSourceFile());
		const [defaultExport = undefined] = moduleSymbol
			? checker.getExportsOfModule(moduleSymbol).filter((symbol) => symbol.escapedName === 'default')
			: [];

		const defaultExportType =
			defaultExport && checker.getTypeOfSymbolAtLocation(defaultExport, node.getSourceFile());

		if (!defaultExportType) {
			node.getChildren().forEach(visit);
			return;
		}

		// Class case
		const classSymbol =
			ts.isClassDeclaration(node) && node.name ? checker.getSymbolAtLocation(node.name) : undefined;
		// Factory result assigned to variable
		let initializer: ts.Expression | undefined;
		const variableNode = ts.isVariableDeclaration(node) && node;
		const variableSymbol =
			variableNode && variableNode.name ? checker.getSymbolAtLocation(variableNode.name) : undefined;
		if (
			variableNode &&
			variableSymbol &&
			defaultExportType === checker.getTypeOfSymbolAtLocation(variableSymbol, node)
		) {
			initializer = variableNode.initializer;
		}

		// Direct export of factory result
		if (ts.isExportAssignment(node) && !node.isExportEquals) {
			initializer = node.expression;
		}

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

		if (initializer) {
			if (initializer && ts.isCallExpression(initializer)) {
				const call = initializer as ts.CallExpression;
				const renderOptionsCallback = call.arguments[0];

				const propertyType = getPropertiesOfFactory(call);

				if (propertyType) {
					propertyType.getProperties().forEach((prop) => {
						parsePropertyType(prop, node);
					});
					if (variableNode) {
						const widgetName = variableNode.name!.getText();
						tagName = parseTagName(widgetName);
						return;
					} else {
						let widgetName;
						if (renderOptionsCallback && (renderOptionsCallback as any).name) {
							widgetName = (renderOptionsCallback as any).name.getText();
						} else {
							const fileName =
								node
									.getSourceFile()
									.fileName.split(/[\\/]/)
									.pop() || '';
							widgetName = fileName.split('.')[0];
						}
						tagName = parseTagName(widgetName);
						return;
					}
				}
			}
		} else if (classSymbol && defaultExportType === checker.getTypeOfSymbolAtLocation(classSymbol, node)) {
			const classNode = node as ts.ClassDeclaration;
			if (classNode.heritageClauses && classNode.heritageClauses.length > 0) {
				const widgetName = classNode.name!.getText();
				tagName = parseTagName(widgetName);

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

				return;
			}
		}

		node.getChildren().forEach(visit);
	};

	visit(source);

	return tagName
		? {
				tagName,
				attributes,
				properties,
				events
		  }
		: null;
}
