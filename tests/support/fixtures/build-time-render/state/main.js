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
		const imgOne = document.createElement('img');
		const imgTwo = document.createElement('img');
		const imgThree = document.createElement('img');
		const imgFour = document.createElement('img');
		const imgFive = document.createElement('img');
		div.classList.add('hello');
		div.innerHTML = 'Hello';
		app.appendChild(div);

		imgOne.setAttribute('src', 'https://localhost.com');
		app.appendChild(imgOne);

		imgTwo.setAttribute('src', 'http://localhost.com');
		app.appendChild(imgTwo);

		imgThree.setAttribute('src', '/image.svg');
		app.appendChild(imgThree);

		imgFour.setAttribute('src', './relative-image.svg');
		app.appendChild(imgFour);

		imgFive.setAttribute('src', '../other-relative-image.svg');
		app.appendChild(imgFive);
	}
})();
