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
			const assetHashPath = path.join(
				path.dirname(path.resolve(this.compiler.outputPath, this.opts.statsFilename)),
				'assetHashMap.json'
			);
			const assetHashMap = JSON.parse(fs.readFileSync(assetHashPath, 'utf8'));
			let updatedStats = JSON.stringify(stats);
			Object.keys(assetHashMap).forEach((hash) => {
				const originalHash = assetHashMap[hash];
				updatedStats = updatedStats.replace(new RegExp(originalHash, 'g'), hash);
			});
			return JSON.parse(updatedStats);
		} catch (e) {
			return stats;
		}
	}

	async generateStatsFile(stats: any) {
		const statsFilePath = path.resolve(this.compiler.outputPath, this.opts.statsFilename);
		mkdir.sync(path.dirname(statsFilePath));

		try {
			await bfj.write(statsFilePath, stats, {
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
