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
		const linkOne = document.createElement('a');
		const linkTwo = document.createElement('a');
		const linkThree = document.createElement('a');
		const linkMailto = document.createElement('a');
		const linkFile = document.createElement('a');
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

		linkOne.setAttribute('href', 'my-path');
		div.appendChild(linkOne);

		linkTwo.setAttribute('href', 'other');
		div.appendChild(linkTwo);

		linkThree.setAttribute('href', 'bad.path');
		div.appendChild(linkThree);

		linkMailto.setAttribute('href', 'mailto:me@email.com');
		div.appendChild(linkMailto);

		linkFile.setAttribute('href', 'file://file.location');
		div.appendChild(linkFile);
	}

	if (route === '/') {
		renderDefault();
	} else if (route === '/my-path') {
		div = document.createElement('div');
		div.classList.add('hello', 'another');
		div.innerHTML = JSON.stringify(window.DojoHasEnvironment);
		const link = document.createElement('a');
		link.setAttribute('href', 'my-path/other');
		div.appendChild(link);
		const excludedLinkOne = document.createElement('a');
		excludedLinkOne.setAttribute('href', 'excluded')
		const excludedLinkTwo = document.createElement('a');
		excludedLinkTwo.setAttribute('href', '/other/excluded');
		const badLink = document.createElement('a');
		badLink.setAttribute('href', 'bad.path2');

		div.appendChild(excludedLinkOne);
		div.appendChild(excludedLinkTwo);
		div.appendChild(badLink);
		app.appendChild(div);
	} else if (route === '/my-path/other') {
		div = document.createElement('div');
		div.classList.add('other');
		div.classList.add('media:colon');
		div.classList.add('not');
		div.classList.add('other-not');
		div.innerHTML = 'Other';
		app.appendChild(div);

		let script = document.createElement('script');
		script.setAttribute('src', '/additional.js');

		document.body.appendChild(script);
	} else {
		renderDefault();
	}
	window.test = {
		rendering: false
	}
})();
