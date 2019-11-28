export const classesMap = new Map<string, { [index: string]: string }>();

export default function(this: any, content: string) {
	const resourcePath = this.resourcePath;
	const localsRexExp = /exports.locals = ({[.\s\S]*});/;
	const matches = content.match(localsRexExp);
	const moduleMappings = classesMap.get(resourcePath);
	if (matches && matches.length && moduleMappings) {
		return content.replace(localsRexExp, `exports.locals = ${JSON.stringify(moduleMappings)};`);
	}
	return content;
}
