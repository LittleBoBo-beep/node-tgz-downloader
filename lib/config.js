const fs = require('fs')

let defaultNpmRegistry = 'https://registry.npmjs.org';
try {
  const USER_HOME = process.env.HOME || process.env.USERPROFILE;
  const npmrc = fs.readFileSync(USER_HOME+'/.npmrc', 'utf8' );
  npmrc && npmrc.split('\n').forEach((line) => {
    if (line.startsWith('registry=')) {
      // 截取register的前缀
      defaultNpmRegistry = line.substring(9);
      // 处理链接后缀带\r的问题
      defaultNpmRegistry = defaultNpmRegistry.endsWith('\r') ? defaultNpmRegistry.substring(0, defaultNpmRegistry.length - 2) : defaultNpmRegistry;
      // 将uri的后缀/去掉
      defaultNpmRegistry = defaultNpmRegistry.endsWith('/') ? defaultNpmRegistry.substring(0, defaultNpmRegistry.length - 1) : defaultNpmRegistry
    }
  })
} catch(err) {
  console.log('Fail to read ~/.npmrc. ${err.message}');
}

/**
 *
 * @param {{ registry?: string }} options
 */
function getNpmRegistry(options = {}) {
  return options.registry || defaultNpmRegistry;
}

module.exports = {
  getNpmRegistry
};
