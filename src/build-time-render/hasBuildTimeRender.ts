import { add, exists } from '@dojo/core/has';

if (!exists('build-time-render')) {
	add('build-time-render', false, false);
}
