const axios = require('axios');
const fs = require('fs');
const path = require('path');

const tarballPath = './tarball/';
const npmRegistry = 'https://registry.npmmirror.com/';
const packageLock = JSON.parse(fs.readFileSync('./test/package-lock.json'));
const packages = Object.entries(packageLock.dependencies);

(async function () {
	// Create tarball directory if it doesn't exist
	if (!fs.existsSync(tarballPath)) {
		fs.mkdirSync(tarballPath);
	}
	// Loop through packages and download tarballs
	for (const [packageName, packagesValue] of packages) {
		await downloadTgz(packageName, packagesValue);
	}
}())

async function downloadTgz(packageName, packagesValue) {
	// Split package name by '/' to create directory structure
	const packageNames = packageName.split('/');
	let directory = tarballPath;
	for (let i = 0; i < packageNames.length; i++) {
		directory = path.join(directory, packageNames[i]);
		// Create directory if it doesn't exist
		if (!fs.existsSync(directory)) {
			fs.mkdirSync(directory);
		}
	}
	// Set directory path for tarball file
	directory = path.join(directory, `${packageNames[packageNames.length - 1]}-${packagesValue.version}.tgz`);
	// Download tarball and package.json files
	const tgz = axios.get(packagesValue.resolved, { responseType: 'stream' });
	const packageJson = axios.get(npmRegistry + packageName);
	try {
		const [tgzResponse, packageJsonResponse] = await Promise.all([tgz, packageJson]);
		// Write tarball file to disk
		const file = fs.createWriteStream(directory);
		tgzResponse.data.pipe(file);
		// Write package.json file to disk
		fs.writeFileSync(path.join(path.dirname(directory), 'package.json'), JSON.stringify(packageJsonResponse.data));
		console.info(`finished: ${packageName}`);
	} catch (err) {
		console.error(`error: ${err}`);
	}
}
