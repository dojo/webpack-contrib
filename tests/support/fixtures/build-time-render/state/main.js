(function main() {
	if (window.location.pathname === '/my-path') {
		const app = document.getElementById('app');
		const div = document.createElement('div');
		div.classList.add('hello');
		div.innerHTML = 'Root';
		app.appendChild(div);
	} else if (window.location.pathname === '/my-path/other') {
		const app = document.getElementById('app');
		const div = document.createElement('div');
		div.classList.add('other');
		div.innerHTML = 'Other';
		app.appendChild(div);
	} else {
		const app = document.getElementById('app');
		const div = document.createElement('div');
		div.classList.add('hello');
		div.innerHTML = 'Hello';
		app.appendChild(div);
	}
})();
