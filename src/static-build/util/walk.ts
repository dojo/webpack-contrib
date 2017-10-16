import { Node } from 'estree';

export type EnterFunction = (this: { skip(): void; }, node: Node, parent: Node | null, prop: string | undefined, index: number | undefined) => void;
export type LeaveFunction = (this: null, node: Node, parent: Node | null, prop: string | undefined, index: number | undefined) => void;

export interface WalkOptions {
	/**
	 * A callback function that is called when a node is entered.  `this.skip()` will cause the walker to not
	 * descend further into the tree.
	 */
	enter?: EnterFunction;

	/**
	 * A callback function that is called whenever a node is _exited_.
	 */
	leave?: LeaveFunction;
}

/**
 * Local context for enter callbacks that provides an ability to skip a node and its children.
 */
const context = {
	skip() {
		context.shouldSkip = true;
	},
	shouldSkip: false
};

const childKeysCache: { [type: string]: string[]; } = {};

function visit(node: Node | null, parent: Node | null, enter?: EnterFunction, leave?: LeaveFunction, prop?: string, index?: number) {
	if (!node) {
		return;
	}

	if (enter) {
		context.shouldSkip = false;
		enter.call(context, node, parent, prop, index);
		if (context.shouldSkip) {
			return;
		}
	}

	const keys = childKeysCache[node.type] ||
		(childKeysCache[node.type] = Object.keys(node).filter((key) => typeof (node as any)[key] === 'object'));

	keys.forEach((key) => {
		const value: Node | null = (node as any)[key];
		if (Array.isArray(value)) {
			value.forEach((element: Node, idx) => {
				visit(element, node, enter, leave, key, idx);
			});
		}
		else if (value && value.type) {
			visit(value, node, enter, leave, key);
		}
	});

	if (leave) {
		leave.call(null, node, parent, prop, index);
	}
}

/**
 * Walk a estree compatabile AST tree, calling any callback functions provided.
 * @param node The root estree Node to start walking
 * @param param1 An object with `enter` and `leave` properties
 */
export default function walk(node: Node, { enter, leave }: WalkOptions) {
	visit(node, null, enter, leave);
}
