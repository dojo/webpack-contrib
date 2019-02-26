import * as ts from 'typescript';

function stripFileExtension(fileName: string) {
	return fileName.substring(0, fileName.lastIndexOf('.'));
}

export interface ElementTransformerOptions {
	elementPrefix: string;
	customElementFiles: string[];
}

export default function elementTransformer<T extends ts.Node>(
	program: ts.Program,
	{ customElementFiles, elementPrefix }: ElementTransformerOptions
): ts.TransformerFactory<T> {
	const checker = program.getTypeChecker();

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
				customElementFiles.indexOf(stripFileExtension(node.getSourceFile().fileName)) !== -1 &&
				defaultExport &&
				classSymbol &&
				checker.getTypeOfSymbolAtLocation(defaultExport, node.getSourceFile()) ===
					checker.getTypeOfSymbolAtLocation(classSymbol, node) &&
				classNode.heritageClauses &&
				classNode.heritageClauses.length > 0
			) {
				const widgetName = classNode.name!.getText();
				let tagName = widgetName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
				if (tagName.indexOf('-') === -1) {
					tagName = `${elementPrefix}-${tagName}`;
				}

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
					const widgetProps = checker.getPropertiesOfType(
						checker.getTypeFromTypeNode(classNode.heritageClauses[0].types[0].typeArguments![0])
					);

					widgetProps.forEach((prop) => {
						const type = checker.getTypeOfSymbolAtLocation(prop, widgetPropNode);
						const name = prop.getName();

						if (
							name.indexOf('on') === 0 &&
							checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0
						) {
							events.push(name);
						} else if (checker.typeToString(type) === 'string') {
							attributes.push(name);
						} else {
							properties.push(name);
						}
					});
				}

				const customElementDeclaration = ts.createObjectLiteral([
					ts.createPropertyAssignment('tagName', ts.createLiteral(tagName)),
					ts.createPropertyAssignment('attributes', ts.createArrayLiteral(attributes.map(ts.createLiteral))),
					ts.createPropertyAssignment('properties', ts.createArrayLiteral(properties.map(ts.createLiteral))),
					ts.createPropertyAssignment('events', ts.createArrayLiteral(events.map(ts.createLiteral)))
				]);

				return [
					node,
					ts.createStatement(
						ts.createAssignment(
							ts.createPropertyAccess(
								ts.createPropertyAccess(
									ts.createIdentifier(widgetName),
									ts.createIdentifier('prototype')
								),
								'__customElementDescriptor'
							),
							customElementDeclaration
						)
					)
				];
			}

			return ts.visitEachChild(node, (child) => visit(child), context);
		};

		return (node) => ts.visitNode(node, visit);
	};
}
