import registryTransformer from '../../../src/registry-transformer/index';
import * as ts from 'typescript';

const nl = require('normalize-newline');
const { beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

const source = `
import { v, w } from '@dojo/framework/core/vdom';
import renderer from '@dojo/framework/core/vdom';
import WidgetBase from '@dojo/framework/core/WidgetBase';
import Bar from './widgets/Bar';
import Baz from './Baz';
import Quz from './Quz';
import { Blah } from './Qux';

export class Foo extends WidgetBase {
	protected render() {
		return v('div' [
			v('div', ['Foo']),
			w(Bar, {}),
			w(Baz, {}),
			w(Blah, {})
		]);
	}
}

export class Another extends WidgetBase {
	protected render() {
		return v('div' [
			w(Bar, {}),
			w(Baz, {}),
			w(Quz, {})
		]);
	}
}
export default HelloWorld;
`;

const sourceTsx = `
import WidgetBase from '@dojo/framework/core/WidgetBase';
import Bar from './widgets/Bar';
import Baz from './Baz';
import Quz from './Quz';
import { Blah } from './Qux';

export class Foo extends WidgetBase {
	protected render() {
		return (
			<div>
				<div>
					<div>Foo</div>
					<Bar prop="hello" />
					<Baz>
						<div>child</div>
					</Baz>
					<Blah />
				</div>
			</div>
		);
	}
}

export class Another extends WidgetBase {
	protected render() {
		return (
			<div>
				<Bar />
				<Baz />
				<Qux />
			</div>
		);
	}
}
`;

describe('registry-transformer', () => {
	let shared: any = {};

	beforeEach(() => {
		shared = require('../../../src/registry-transformer/shared');
		shared.modules = {};
		shared.all = {};
	});

	it('does not modify when no modules specified', () => {
		const transformer = registryTransformer(process.cwd(), []);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext
			},
			transformers: {
				before: [transformer]
			}
		});

		const resultTsx = ts.transpileModule(sourceTsx, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext,
				jsx: ts.JsxEmit.Preserve,
				jsxFactory: 'tsx'
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import { v, w } from '@dojo/framework/core/vdom';
import WidgetBase from '@dojo/framework/core/WidgetBase';
import Bar from './widgets/Bar';
import Baz from './Baz';
import Quz from './Quz';
import { Blah } from './Qux';
export class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w(Bar, {}),
            w(Baz, {}),
            w(Blah, {})]);
    }
}
export class Another extends WidgetBase {
    render() {
        return v('div'[w(Bar, {}),
            w(Baz, {}),
            w(Quz, {})]);
    }
}
export default HelloWorld;
`;
		const expectedTsx = `import WidgetBase from '@dojo/framework/core/WidgetBase';
import Bar from './widgets/Bar';
import Baz from './Baz';
import { Blah } from './Qux';
export class Foo extends WidgetBase {
    render() {
        return (<div>
				<div>
					<div>Foo</div>
					<Bar prop="hello"/>
					<Baz>
						<div>child</div>
					</Baz>
					<Blah />
				</div>
			</div>);
    }
}
export class Another extends WidgetBase {
    render() {
        return (<div>
				<Bar />
				<Baz />
				<Qux />
			</div>);
    }
}
`;
		assert.equal(nl(result.outputText), expected);
		assert.equal(nl(resultTsx.outputText), expectedTsx);
	});

	it('does elide modules and transform when specified', () => {
		const transformer = registryTransformer(process.cwd(), ['widgets/Bar', 'Qux', 'Baz']);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext
			},
			transformers: {
				before: [transformer]
			}
		});

		const resultTsx = ts.transpileModule(sourceTsx, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext,
				jsx: ts.JsxEmit.Preserve,
				jsxFactory: 'tsx'
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import { v, w } from '@dojo/framework/core/vdom';
import WidgetBase from '@dojo/framework/core/WidgetBase';
import Quz from './Quz';
import { Blah } from './Qux';
var __autoRegistryItems = { Bar: () => import("./widgets/Bar"), Baz: () => import("./Baz") };
export class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w({ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }, {}),
            w({ label: "__autoRegistryItem_Baz", registryItem: __autoRegistryItems.Baz }, {}),
            w(Blah, {})]);
    }
}
export class Another extends WidgetBase {
    render() {
        return v('div'[w({ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }, {}),
            w({ label: "__autoRegistryItem_Baz", registryItem: __autoRegistryItems.Baz }, {}),
            w(Quz, {})]);
    }
}
export default HelloWorld;
`;
		const expectedTsx = `import WidgetBase from '@dojo/framework/core/WidgetBase';
import { Blah } from './Qux';
var Loadable__ = { type: "registry" };
var __autoRegistryItems = { Bar: () => import("./widgets/Bar"), Baz: () => import("./Baz") };
export class Foo extends WidgetBase {
    render() {
        return (<div>
				<div>
					<div>Foo</div>
					<Loadable__ prop="hello" __autoRegistryItem={{ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }}/>
					<Loadable__ __autoRegistryItem={{ label: "__autoRegistryItem_Baz", registryItem: __autoRegistryItems.Baz }}>
						<div>child</div>
					</Loadable__>
					<Blah />
				</div>
			</div>);
    }
}
export class Another extends WidgetBase {
    render() {
        return (<div>
				<Loadable__ __autoRegistryItem={{ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }}/>
				<Loadable__ __autoRegistryItem={{ label: "__autoRegistryItem_Baz", registryItem: __autoRegistryItems.Baz }}/>
				<Qux />
			</div>);
    }
}
`;
		assert.equal(nl(result.outputText), expected);
		assert.equal(nl(resultTsx.outputText), expectedTsx);
	});

	it('elide modules and transform when based on a glob patterns', () => {
		const transformer = registryTransformer(process.cwd(), ['**/Bar', 'Qux', 'Baz']);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext
			},
			transformers: {
				before: [transformer]
			}
		});

		const resultTsx = ts.transpileModule(sourceTsx, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext,
				jsx: ts.JsxEmit.Preserve,
				jsxFactory: 'tsx'
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import { v, w } from '@dojo/framework/core/vdom';
import WidgetBase from '@dojo/framework/core/WidgetBase';
import Quz from './Quz';
import { Blah } from './Qux';
var __autoRegistryItems = { Bar: () => import("./widgets/Bar"), Baz: () => import("./Baz") };
export class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w({ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }, {}),
            w({ label: "__autoRegistryItem_Baz", registryItem: __autoRegistryItems.Baz }, {}),
            w(Blah, {})]);
    }
}
export class Another extends WidgetBase {
    render() {
        return v('div'[w({ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }, {}),
            w({ label: "__autoRegistryItem_Baz", registryItem: __autoRegistryItems.Baz }, {}),
            w(Quz, {})]);
    }
}
export default HelloWorld;
`;
		const expectedTsx = `import WidgetBase from '@dojo/framework/core/WidgetBase';
import { Blah } from './Qux';
var Loadable__ = { type: "registry" };
var __autoRegistryItems = { Bar: () => import("./widgets/Bar"), Baz: () => import("./Baz") };
export class Foo extends WidgetBase {
    render() {
        return (<div>
				<div>
					<div>Foo</div>
					<Loadable__ prop="hello" __autoRegistryItem={{ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }}/>
					<Loadable__ __autoRegistryItem={{ label: "__autoRegistryItem_Baz", registryItem: __autoRegistryItems.Baz }}>
						<div>child</div>
					</Loadable__>
					<Blah />
				</div>
			</div>);
    }
}
export class Another extends WidgetBase {
    render() {
        return (<div>
				<Loadable__ __autoRegistryItem={{ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }}/>
				<Loadable__ __autoRegistryItem={{ label: "__autoRegistryItem_Baz", registryItem: __autoRegistryItems.Baz }}/>
				<Qux />
			</div>);
    }
}
`;
		assert.equal(nl(result.outputText), expected);
		assert.equal(nl(resultTsx.outputText), expectedTsx);
	});

	it('replaces all widgets in all mode', () => {
		const transformer = registryTransformer(process.cwd(), [], true);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import { v, w } from '@dojo/framework/core/vdom';
import WidgetBase from '@dojo/framework/core/WidgetBase';
import { Blah } from './Qux';
var __autoRegistryItems = { Bar: () => import("./widgets/Bar"), Baz: () => import("./Baz"), Quz: () => import("./Quz") };
export class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w({ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }, {}),
            w({ label: "__autoRegistryItem_Baz", registryItem: __autoRegistryItems.Baz }, {}),
            w(Blah, {})]);
    }
}
export class Another extends WidgetBase {
    render() {
        return v('div'[w({ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }, {}),
            w({ label: "__autoRegistryItem_Baz", registryItem: __autoRegistryItems.Baz }, {}),
            w({ label: "__autoRegistryItem_Quz", registryItem: __autoRegistryItems.Quz }, {})]);
    }
}
export default HelloWorld;
`;
		assert.equal(nl(result.outputText), expected);
		assert.deepEqual(shared, {
			all: {
				Bar: 'widgets/Bar',
				Baz: 'Baz',
				Quz: 'Quz'
			},
			modules: {
				__autoRegistryItem_Bar: { path: 'widgets/Bar', routeName: [] },
				__autoRegistryItem_Baz: { path: 'Baz', routeName: [] },
				__autoRegistryItem_Quz: { path: 'Quz', routeName: [] }
			}
		});
	});

	it('can distinguish widgets in an route renderer', () => {
		const source = `
		import { v, w } from '@dojo/framework/core/vdom';
		import WidgetBase from '@dojo/framework/core/WidgetBase';
		import { Route } from '@dojo/framework/routing/Route';
		import Bar from './widgets/Bar';
		import Baz from './Baz';
		import Quz from './Quz';
		import Blah from './Qux';
		import Something from './Something';

		export class Foo extends WidgetBase {
			protected render() {
				return v('div' [
					v('div', ['Foo']),
					w(Blah, {}),
					w(Route, {
						id: 'my-foo-route',
						renderer: () => {
							return w(Something, {});
						}
					}),
					w(Route, {
						id: 'my-blah-route',
						renderer() {
							return w(Blah, {});
						}
					}),
					w(Bar, {}),
					w(Baz, {})
				]);
			}
		}

		export class Another extends WidgetBase {
			protected render() {
				return v('div' [
					w(Bar, {}),
					w(Baz, {}),
					w(Quz, {})
				]);
			}
		}
		export default HelloWorld;
		`;
		const transformer = registryTransformer(process.cwd(), ['widgets/Bar', 'Quz'], false, [
			'my-foo-route',
			'my-blah-route'
		]);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import { v, w } from '@dojo/framework/core/vdom';
import WidgetBase from '@dojo/framework/core/WidgetBase';
import { Route } from '@dojo/framework/routing/Route';
import Baz from './Baz';
import Blah from './Qux';
var __autoRegistryItems = { Something: () => import("./Something"), Blah: () => import("./Qux"), Bar: () => import("./widgets/Bar"), Quz: () => import("./Quz") };
export class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w(Blah, {}),
            w(Route, {
                id: 'my-foo-route',
                renderer: () => {
                    return w({ label: "__autoRegistryItem_Something", registryItem: __autoRegistryItems.Something }, {});
                }
            }),
            w(Route, {
                id: 'my-blah-route',
                renderer() {
                    return w({ label: "__autoRegistryItem_Blah", registryItem: __autoRegistryItems.Blah }, {});
                }
            }),
            w({ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }, {}),
            w(Baz, {})]);
    }
}
export class Another extends WidgetBase {
    render() {
        return v('div'[w({ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }, {}),
            w(Baz, {}),
            w({ label: "__autoRegistryItem_Quz", registryItem: __autoRegistryItems.Quz }, {})]);
    }
}
export default HelloWorld;
`;
		assert.equal(nl(result.outputText), expected);
		assert.deepEqual(shared, {
			all: {
				Bar: 'widgets/Bar',
				Baz: 'Baz',
				Blah: 'Qux',
				Quz: 'Quz',
				Something: 'Something'
			},
			modules: {
				__autoRegistryItem_Bar: { path: 'widgets/Bar', routeName: [] },
				__autoRegistryItem_Blah: { path: 'Qux', routeName: ['my-blah-route'] },
				__autoRegistryItem_Quz: { path: 'Quz', routeName: [] },
				__autoRegistryItem_Something: { routeName: ['my-foo-route'], path: 'Something' }
			}
		});
	});

	it('can distinguish widgets in outlet children', () => {
		const source = `
		import { v, w } from '@dojo/framework/core/vdom';
		import WidgetBase from '@dojo/framework/core/WidgetBase';
		import { Outlet } from '@dojo/framework/routing/Outlet';
		import Bar from './widgets/Bar';
		import Baz from './Baz';
		import Quz from './Quz';
        import Blah from './Qux';
        import WithChildren from './WithChildren';
		import Something from './Something';

		export class Foo extends WidgetBase {
			protected render() {
				return v('div' [
					v('div', ['Foo']),
                    w(Blah, {}),
                    w(Outlet, { id: 'main' }, [{
                        'my-foo-route':  w(Something, {}),
                        'my-blah-route': () => w(Blah, {})

                    }]),
                    w(WithChildren, {}, [{
                        'my-foo-route': w(Baz, {})
                    }]),
					w(Bar, {}),
					w(Baz, {})
				]);
			}
		}

		export class Another extends WidgetBase {
			protected render() {
				return v('div' [
					w(Bar, {}),
					w(Baz, {}),
					w(Quz, {})
				]);
			}
		}
		export default HelloWorld;
		`;
		const transformer = registryTransformer(process.cwd(), ['widgets/Bar', 'Quz'], false, [
			'my-foo-route',
			'my-blah-route'
		]);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import { v, w } from '@dojo/framework/core/vdom';
import WidgetBase from '@dojo/framework/core/WidgetBase';
import { Outlet } from '@dojo/framework/routing/Outlet';
import Baz from './Baz';
import Blah from './Qux';
import WithChildren from './WithChildren';
var __autoRegistryItems = { Something: () => import("./Something"), Blah: () => import("./Qux"), Bar: () => import("./widgets/Bar"), Quz: () => import("./Quz") };
export class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w(Blah, {}),
            w(Outlet, { id: 'main' }, [{
                    'my-foo-route': w({ label: "__autoRegistryItem_Something", registryItem: __autoRegistryItems.Something }, {}),
                    'my-blah-route': () => w({ label: "__autoRegistryItem_Blah", registryItem: __autoRegistryItems.Blah }, {})
                }]),
            w(WithChildren, {}, [{
                    'my-foo-route': w(Baz, {})
                }]),
            w({ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }, {}),
            w(Baz, {})]);
    }
}
export class Another extends WidgetBase {
    render() {
        return v('div'[w({ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }, {}),
            w(Baz, {}),
            w({ label: "__autoRegistryItem_Quz", registryItem: __autoRegistryItems.Quz }, {})]);
    }
}
export default HelloWorld;
`;
		assert.equal(nl(result.outputText), expected);
		assert.deepEqual(shared, {
			all: {
				Bar: 'widgets/Bar',
				Baz: 'Baz',
				Blah: 'Qux',
				Quz: 'Quz',
				Something: 'Something',
				WithChildren: 'WithChildren'
			},
			modules: {
				__autoRegistryItem_Bar: { path: 'widgets/Bar', routeName: [] },
				__autoRegistryItem_Blah: { path: 'Qux', routeName: ['my-blah-route'] },
				__autoRegistryItem_Quz: { path: 'Quz', routeName: [] },
				__autoRegistryItem_Something: { routeName: ['my-foo-route'], path: 'Something' }
			}
		});
	});

	it('can distinguish widgets in an route renderer tsx', () => {
		const source = `
import WidgetBase from '@dojo/framework/core/WidgetBase';
import Bar from './widgets/Bar';
import Baz from './Baz';
import Blah from './Qux';
import Route from '@dojo/framework/routing/Route';

export class Foo extends WidgetBase {
	protected render() {
		return (
			<div>
				<div>
					<Blah />
					<div>Foo</div>
					<Baz>
						<div>child</div>
					</Baz>
					<Route id="my-bar-route" renderer={ () => (<Bar />) } />
					<Route id="my-blah-route" renderer={ () => (<Blah />) } />
				</div>
			</div>
		);
	}
}
`;
		const transformer = registryTransformer(process.cwd(), [], false, ['my-bar-route', 'my-blah-route']);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext,
				jsx: ts.JsxEmit.Preserve,
				jsxFactory: 'tsx'
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import WidgetBase from '@dojo/framework/core/WidgetBase';
import Baz from './Baz';
import Blah from './Qux';
import Route from '@dojo/framework/routing/Route';
var Loadable__ = { type: "registry" };
var __autoRegistryItems = { Bar: () => import("./widgets/Bar"), Blah: () => import("./Qux") };
export class Foo extends WidgetBase {
    render() {
        return (<div>
				<div>
					<Blah />
					<div>Foo</div>
					<Baz>
						<div>child</div>
					</Baz>
					<Route id="my-bar-route" renderer={() => (<Loadable__ __autoRegistryItem={{ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }}/>)}/>
					<Route id="my-blah-route" renderer={() => (<Loadable__ __autoRegistryItem={{ label: "__autoRegistryItem_Blah", registryItem: __autoRegistryItems.Blah }}/>)}/>
				</div>
			</div>);
    }
}
`;
		assert.equal(nl(result.outputText), expected);
		assert.deepEqual(shared, {
			all: {
				Bar: 'widgets/Bar',
				Baz: 'Baz',
				Blah: 'Qux'
			},
			modules: {
				__autoRegistryItem_Bar: { path: 'widgets/Bar', routeName: ['my-bar-route'] },
				__autoRegistryItem_Blah: { path: 'Qux', routeName: ['my-blah-route'] }
			}
		});
	});

	it('can distinguish widgets in outlet children tsx', () => {
		const source = `
import WidgetBase from '@dojo/framework/core/WidgetBase';
import Bar from './widgets/Bar';
import Baz from './Baz';
import Blah from './Qux';
import Something from './Something';
import Outlet from '@dojo/framework/routing/Outlet';

export class Foo extends WidgetBase {
	protected render() {
		return (
			<div>
				<div>
					<Blah />
					<div>Foo</div>
					<Baz>
						<div>child</div>
                    </Baz>
                    <Something>{{
                        'my-bar-route': <Baz />,
                    }}</Something>
                    <Outlet id="main">{{
                        'my-bar-route': <Bar />,
                        'my-blah-route': () => <Blah />
                    }}</Outlet>
				</div>
			</div>
		);
	}
}
`;
		const transformer = registryTransformer(process.cwd(), [], false, ['my-bar-route', 'my-blah-route']);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext,
				jsx: ts.JsxEmit.Preserve,
				jsxFactory: 'tsx'
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import WidgetBase from '@dojo/framework/core/WidgetBase';
import Baz from './Baz';
import Blah from './Qux';
import Something from './Something';
import Outlet from '@dojo/framework/routing/Outlet';
var Loadable__ = { type: "registry" };
var __autoRegistryItems = { Bar: () => import("./widgets/Bar"), Blah: () => import("./Qux") };
export class Foo extends WidgetBase {
    render() {
        return (<div>
				<div>
					<Blah />
					<div>Foo</div>
					<Baz>
						<div>child</div>
                    </Baz>
                    <Something>{{
            'my-bar-route': <Baz />,
        }}</Something>
                    <Outlet id="main">{{
            'my-bar-route': <Loadable__ __autoRegistryItem={{ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }}/>,
            'my-blah-route': () => <Loadable__ __autoRegistryItem={{ label: "__autoRegistryItem_Blah", registryItem: __autoRegistryItems.Blah }}/>
        }}</Outlet>
				</div>
			</div>);
    }
}
`;
		assert.equal(nl(result.outputText), expected);
		assert.deepEqual(shared, {
			all: {
				Bar: 'widgets/Bar',
				Baz: 'Baz',
                Blah: 'Qux',
                Something: 'Something'
			},
			modules: {
				__autoRegistryItem_Bar: { path: 'widgets/Bar', routeName: ['my-bar-route'] },
				__autoRegistryItem_Blah: { path: 'Qux', routeName: ['my-blah-route'] }
			}
		});
	});

	it('replaces widgets without an async import in sync mode', () => {
		const transformer = registryTransformer(process.cwd(), [], true, [], true);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import { v, w } from '@dojo/framework/core/vdom';
import WidgetBase from '@dojo/framework/core/WidgetBase';
import Bar from './widgets/Bar';
import Baz from './Baz';
import Quz from './Quz';
import { Blah } from './Qux';
var __autoRegistryItems = { Bar: Bar, Baz: Baz, Quz: Quz };
export class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w({ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }, {}),
            w({ label: "__autoRegistryItem_Baz", registryItem: __autoRegistryItems.Baz }, {}),
            w(Blah, {})]);
    }
}
export class Another extends WidgetBase {
    render() {
        return v('div'[w({ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }, {}),
            w({ label: "__autoRegistryItem_Baz", registryItem: __autoRegistryItems.Baz }, {}),
            w({ label: "__autoRegistryItem_Quz", registryItem: __autoRegistryItems.Quz }, {})]);
    }
}
export default HelloWorld;
`;
		assert.equal(nl(result.outputText), expected);
		assert.deepEqual(shared.modules, {
			__autoRegistryItem_Bar: { path: 'widgets/Bar', routeName: [] },
			__autoRegistryItem_Baz: { path: 'Baz', routeName: [] },
			__autoRegistryItem_Quz: { path: 'Quz', routeName: [] }
		});
	});
});
