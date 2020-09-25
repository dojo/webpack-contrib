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
		document.title = "Hello home";
		const meta = document.createElement('meta');
		meta.setAttribute('name', 'description');
		meta.setAttribute('content', 'home');
		document.head.appendChild(meta);
		renderDefault();
	} else if (route === '/my-path') {
		document.title = "Hello my-path";
		const meta = document.createElement('meta');
		meta.setAttribute('name', 'description');
		meta.setAttribute('content', 'my-path');
		document.head.appendChild(meta);
		const link = document.createElement('link');
		link.setAttribute('href', 'something');
		link.setAttribute('rel', 'preconnect');
		const script = document.createElement('script');
		script.setAttribute('src', 'external.js');
		document.head.appendChild(link);
		document.head.appendChild(script);
		div = document.createElement('div');
		div.classList.add('hello', 'another');
		div.innerHTML = JSON.stringify(window.DojoHasEnvironment);
		app.appendChild(div);
	} else if (route === '/my-path/other') {
		document.title = "Hello my-path/other";
		const meta = document.createElement('meta');
		meta.setAttribute('name', 'description');
		meta.setAttribute('content', 'my-path other');
		document.head.appendChild(meta);
		div = document.createElement('div');
		div.classList.add('other');
		div.innerHTML = 'Other';
		app.appendChild(div);
	} else {
		document.title = "Hello home";
		const meta = document.createElement('meta');
		meta.setAttribute('name', 'description');
		meta.setAttribute('content', 'home');
		document.head.appendChild(meta);
		renderDefault();
	}
	window.test = {
		rendering: false
	}
})();
