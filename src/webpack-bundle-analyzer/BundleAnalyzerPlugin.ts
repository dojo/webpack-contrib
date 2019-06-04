import * as path from 'path';
import * as fs from 'fs';
import * as mkdir from 'mkdirp';
import * as viewer from './viewer';
import { Compiler } from 'webpack';
const bfj = require('bfj');

export interface BundleAnalyzerOptions {
	reportFilename: string;
	generateStatsFile: boolean;
	statsFilename: string;
	statsOptions: string | null;
	analyzerMode: string;
	openAnalyzer: boolean;
	excludeBundles?: string;
}

export default class BundleAnalyzerPlugin {
	private opts: BundleAnalyzerOptions;
	private compiler: any;
	private _outputDirectory!: string;
	private _outputPath!: string;

	constructor(opts: Partial<BundleAnalyzerOptions>) {
		this.opts = {
			reportFilename: 'report.html',
			generateStatsFile: false,
			statsFilename: 'stats.json',
			statsOptions: null,
			analyzerMode: '',
			openAnalyzer: false,
			...opts
		};
	}

	apply(compiler: Compiler) {
		this.compiler = compiler;
		const done = (stats: any) => {
			this._outputPath = path.resolve(this.compiler.outputPath, this.opts.statsFilename);
			this._outputDirectory = path.dirname(this._outputPath);
			stats = stats.toJson(this.opts.statsOptions);
			stats = this.updateStatsHash(stats);
			if (this.opts.generateStatsFile) {
				this.generateStatsFile(stats);
			}
			this.generateStaticReport(stats);
		};

		compiler.hooks.done.tap(this.constructor.name, done);
	}

	updateStatsHash(stats: any): any {
		try {
			const manifest = JSON.parse(fs.readFileSync(path.join(this.compiler.outputPath, 'manifest.json'), 'utf8'));
			const originalManifest = JSON.parse(
				fs.readFileSync(path.join(this._outputDirectory, 'manifest.original.json'), 'utf8')
			);
			let updatedStats = JSON.stringify(stats);
			Object.keys(manifest).forEach((key) => {
				updatedStats = updatedStats.replace(new RegExp(originalManifest[key], 'g'), manifest[key]);
			});
			return JSON.parse(updatedStats);
		} catch (e) {
			return stats;
		}
	}

	async generateStatsFile(stats: any) {
		mkdir.sync(this._outputDirectory);

		try {
			await bfj.write(this._outputPath, stats, {
				promises: 'ignore',
				buffers: 'ignore',
				maps: 'ignore',
				iterables: 'ignore',
				circular: 'ignore'
			});
		} catch {}
	}

	generateStaticReport(stats: any) {
		viewer.generateReportData(stats, {
			reportFilename: path.resolve(this.compiler.outputPath, this.opts.reportFilename),
			bundleDir: this.getBundleDirFromCompiler(),
			excludeBundle: this.opts.excludeBundles
		});
	}

	getBundleDirFromCompiler() {
		return this.compiler.outputFileSystem.constructor.name === 'MemoryFileSystem' ? null : this.compiler.outputPath;
	}
}
