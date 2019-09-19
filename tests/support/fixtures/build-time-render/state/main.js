(function main() {
	const app = document.getElementById('app');
	let div = document.createElement('div');
	const route = window.location.pathname;

	function renderDefault() {
		const imgOne = document.createElement('img');
		const imgTwo = document.createElement('img');
		const imgThree = document.createElement('img');
		const imgFour = document.createElement('img');
		const imgFive = document.createElement('img');
		div.classList.add('hello', 'another');
		div.innerHTML = JSON.stringify(window.DojoHasEnvironment);
		app.appendChild(div);

		imgOne.setAttribute('src', 'https://example.com');
		div.appendChild(imgOne);

		imgTwo.setAttribute('src', 'http://example.com');
		div.appendChild(imgTwo);

		imgThree.setAttribute('src', '/image.svg');
		div.appendChild(imgThree);

		imgFour.setAttribute('src', './relative-image.svg');
		div.appendChild(imgFour);

		imgFive.setAttribute('src', '../other-relative-image.svg');
		div.appendChild(imgFive);
	}

	if (route === '/') {
		renderDefault();
	} else if (route === '/my-path') {
		div = document.createElement('div');
		div.classList.add('hello', 'another');
		div.innerHTML = JSON.stringify(window.DojoHasEnvironment);
		app.appendChild(div);
	} else if (route === '/my-path/other') {
		div = document.createElement('div');
		div.classList.add('other');
		div.innerHTML = 'Other';
		app.appendChild(div);

		let script = document.createElement('script');
		script.setAttribute('src', 'additional.js');

		document.body.appendChild(script);
	} else {
		renderDefault();
	}
	window.rendering = false;
})();
