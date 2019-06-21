declare module 'recast' {
	import recast = require('recast/main');

	export = recast;
}

declare module 'recast/main' {
	import {
		BaseNode,
		Program,
		Comment,
		Literal,
		Identifier,
		CallExpression,
		Expression,
		ExpressionStatement,
		VariableDeclaration,
		MemberExpression,
		ImportDeclaration,
		AssignmentExpression,
		TemplateLiteral,
		TemplateElement,
		VariableDeclarator,
		SourceLocation,
		SimpleCallExpression,
		Super,
		SpreadElement
	} from 'estree';

	namespace recast {
		interface NamedType<T> {
			check(node: BaseNode): node is T;
		}

		interface NamedTypes {
			// Not an exhaustive list
			Literal: Literal;
			Identifier: Identifier;
			CallExpression: CallExpression;
			MemberExpression: MemberExpression;
			ExpressionStatement: ExpressionStatement;
			VariableDeclaration: VariableDeclaration;
			ImportDeclaration: ImportDeclaration;
			AssignmentExpression: AssignmentExpression;
			TemplateLiteral: TemplateLiteral;
			TemplateElement: TemplateElement;
			VariableDeclarator: VariableDeclarator;
		}

		interface AST {
			program: Program;
		}

		interface Path<T extends BaseNode = BaseNode> {
			value: any;
			node: T;
			parentPath: Path<BaseNode>;
			name: string;
			replace(node: BaseNode | null): void;
		}

		interface VisitFunction<T extends BaseNode = BaseNode> {
			(this: { traverse(path: Path<BaseNode>): void }, path: Path<T>): void | false;
		}

		namespace types {
			export const namedTypes: { [type in keyof NamedTypes]: NamedType<NamedTypes[type]> };

			export const builders: {
				identifier(id: string): Identifier;
				commentLine(comment: string, trailing?: boolean, leading?: boolean): Comment;
				literal(value: boolean | string | number | null | RegExp): Literal;
				variableDeclarator(id: Identifier, value: Literal | Identifier): VariableDeclarator;
				variableDeclaration(value: string, declarators: VariableDeclarator[]): VariableDeclaration;
				callExpression(callee: Expression | Super, args: Array<Expression | SpreadElement>): CallExpression;
			};
			export function visit(
				ast: AST,
				visitCallbacks: Partial<{
					visitCallExpression: VisitFunction<CallExpression>;
					visitVariableDeclaration: VisitFunction<VariableDeclaration>;
					visitExpressionStatement: VisitFunction<ExpressionStatement>;
					visitDeclaration: VisitFunction<ImportDeclaration>;
				}>
			): void;
		}

		function parse(code: string, options?: { sourceFileName: string }): AST;

		function print(ast: AST, options?: { sourceMapName: string }): { code: string; map: any };
	}

	export = recast;
}

declare module 'recast/lib/util' {
	export function composeSourceMaps(sourceMap: { file: string }, map: any): any;
}
