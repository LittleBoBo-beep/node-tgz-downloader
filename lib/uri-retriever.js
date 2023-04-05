const fs = require('fs');
// const { isAbsolute, join } = require('path');
const axios = require("axios");


/**
 * 读取package-lock 文件
 * @param { string } uri
 */
function retrieveFile(uri) {
  // uri = uri.startsWith('http') || isAbsolute(uri) ? uri : join(process.cwd(), uri); // remove 如果uri是http或者绝对路径，就使用原值，如果不是，将路径改为绝对路径
  if (fs.existsSync(uri)) {
    // return uri.endsWith('json') ? axios.get(uri) : ;
		return JSON.parse(fs.readFileSync(uri).toString());
  }
  try {
    // return await request({ uri, json: uri.endsWith('json') });
	return axios.get(uri) // 选择使用axios来请求远程的地址
  } catch (error) {
    console.error(`failed to download the file from ${uri}`);
    process.exit(1);
  }
}


/**
 * 获取package.json文件路径
 * @param {string} url
 * @return Object
 */
function getUri(url) {
	let uri = '';
	const arr = url.split('/');
	const index = arr.indexOf('-');
	for (let i = 0; i < index; i++) {
		if (i === 2) {
			uri += '//'
		} else if (i > 2) {
			uri += '/'
		}
		uri += arr[i]
	}
	const comIndex = uri.indexOf('com/');
	let name;
	if (comIndex !== -1) {
		name = uri.slice(comIndex + 4)
	}
	// uri += arr[0] + '//' + arr[2] + '/' + arr[3]
	// if (url.indexOf('https://')) {
	// 	const index = url.split('//')[1].split('/');
	//
	// 	if (index !== -1) {
	// 		uri = 'https:' + url.split('//')[1].slice(0, index)
	// 	}
	// } else if (url.indexOf('http://')) {
	// 	const index = url.split('//')[1].indexOf('/')
	// 	if (index !== -1) {
	// 		uri = 'http:' + url.split('//')[1].slice(0, index)
	// 	}
	// }
	return {uri, name: name || arr[3]}
}

module.exports = {
  retrieveFile,
	getUri
};
