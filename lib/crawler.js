const request = require('request-promise');
const semver = require('semver');
// const util = require('util');
const logger = require('./logger');

require('colors');

const { getNpmRegistry } = require('./config');
//
class Crawler {
  constructor() {
    this.cacheHits = 1; //
    this.registryHits = 1; // 计算使用镜像源数量

    this.packagesCache = new Map(); // 对于package包的缓存
		this.versionsCache = new Set(); // 版本缓存
    this.tarballs = new Set(); // 存储tgz包的集合
  }

  /**
	 * 获取dependence
 * @typedef DependenciesOptions
 * @property {string} name
 * @property {string} version
 * @property {boolean} devDependencies
 * @property {boolean} peerDependencies
 * @property {string} outputPrefix
 * @property {string?} registry
 *
 * @param { DependenciesOptions } options
 * @returns { Promise<Set<string>> }
 */
  async getDependencies(options) {
    const packageJson = await this._retrievePackageVersion(options);
    if (!packageJson) {
      logger(['ERROR'.red], 'failed to retrieve version of package', options.name, options.version);
      return new Set();
    }
    if (this.tarballs.has(packageJson.dist.tarball)) return this.tarballs;

    this.tarballs.add(packageJson.dist.tarball);

    await this._getDependenciesFrom(packageJson.dependencies, 'dependency '.magenta);

    if (options.devDependencies) {
      await this._getDependenciesFrom(packageJson.devDependencies, 'devDependency '.magenta);
    }

    if (options.peerDependencies) {
      await this._getDependenciesFrom(packageJson.peerDependencies, 'peerDependency '.magenta);
    }

    return this.tarballs;
  }

	async getDependenciesFromVersionNumber(options) {
		const versionNumber = options.versionNumber;
		const packageJson = await this._retrievePackageVersions(options);
		console.log('packageJson:', packageJson)
	}

  /**
	 * 获取packageJson的依赖
   * @typedef PackageJsonDependenciesOptions
   * @property packageJson
   * @property {boolean} devDependencies
   * @property {boolean} peerDependencies
   *
   * @param { PackageJsonDependenciesOptions } options
   */
  async getPackageJsonDependencies(options) {
    const { packageJson } = options;
		// 环境依赖
    await this._getDependenciesFrom(packageJson.dependencies, 'dependency '.magenta);
		// 开发依赖
    if (options.devDependencies) {
      await this._getDependenciesFrom(packageJson.devDependencies, 'devDependency '.magenta);
    }
		// peer依赖
    if (options.peerDependencies) {
      await this._getDependenciesFrom(packageJson.peerDependencies, 'peerDependency '.magenta);
    }

    return this.tarballs;
  }

	/**
	 *
	 * @param name
	 * @param version
	 * @param outputPrefix
	 * @param registry
	 * @returns {Promise<string>}
	 * @private
	 */
  async _retrievePackageVersion({ name, version, outputPrefix = '', registry = '' }) {
    const uri = `${getNpmRegistry({ registry })}/${name}`;
    //  先检测是否含有该name的npm包
    if (this.packagesCache.has(name)) {
      logger(['cache'.yellow, this.cacheHits], `retrieving ${outputPrefix}${name.cyan} ${(version || '').cyan}`);
      this.cacheHits++;
      const allPackageVersionsDetails = this.packagesCache.get(name);
      const maxSatisfyingVersion = this._getMaxSatisfyingVersion(allPackageVersionsDetails, version);
      return allPackageVersionsDetails.versions[maxSatisfyingVersion];
    }

    logger(['registry'.green, this.registryHits], `retrieving ${outputPrefix}${name.cyan} ${(version || '').cyan}`);
    this.registryHits++;
    const allPackageVersionsDetails = await this._retryGetRequest(uri, 3);
    this.packagesCache.set(name, allPackageVersionsDetails); // 将包添加进入package的缓存信息中
    const maxSatisfyingVersion = this._getMaxSatisfyingVersion(allPackageVersionsDetails, version);
    return allPackageVersionsDetails.versions[maxSatisfyingVersion];
  }
	async _retrievePackageVersions({ name, versionNumber, registry = '', outputPrefix = '' }) {
		const uri = `${getNpmRegistry({ registry })}/${name}`;
		//  先检测是否含有该name的npm包
		if (this.packagesCache.has(name)) {
			logger(['cache'.yellow, this.cacheHits], `retrieving ${outputPrefix}${name.cyan} ${(versionNumber || '').cyan}`);
			this.cacheHits++;
			const allPackageVersionsDetails = this.packagesCache.get(name);
			const maxSatisfyingVersion = this._getMaxSatisfyingVersion(allPackageVersionsDetails, versionNumber);
			return allPackageVersionsDetails.versions[maxSatisfyingVersion];
		}

		logger(['registry'.green, this.registryHits], `retrieving ${outputPrefix} ${name.cyan} ${(versionNumber || '').cyan}`);
		this.registryHits++;
		const allPackageVersionsDetails = await this._retryGetRequest(uri, 3);
		this.packagesCache.set(name, allPackageVersionsDetails); // 将包添加进入package的缓存信息中
		const maxSatisfyingVersion = this.getNumberVersions(allPackageVersionsDetails, versionNumber);
		return allPackageVersionsDetails.versions[maxSatisfyingVersion];
	}
  async _getDependenciesFrom(dependenciesObject, outputPrefix) {
    const dependencies = Object.keys(dependenciesObject || {});
    await Promise.all(dependencies.map(dependency => this.getDependencies({
      name: dependency,
      version: dependenciesObject[dependency],
      outputPrefix,
    })));
  }

  /**
   * 如果没有version，就获取包内dist-tags的version
   * @param allPackageVersionsDetails
   * @param version
   * @returns {*}
   * @private
   */
  _getMaxSatisfyingVersion(allPackageVersionsDetails, version) {
    if (!version) {
      return allPackageVersionsDetails['dist-tags'].latest;
    }
    const versions = Object.keys(allPackageVersionsDetails.versions);
    return semver.maxSatisfying(versions, version);
  }

	/**
	 * 获取后几个版本包，含有排序算法，并且将这几个包返回
	 * @param allPackageVersionsDetails
	 * @param versionNumber
	 */
	getNumberVersions (allPackageVersionsDetails, versionNumber) {
		const versions = allPackageVersionsDetails.versions;
		const versionsKey = Object.keys(allPackageVersionsDetails.versions)
		const packageVersionCache = new Map();
		// 处理带有alpha与beta的版本号码
		// 首先找到特殊版本的版本号，其次去判断，如果跟特殊版本一样的版本号，就直接去看是否去下载带有特殊版本的版本号
		while (versionNumber > 0) {
			const maxKey = Math.max(...versionsKey);
			packageVersionCache.set(maxKey, versions[maxKey]);
			const index = versionsKey.indexOf(maxKey);
			versionsKey.splice(index, 1);
			versionNumber--;
		}
		return packageVersionCache;
	}
	/**
	 * 获取package.json文件的内容，count为重试的次数
	 * @param uri
	 * @param count
	 * @returns {Promise<*|undefined>}
	 * @private
	 */
  async _retryGetRequest(uri, count) {
    try {
      return await request({ uri, json: true, timeout: 3000 });
    } catch (error) {
      logger([`failed download ${error.cause && error.cause.code}`.red], uri, count);
      if (error.cause.code === 'ETIMEDOUT' || error.cause.code === 'ESOCKETTIMEDOUT') {
        return this._retryGetRequest(uri, count);
      }
      if (count > 0) {
        return this._retryGetRequest(uri, count - 1);
      }
      throw error;
    }
  }
}

module.exports = {
  Crawler
};
