const express = require('express');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const app = express();

// 定义路由，根据包名下载tarball和package.json信息
app.get('/download/:packageName', async (req, res) => {
	const packageName = req.params.packageName;
	const packageLockPath = path.join(process.cwd(), 'package-lock.json');

	try {
		const packageLock = JSON.parse(fs.readFileSync(packageLockPath));
		const packageInfo = packageLock.dependencies[packageName];
		const tarballUrl = packageInfo.resolved;

		// 获取package.json信息
		const { stdout } = await exec(`npm view ${packageName} --json`);
		const packageJson = JSON.parse(stdout);
		const dependencies = packageJson.dependencies || {};

		// 下载tarball和依赖项
		await downloadTarball(packageName, tarballUrl);
		await downloadDependencies(dependencies);

		res.send('Package downloaded successfully!');
	} catch (err) {
		console.error(err);
		res.status(500).send('Error occurred while downloading the package!');
	}
});

// 下载tarball
async function downloadTarball(packageName, tarballUrl) {
	const tarballPath = path.join(process.cwd(), `${packageName}.tgz`);

	const writer = fs.createWriteStream(tarballPath);
	const response = await fetch(tarballUrl);

	return new Promise((resolve, reject) => {
		response.body.pipe(writer);
		writer.on('finish', resolve);
		writer.on('error', reject);
	});
}

// 递归下载依赖项
async function downloadDependencies(dependencies) {
	const promises = Object.keys(dependencies).map(async (dep) => {
		try {
			const packageLockPath = path.join(process.cwd(), 'package-lock.json');
			const packageLock = JSON.parse(fs.readFileSync(packageLockPath));
			const packageInfo = packageLock.dependencies[dep];
			const tarballUrl = packageInfo.resolved;

			// 获取package.json信息
			const { stdout } = await exec(`npm view ${dep} --json`);
			const packageJson = JSON.parse(stdout);
			const subDependencies = packageJson.dependencies || {};

			// 递归下载依赖项
			await downloadTarball(dep, tarballUrl);
			await downloadDependencies(subDependencies);
		} catch (err) {
			console.error(err);
		}
	});

	await Promise.all(promises);
}

// 解析命令行参数
const args = process.argv.slice(2);
const packageLockPath = args[0];
const port = args[1] || 3000;

if (!packageLockPath) {
	console.error('Please provide the path to the package-lock.json file!');
	process.exit(1);
}

// 启动服务器
app.listen(port, () => {
	console.log(`Server started on port ${port}`);

	// 根据package-lock.json文件下载tarball和依赖项
	try {
		const packageLock = JSON.parse(fs.readFileSync(packageLockPath));
		const packages = Object.keys(packageLock.dependencies);

		packages.forEach(async (packageName) => {
			await fetch(`http://localhost:${port}/download/${packageName}`);
		});
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
});
