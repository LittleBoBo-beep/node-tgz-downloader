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
    this.registryHits = 1; //

    this.packagesCache = new Map(); // 对于package包的缓存
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
    // const uri = `${getNpmRegistry({ registry })}/${name.replace('/', '%2F')}`;
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
