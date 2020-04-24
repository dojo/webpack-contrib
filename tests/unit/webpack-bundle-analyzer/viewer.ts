const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import MockModule from '../../support/MockModule';
import { stub } from 'sinon';

const reportData = [
	{
		chunks: ['main'],
		label: 'main.21d27eb24e39764884d2.bundle.js',
		statSize: 176119,
		parsedSize: 53165,
		gzipSize: 15199,
		groups: [
			{
				label: 'node_modules',
				path: './node_modules',
				statSize: 171304,
				groups: [
					{
						label: '@dojo',
						path: './node_modules/@dojo',
						statSize: 157853,
						groups: [
							{
								label: 'framework',
								path: './node_modules/@dojo/framework',
								statSize: 157629,
								groups: [
									{
										label: 'core',
										path: './node_modules/@dojo/framework/core',
										statSize: 5824,
										groups: [
											{
												id: './node_modules/@dojo/framework/core/Destroyable.mjs',
												label: 'Destroyable.mjs',
												path: './node_modules/@dojo/framework/core/Destroyable.mjs',
												statSize: 1715,
												parsedSize: 441,
												gzipSize: 292
											},
											{
												id: './node_modules/@dojo/framework/core/Evented.mjs',
												label: 'Evented.mjs',
												path: './node_modules/@dojo/framework/core/Evented.mjs',
												statSize: 2151,
												parsedSize: 865,
												gzipSize: 470
											},
											{
												id: './node_modules/@dojo/framework/core/QueuingEvented.mjs',
												label: 'QueuingEvented.mjs',
												path: './node_modules/@dojo/framework/core/QueuingEvented.mjs',
												statSize: 1958,
												parsedSize: 647,
												gzipSize: 362
											}
										],
										parsedSize: 1953,
										gzipSize: 806
									}
								]
							}
						]
					}
				]
			},
			{
				label: 'src',
				path: './src',
				statSize: 4275,
				groups: [
					{
						id: './src/App.m.css',
						label: 'App.m.css',
						path: './src/App.m.css',
						statSize: 120,
						parsedSize: 83,
						gzipSize: 96
					},
					{
						id: './src/App.tsx',
						label: 'App.tsx',
						path: './src/App.tsx',
						statSize: 1381,
						parsedSize: 686,
						gzipSize: 306
					},
					{
						id: './src/main.css',
						label: 'main.css',
						path: './src/main.css',
						statSize: 41,
						parsedSize: 15,
						gzipSize: 35
					},
					{
						id: './src/main.ts',
						label: 'main.ts',
						path: './src/main.ts',
						statSize: 442,
						parsedSize: 461,
						gzipSize: 255
					},
					{
						id: './src/routes.ts',
						label: 'routes.ts',
						path: './src/routes.ts',
						statSize: 229,
						parsedSize: 143,
						gzipSize: 115
					},
					{
						label: 'widgets',
						path: './src/widgets',
						statSize: 2062,
						groups: [
							{
								id: './src/widgets/About.ts',
								label: 'About.ts',
								path: './src/widgets/About.ts',
								statSize: 223,
								parsedSize: 223,
								gzipSize: 168
							},
							{
								id: './src/widgets/Home.ts',
								label: 'Home.ts',
								path: './src/widgets/Home.ts',
								statSize: 221,
								parsedSize: 222,
								gzipSize: 168
							},
							{
								id: './src/widgets/Menu.ts',
								label: 'Menu.ts',
								path: './src/widgets/Menu.ts',
								statSize: 1186,
								parsedSize: 716,
								gzipSize: 291
							},
							{
								id: './src/widgets/Profile.ts',
								label: 'Profile.ts',
								path: './src/widgets/Profile.ts',
								statSize: 227,
								parsedSize: 225,
								gzipSize: 170
							},
							{
								label: 'styles',
								path: './src/widgets/styles',
								statSize: 205,
								groups: [
									{
										id: './src/widgets/styles/Menu.m.css',
										label: 'Menu.m.css',
										path: './src/widgets/styles/Menu.m.css',
										statSize: 205,
										parsedSize: 162,
										gzipSize: 137
									}
								],
								parsedSize: 162,
								gzipSize: 137
							}
						],
						parsedSize: 1548,
						gzipSize: 407
					}
				],
				parsedSize: 2936,
				gzipSize: 734
			},
			{
				id: 0,
				label:
					'multi @dojo/webpack-contrib/build-time-render/hasBuildTimeRender /path/src/main.css /path/src/main.ts',
				path:
					'./multi @dojo/webpack-contrib/build-time-render/hasBuildTimeRender /path/src/main.css /path/src/main.ts',
				statSize: 52,
				parsedSize: 147,
				gzipSize: 134
			}
		]
	}
];

const expectedBundleContent =
	'window.__bundleContent = {"main.21d27eb24e39764884d2.bundle.js":{"chunks":["main"],"label":"main.21d27eb24e39764884d2.bundle.js","statSize":176119,"parsedSize":53165,"gzipSize":15199,"groups":[{"label":"node_modules","path":"./node_modules","statSize":171304,"groups":[{"label":"@dojo","path":"./node_modules/@dojo","statSize":157853,"groups":[{"label":"framework","path":"./node_modules/@dojo/framework","statSize":157629,"groups":[{"label":"core","path":"./node_modules/@dojo/framework/core","statSize":5824,"groups":[{"id":"./node_modules/@dojo/framework/core/Destroyable.mjs","label":"Destroyable.mjs","path":"./node_modules/@dojo/framework/core/Destroyable.mjs","statSize":1715,"parsedSize":441,"gzipSize":292},{"id":"./node_modules/@dojo/framework/core/Evented.mjs","label":"Evented.mjs","path":"./node_modules/@dojo/framework/core/Evented.mjs","statSize":2151,"parsedSize":865,"gzipSize":470},{"id":"./node_modules/@dojo/framework/core/QueuingEvented.mjs","label":"QueuingEvented.mjs","path":"./node_modules/@dojo/framework/core/QueuingEvented.mjs","statSize":1958,"parsedSize":647,"gzipSize":362}],"parsedSize":1953,"gzipSize":806}]}]}]},{"label":"src","path":"./src","statSize":4275,"groups":[{"id":"./src/App.m.css","label":"App.m.css","path":"./src/App.m.css","statSize":120,"parsedSize":83,"gzipSize":96},{"id":"./src/App.tsx","label":"App.tsx","path":"./src/App.tsx","statSize":1381,"parsedSize":686,"gzipSize":306},{"id":"./src/main.css","label":"main.css","path":"./src/main.css","statSize":41,"parsedSize":15,"gzipSize":35},{"id":"./src/main.ts","label":"main.ts","path":"./src/main.ts","statSize":442,"parsedSize":461,"gzipSize":255},{"id":"./src/routes.ts","label":"routes.ts","path":"./src/routes.ts","statSize":229,"parsedSize":143,"gzipSize":115},{"label":"widgets","path":"./src/widgets","statSize":2062,"groups":[{"id":"./src/widgets/About.ts","label":"About.ts","path":"./src/widgets/About.ts","statSize":223,"parsedSize":223,"gzipSize":168},{"id":"./src/widgets/Home.ts","label":"Home.ts","path":"./src/widgets/Home.ts","statSize":221,"parsedSize":222,"gzipSize":168},{"id":"./src/widgets/Menu.ts","label":"Menu.ts","path":"./src/widgets/Menu.ts","statSize":1186,"parsedSize":716,"gzipSize":291},{"id":"./src/widgets/Profile.ts","label":"Profile.ts","path":"./src/widgets/Profile.ts","statSize":227,"parsedSize":225,"gzipSize":170},{"label":"styles","path":"./src/widgets/styles","statSize":205,"groups":[{"id":"./src/widgets/styles/Menu.m.css","label":"Menu.m.css","path":"./src/widgets/styles/Menu.m.css","statSize":205,"parsedSize":162,"gzipSize":137}],"parsedSize":162,"gzipSize":137}],"parsedSize":1548,"gzipSize":407}],"parsedSize":2936,"gzipSize":734},{"id":0,"label":"multi @dojo/webpack-contrib/build-time-render/hasBuildTimeRender /path/src/main.css /path/src/main.ts","path":"./multi @dojo/webpack-contrib/build-time-render/hasBuildTimeRender /path/src/main.css /path/src/main.ts","statSize":52,"parsedSize":147,"gzipSize":134}]}}';
const expectedBundleList = 'window.__bundleList = ["main.21d27eb24e39764884d2.bundle.js"]';

let mockModule: MockModule;

describe('webpack-bundle-analyzer - viewer', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../../src/webpack-bundle-analyzer/viewer', require);
		mockModule.dependencies(['fs-extra', './analyzer', 'glob']);
	});
	afterEach(() => {
		mockModule.destroy();
	});
	it('generateReportData', () => {
		const fsMock = mockModule.getMock('fs-extra');
		const getViewerDataMock = mockModule.getMock('./analyzer').getViewerData;
		const globMock = mockModule.getMock('glob').ctor;
		globMock.sync = stub().returns(['file-one', 'file-two']);
		getViewerDataMock.returns(reportData);
		const generateReportData = mockModule.getModuleUnderTest().generateReportData;
		const chunkMap = generateReportData('stats', { bundleDir: 'foo' });
		assert.strictEqual(fsMock.writeFileSync.firstCall.args[1], expectedBundleContent);
		assert.strictEqual(fsMock.writeFileSync.secondCall.args[1], expectedBundleList);
		assert.strictEqual(JSON.stringify(chunkMap), JSON.stringify({ main: reportData[0] }));
	});
});
