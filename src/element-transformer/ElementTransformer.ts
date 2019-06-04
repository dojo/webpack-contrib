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
			const classNode = node as ts.ClassDeclaration;

			if (
				customElementFilesIncludingDefaults.indexOf(path.resolve(node.getSourceFile().fileName)) !== -1 &&
				defaultExport &&
				classSymbol &&
				checker.getTypeOfSymbolAtLocation(defaultExport, node.getSourceFile()) ===
					checker.getTypeOfSymbolAtLocation(classSymbol, node) &&
				classNode.heritageClauses &&
				classNode.heritageClauses.length > 0
			) {
				const widgetName = classNode.name!.getText();
				const tagName = `${preparedElementPrefix}-${widgetName
					.replace(/([a-z])([A-Z])/g, '$1-$2')
					.toLowerCase()}`;

				const [
					{
						types: [{ typeArguments = [] }]
					}
				] = classNode.heritageClauses;

				const attributes: string[] = [];
				const properties: string[] = [];
				const events: string[] = [];

				if (typeArguments.length) {
					const widgetPropNode = typeArguments[0];
					const widgetPropNodeSymbol = checker.getSymbolAtLocation(widgetPropNode.getChildAt(0));

					if (widgetPropNodeSymbol) {
						const widgetPropType = checker.getDeclaredTypeOfSymbol(widgetPropNodeSymbol);
						const widgetProps = widgetPropType.getProperties();

						widgetProps.forEach((prop) => {
							const type = checker.getTypeOfSymbolAtLocation(prop, widgetPropNode);
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
						});
					}
				}

				const customElementDeclaration = ts.createObjectLiteral([
					ts.createPropertyAssignment('tagName', ts.createLiteral(tagName)),
					ts.createPropertyAssignment('attributes', ts.createArrayLiteral(attributes.map(ts.createLiteral))),
					ts.createPropertyAssignment('properties', ts.createArrayLiteral(properties.map(ts.createLiteral))),
					ts.createPropertyAssignment('events', ts.createArrayLiteral(events.map(ts.createLiteral)))
				]);

				const prototypeAccess = ts.createPropertyAccess(
					ts.createPropertyAccess(ts.createIdentifier(widgetName), ts.createIdentifier('prototype')),
					'__customElementDescriptor'
				);

				const existingDescriptor = ts.createBinary(
					prototypeAccess,
					ts.SyntaxKind.BarBarToken,
					ts.createObjectLiteral()
				);

				return [
					node,
					ts.createStatement(
						ts.createAssignment(
							prototypeAccess,
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
