import * as path from 'path';
import * as fs from 'fs';
import * as mkdir from 'mkdirp';
import * as viewer from './viewer';
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

export default function analyzeBundles(stats: any, config: any, optsOverrides: Partial<BundleAnalyzerOptions>) {
	const opts: BundleAnalyzerOptions = {
		reportFilename: 'report.html',
		generateStatsFile: false,
		statsFilename: 'stats.json',
		statsOptions: null,
		analyzerMode: '',
		openAnalyzer: false,
		...optsOverrides
	};
	const singleConfig = Array.isArray(config) ? config[0] : config;
	const webpackOutputPath = singleConfig.output.path;
	const outputPath = path.resolve(singleConfig.output.path, opts.statsFilename);
	const outputDirectory = path.dirname(outputPath);
	stats = stats.toJson(opts.statsOptions);
	stats = updateStatsHash(stats, webpackOutputPath, outputDirectory);
	if (opts.generateStatsFile) {
		generateStatsFile(stats, outputDirectory, outputPath);
	}
	return generateStaticReport(stats, webpackOutputPath, opts.reportFilename, opts.excludeBundles);
}

function updateStatsHash(stats: any, webpackOutputPath: string, outputDirectory: string): any {
	try {
		const manifest = JSON.parse(fs.readFileSync(path.join(webpackOutputPath, 'manifest.json'), 'utf8'));
		const originalManifest = JSON.parse(
			fs.readFileSync(path.join(outputDirectory, 'manifest.original.json'), 'utf8')
		);
		let updatedStats = JSON.stringify(stats);
		Object.keys(manifest).forEach((key) => {
			if (originalManifest[key]) {
				updatedStats = updatedStats.replace(new RegExp(originalManifest[key], 'g'), manifest[key]);
			}
		});
		return JSON.parse(updatedStats);
	} catch (e) {
		return stats;
	}
}

async function generateStatsFile(stats: any, outputDirectory: string, outputPath: string) {
	mkdir.sync(outputDirectory);

	try {
		await bfj.write(outputPath, stats, {
			promises: 'ignore',
			buffers: 'ignore',
			maps: 'ignore',
			iterables: 'ignore',
			circular: 'ignore'
		});
	} catch {}
}

function generateStaticReport(stats: any, webpackOutputPath: string, reportFilename: string, excludeBundles?: string) {
	return viewer.generateReportData(stats, {
		reportFilename: path.resolve(webpackOutputPath, reportFilename),
		bundleDir: webpackOutputPath,
		excludeBundle: excludeBundles
	});
}
