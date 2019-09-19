(function main() {
	const hash = window.location.hash;
	const app = document.getElementById('app');
	let div = document.createElement('div');
	if (!hash) {
		div.classList.add('hello', 'link');
		div.innerHTML = 'Hello';
	} else if (hash === '#my-path') {
		div = document.createElement('div');
		div.classList.add('other');
		div.innerHTML = 'Root';
	}
	app.appendChild(div);
	window.rendering = false;
})();
