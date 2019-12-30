import * as path from 'path';
import * as webpack from 'webpack';
import * as fs from 'fs';

const packager = require('electron-packager');

interface ElectronPluginOptions {
	electron: {
		browser: any;
		packaging: any;
	};
	dist: boolean;
	watch: boolean;
	serve: boolean;
	port: number;
	basePath: string;
	outputPath: string;
}

export class ElectronPlugin {
	private _packageJson: any = {};
	private _options: ElectronPluginOptions;
	private _defaultOptions: ElectronPluginOptions = {
		dist: false,
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

	constructor(options: Partial<ElectronPluginOptions>) {
		this._options = { ...this._defaultOptions, ...options };
		this._options.electron.browser = {
			...this._defaultOptions.electron.browser,
			...this._options.electron.browser
		};
		this._options.electron.packaging = {
			...this._defaultOptions.electron.packaging,
			...this._options.electron.packaging
		};
		const { basePath } = this._options;
		const packageJsonPath = path.join(basePath, 'package.json');
		this._packageJson = fs.existsSync(packageJsonPath) ? require(packageJsonPath) : {};
	}
	apply(compiler: webpack.Compiler) {
		const {
			electron: { browser, packaging },
			dist,
			watch,
			serve,
			port,
			outputPath
		} = this._options;

		const definePlugin = new webpack.DefinePlugin({
			ELECTRON_BROWSER_OPTIONS: JSON.stringify(browser),
			ELECTRON_WATCH_SERVE: JSON.stringify(watch && serve),
			ELECTRON_SERVE_PORT: JSON.stringify(port)
		});

		definePlugin.apply(compiler);

		compiler.hooks.done.tapAsync(this.constructor.name, (stats: any, callback: any) => {
			const newPackageJson = { ...this._packageJson, main: 'main.electron.js' };
			fs.writeFileSync(path.resolve(outputPath, 'package.json'), JSON.stringify(newPackageJson));
			if (dist && !watch) {
				packager({ ...packaging, app: this._packageJson.name }).then(() => callback());
			} else {
				callback();
			}
		});
	}
}
