const axios = require('axios');
const fs = require("fs");
const tarballPath = './tarball/';
const npmRegistry = 'https://registry.npmmirror.com/';
const packageLock = JSON.parse(fs.readFileSync('./test/package-lock.json'))
const packages = Object.entries(packageLock.dependencies);

function main() {
	const tarballs = new Map();
	for (const [packageName, packagesValue] of packages) {
		tarballs.set(packageName, packagesValue);
	}
	if (tarballs.size > 0 && !fs.existsSync(tarballPath)) {
		fs.mkdirSync(tarballPath);
	}
	tarballs.forEach((value, key) =>  downloadTgz(key, value));
}
function downloadTgz(packageName, packagesValue) {
	const packageNames = packageName.split('/');
	let directory = tarballPath + packageName;
	if (packageNames.length >= 1) {
		if (!fs.existsSync(tarballPath + packageNames[0])) {
			fs.mkdirSync(tarballPath + packageNames[0]);
			directory = tarballPath + packageNames[0];
		}
		if (packageNames[1] && !fs.existsSync(tarballPath + packageNames[0] + '/' + packageNames[1])) {
			fs.mkdirSync(tarballPath + packageNames[0] + '/' + packageNames[1])
			directory = tarballPath + packageNames[0] + '/' + packageNames[1];
		}
	}
	const tgz = axios.get(packagesValue.resolved, { responseType: 'stream' });
	const packageJson = axios.get(npmRegistry + packageName)
	Promise.all([tgz, packageJson]).then(res => {
		const [tgz, packageJson] = res;
		const file = fs.createWriteStream(directory + '/' + packageNames[packageNames.length - 1] + '-' + packagesValue.version + '.tgz');
		tgz.data.pipe(file);
		fs.writeFileSync(directory + '/package.json', JSON.stringify(packageJson.data))
		return new Promise((resolve, reject) => {
			tgz.data.pipe(file);
			file.on('finish', resolve);
			file.on('error', reject);
		}).then(() => {
			console.info('finished:     ' + packageName)
		}).catch((err) => {
			console.error('error: ' + err);
		});
	})
}
main();
