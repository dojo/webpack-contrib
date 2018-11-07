(function main() {
	if (window.location.hash === '#my-path') {
		const app = document.getElementById('app');
		const div = document.createElement('div');
		div.classList.add('other');
		div.innerHTML = 'Root';
		app.appendChild(div);
	} else {
		const app = document.getElementById('app');
		const div = document.createElement('div');
		div.classList.add('hello');
		div.innerHTML = 'Hello';
		app.appendChild(div);
	}
})();
