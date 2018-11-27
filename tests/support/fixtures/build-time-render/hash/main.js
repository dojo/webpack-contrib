(function main() {
	const app = document.getElementById('app');
	let div = document.createElement('div');
	div.classList.add('hello');
	div.innerHTML = 'Hello';
	app.appendChild(div);

	window.addEventListener('hashchange', () => {
		app.removeChild(div);
		if (window.location.hash === '#my-path') {
			div = document.createElement('div');
			div.classList.add('other');
			div.innerHTML = 'Root';
			app.appendChild(div);
		} else {
			div = document.createElement('div');
			div.classList.add('hello');
			div.innerHTML = 'Hello';
			app.appendChild(div);
		}
	}, false);
})();
