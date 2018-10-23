import registryTransformer from '../../../src/registry-transformer/index';
import * as ts from 'typescript';

const nl = require('normalize-newline');
const { beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

const source = `
import { v, w } from '@dojo/framework/widget-core/d';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
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
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
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

		const expected = `import { v, w } from '@dojo/framework/widget-core/d';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
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
		const expectedTsx = `import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
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

		const expected = `import { v, w } from '@dojo/framework/widget-core/d';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
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
		const expectedTsx = `import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
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

		const expected = `import { v, w } from '@dojo/framework/widget-core/d';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
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
				__autoRegistryItem_Bar: { path: 'widgets/Bar', outletName: [] },
				__autoRegistryItem_Baz: { path: 'Baz', outletName: [] },
				__autoRegistryItem_Quz: { path: 'Quz', outletName: [] }
			}
		});
	});

	it('can distinguish widgets in an outlet renderer', () => {
		const source = `
		import { v, w } from '@dojo/framework/widget-core/d';
		import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
		import { Outlet } from '@dojo/framework/routing/Outlet';
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
					w(Outlet, {
						id: 'my-foo-outlet',
						renderer: () => {
							return w(Something, {});
						}
					}),
					w(Outlet, {
						id: 'my-blah-outlet',
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
			'my-foo-outlet',
			'my-blah-outlet'
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

		const expected = `import { v, w } from '@dojo/framework/widget-core/d';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { Outlet } from '@dojo/framework/routing/Outlet';
import Baz from './Baz';
import Blah from './Qux';
var __autoRegistryItems = { Something: () => import("./Something"), Blah: () => import("./Qux"), Bar: () => import("./widgets/Bar"), Quz: () => import("./Quz") };
export class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w(Blah, {}),
            w(Outlet, {
                id: 'my-foo-outlet',
                renderer: () => {
                    return w({ label: "__autoRegistryItem_Something", registryItem: __autoRegistryItems.Something }, {});
                }
            }),
            w(Outlet, {
                id: 'my-blah-outlet',
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
				__autoRegistryItem_Bar: { path: 'widgets/Bar', outletName: [] },
				__autoRegistryItem_Blah: { path: 'Qux', outletName: ['my-blah-outlet'] },
				__autoRegistryItem_Quz: { path: 'Quz', outletName: [] },
				__autoRegistryItem_Something: { outletName: ['my-foo-outlet'], path: 'Something' }
			}
		});
	});

	it('can distinguish widgets in an outlet renderer tsx', () => {
		const source = `
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import Bar from './widgets/Bar';
import Baz from './Baz';
import Blah from './Qux';
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
					<Outlet id="my-bar-outlet" renderer={ () => (<Bar />) } />
					<Outlet id="my-blah-outlet" renderer={ () => (<Blah />) } />
				</div>
			</div>
		);
	}
}
`;
		const transformer = registryTransformer(process.cwd(), [], false, ['my-bar-outlet', 'my-blah-outlet']);
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

		const expected = `import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import Baz from './Baz';
import Blah from './Qux';
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
					<Outlet id="my-bar-outlet" renderer={() => (<Loadable__ __autoRegistryItem={{ label: "__autoRegistryItem_Bar", registryItem: __autoRegistryItems.Bar }}/>)}/>
					<Outlet id="my-blah-outlet" renderer={() => (<Loadable__ __autoRegistryItem={{ label: "__autoRegistryItem_Blah", registryItem: __autoRegistryItems.Blah }}/>)}/>
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
				__autoRegistryItem_Bar: { path: 'widgets/Bar', outletName: ['my-bar-outlet'] },
				__autoRegistryItem_Blah: { path: 'Qux', outletName: ['my-blah-outlet'] }
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

		const expected = `import { v, w } from '@dojo/framework/widget-core/d';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
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
			__autoRegistryItem_Bar: { path: 'widgets/Bar', outletName: [] },
			__autoRegistryItem_Baz: { path: 'Baz', outletName: [] },
			__autoRegistryItem_Quz: { path: 'Quz', outletName: [] }
		});
	});
});
