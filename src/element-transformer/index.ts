import * as ts from 'typescript';

export default function transformer(program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
	return (context: ts.TransformationContext) => (file: ts.SourceFile) => visitNodeAndChildren(file, program, context);
}

function visitNodeAndChildren(f: ts.SourceFile, program: ts.Program, context: ts.TransformationContext): ts.SourceFile;
function visitNodeAndChildren(node: ts.Node, program: ts.Program, context: ts.TransformationContext): ts.Node;
function visitNodeAndChildren(node: ts.Node, program: ts.Program, context: ts.TransformationContext) {
	return ts.visitEachChild(
		decoratorVisit(node, program),
		(childNode) => visitNodeAndChildren(childNode, program, context),
		context
	);
}

function decoratorVisit(node: ts.Node, program: ts.Program): ts.Node {
	if (!(ts.isClassDeclaration(node) && node.decorators && node.name)) {
		return node;
	}
	const decorator = node.decorators.find((dec) => {
		return ts.isCallExpression(dec.expression) && dec.expression.expression.getText() === 'customElement';
	});
	if (!decorator) {
		return node;
	}

	if (!ts.isCallExpression(decorator.expression) || decorator.expression.arguments.length !== 1) {
		throw new Error('`customElement` decorator expects a single argument: string (tag name) or object');
	}
	let decArg = decorator.expression.arguments[0];
	let didNormalize = false;

	// normalize pass: transform @customElement('dojo-input') to @customElement({ tag: 'dojo-input' })
	if (ts.isStringLiteral(decArg)) {
		decArg = ts.createObjectLiteral([ts.createPropertyAssignment('tag', decArg)]);
		didNormalize = true;
	}

	if (!ts.isObjectLiteralExpression(decArg)) {
		throw new Error('`customElement` expects either a string (the tag name) or an object');
	}

	// Figure out which props were explicitly set so we don't override
	const passedArgKeys = new Set(
		didNormalize
			? ['tag'] // can't do getText on created nodes
			: decArg.properties.map((n) => {
					return n.name!.getText();
			  })
	);

	// Get the public props from the widget's interface declaration
	const checker = program.getTypeChecker();
	if (
		!(
			node.heritageClauses &&
			node.heritageClauses.length &&
			node.heritageClauses[0].types.length &&
			node.heritageClauses[0].types[0].typeArguments
		)
	) {
		throw new Error(
			"`customElement` expects to decore a class that extends WidgetBase<T> where T is the widget's public properties."
		);
	}
	const widgetPropNode = node.heritageClauses[0].types[0].typeArguments![0];
	const widgetPropType = checker.getTypeFromTypeNode(widgetPropNode);
	const widgetProps = checker.getPropertiesOfType(widgetPropType).map((sym) => {
		const propType = checker.typeToString(checker.getTypeOfSymbolAtLocation(sym, widgetPropNode));
		return [sym.getName(), propType];
	});

	// Categorize the props
	const attributes: string[] = [];
	const events: string[] = [];
	const properties: string[] = [];
	for (let [n, t] of widgetProps) {
		if (t === 'string') {
			attributes.push(n);
		} else if (n.startsWith('on') && (t.includes('=>') || t.includes('):'))) {
			events.push(n);
		} else {
			properties.push(n);
		}
	}
	const propsToAdd = [];

	// Build output
	if (!passedArgKeys.has('attributes') && attributes.length) {
		propsToAdd.push(
			ts.createPropertyAssignment('attributes', ts.createArrayLiteral(attributes.map(ts.createLiteral)))
		);
	}

	if (!passedArgKeys.has('events') && events.length) {
		propsToAdd.push(ts.createPropertyAssignment('events', ts.createArrayLiteral(events.map(ts.createLiteral))));
	}

	if (!passedArgKeys.has('properties') && properties.length) {
		propsToAdd.push(
			ts.createPropertyAssignment('properties', ts.createArrayLiteral(properties.map(ts.createLiteral)))
		);
	}

	// update nodes
	const newDecorator = ts.updateDecorator(
		decorator,
		ts.updateCall(
			decorator.expression,
			decorator.expression.expression,
			[widgetPropNode],
			[ts.updateObjectLiteral(decArg, [...decArg.properties, ...propsToAdd])]
		)
	);

	// not sure why ts.NodeArray<T> doesn't have splice...
	const decoratorIdx = node.decorators.indexOf(decorator);
	const updatedDecoratorList = node.decorators
		.slice(0, decoratorIdx)
		.concat([newDecorator, ...node.decorators.slice(decoratorIdx + 1)]);

	return ts.updateClassDeclaration(
		node,
		updatedDecoratorList,
		node.modifiers,
		node.name,
		node.typeParameters,
		node.heritageClauses,
		node.members
	);
}
