const packager = require('electron-packager');
import * as path from 'path';
import * as webpack from 'webpack';
import * as fs from 'fs';

interface ElectronPluginOptions {
	electron: {
		browser: any;
		packaging: any;
	};
	watch: boolean;
	serve: boolean;
	port: number;
	basePath: string;
	outputPath: string;
}

export class ElectronPlugin {
	private _options: ElectronPluginOptions;
	private _defaultOptions: ElectronPluginOptions = {
		watch: false,
		serve: false,
		port: 9999,
		basePath: process.cwd(),
		outputPath: 'output/dist',
		electron: {
			browser: { width: 800, height: 600 },
			packaging: {
				dir: 'output/dist',
				app: 'app',
				out: 'output/app',
				overwrite: true
			}
		}
	};

	constructor(options: any) {
		this._options = { ...this._defaultOptions, ...options };
		this._options.electron.browser = {
			...this._defaultOptions.electron.browser,
			...options.electron.browser
		};
		this._options.electron.packaging = {
			...this._defaultOptions.electron.packaging,
			...options.electron.packaging
		};
	}
	apply(compiler: webpack.Compiler) {
		const {
			electron: { browser, packaging },
			watch,
			serve,
			port,
			basePath,
			outputPath
		} = this._options;
		const definePlugin = new webpack.DefinePlugin({
			ELECTRON_BROWSER_OPTIONS: JSON.stringify(browser),
			ELECTRON_WATCH_SERVE: JSON.stringify(!!(watch && serve)),
			ELECTRON_SERVE_PORT: JSON.stringify(port)
		});

		definePlugin.apply(compiler);

		compiler.hooks.done.tapAsync(this.constructor.name, (stats: any, callback: any) => {
			const packageJsonPath = path.join(basePath, 'package.json');
			const packageJson = fs.existsSync(packageJsonPath) ? require(packageJsonPath) : {};
			const newPackageJson = { ...packageJson, main: 'main.electron.js' };
			this._options.electron.packaging.app = packageJson.name || this._options.electron.packaging.app;
			fs.writeFileSync(path.resolve(outputPath, 'package.json'), JSON.stringify(newPackageJson));
			packager(packaging).then(() => callback());
		});
	}
}
