const webpack = require('webpack');

module.exports = opts => {
	opts = Object.assign({
		prod: false
	}, opts);

	return {
		context: __dirname,
		entry: './client/viewer',
		output: {
			path: `${__dirname}/${
				opts.prod ? '../../dist/release/webpack-bundle-analyzer' : '../../dist/dev/src/webpack-bundle-analyzer'
				}/public`,
			filename: 'viewer.js',
			publicPath: '/'
		},

		resolve: {
			modules: [
				'node_modules'
			],
			extensions: ['.js', '.jsx']
		},

		devtool: 'source-map',

		module: {
			rules: [
				{
					test: /\.jsx?$/,
					exclude: /node_modules/,
					loader: 'babel-loader',
					options: {
						presets: [
							['env', { targets: { uglify: true } }]
						],
						plugins: [
							'transform-class-properties',
							'transform-react-jsx',
							['transform-object-rest-spread', { useBuiltIns: true }]
						]
					}
				},
				{
					test: /\.css$/,
					use: [
						'style-loader',
						{
							loader: 'css-loader',
							options: {
								modules: true,
								minimize: (opts.env === 'prod'),
								localIdentName: '[name]__[local]'
							}
						}
					]
				}
			]
		},

		plugins: (plugins => {
			plugins.push(
				new webpack.DefinePlugin({
					'process.env': {
						NODE_ENV: '"production"'
					}
				}),
				new webpack.optimize.OccurrenceOrderPlugin(),
				new webpack.optimize.UglifyJsPlugin({
					compress: {
						warnings: false,
						negate_iife: false
					},
					mangle: true,
					comments: false,
					sourceMap: true
				})
			);

			return plugins;
		})([])
	};
};
