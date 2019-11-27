export const classesMap = new Map<string, { [index: string]: string }>();

export default function(this: any, content: string) {
	const resourcePath = this.resourcePath;
	const localsRexExp = /exports.locals = ({[.\s\S]*});/;
	const matches = content.match(localsRexExp);
	const moduleMappings = classesMap.get(resourcePath);
	if (matches && matches.length && moduleMappings) {
		const transformedClassNames = JSON.parse(matches[1]);
		const updatedModuleMappings = Object.keys(moduleMappings).reduce(
			(updated, className) => {
				const classNamesString = moduleMappings[className];
				const classNames = classNamesString.split(' ');
				updated[className] = classNames
					.map((lookup) => {
						return transformedClassNames[lookup];
					})
					.join(' ');
				return updated;
			},
			{} as { [index: string]: any }
		);
		const response = content.replace(localsRexExp, `exports.locals = ${JSON.stringify(updatedModuleMappings)};`);
		return response;
	}
	return content;
}
