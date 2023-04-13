const fs = require('fs');
// const url = require('url');
// const http = require('http');
const path = require('path');
// const https = require('https');
const mkdirp = require('mkdirp');
const logger = require('./logger');
// const httpsAgent = require('./https-agent');
const axios = require("axios");
// 设置axios请求拦截器
axios.interceptors.request.use(() => {

})
/**
 * @param {string} file
 * @param {{directory, filename: string | undefined, timeout: string | undefined }} options
 * @param packageJson
 * @returns {Promise<{ path: string, duration: number }>}
 */
function downloadFileAsync(file, options = {}, packageJson) {
  const uri = file.split('/'); // 截取uri获取filename
  options.filename = options.filename || uri[uri.length - 1]; // 获取filename
  options.timeout = options.timeout || 20000; // 设置timeout
  const filePath = path.join(options.directory, options.filename);
  const jsonPath = path.join(options.directory, 'package.json');
  if (fs.existsSync(filePath)) {
    logger(['skipping download'.yellow], filePath);
    return Promise.resolve({ path: filePath, duration: 0 });
  }

  let req = axios; // 由于http请求总是失败，换成axios去请求包
  // if (url.parse(file).protocol === null) {
  //   file = `http://${file}`;
  //   req = http;
  // } else if (url.parse(file).protocol === 'https:') {
  //   req = https;
  // } else {
  //   req = http;
  // }
  // const start = Date.now();
  return new Promise((resolve, reject) => {
    let fileClose;
    // let responseEnd;
    // const promises = [
    //   new Promise(x => fileClose = x),
    //   new Promise(x => responseEnd = x),
    // ];
		const CancelToken = axios.CancelToken;
		let cancel;
    // let reqOptions = {
    //   agent: httpsAgent.getAgent(req),
    // }
    return req.get(
      file,
			{
				responseType: 'stream',
				cancelToken: new CancelToken((c) => {
					cancel = c;
				})
			}
      ).then(response => {
			if (response.status === 200) {
					mkdirp(options.directory, (error) => {
						if (error) {
							reject(error.message);
						}
						const file = fs.createWriteStream(filePath);
						response.data.pipe(file);
						packageJson && fs.writeFileSync(jsonPath, JSON.stringify(packageJson))
						file.on('close', fileClose);
						resolve(filePath);
					});
				} else {
					reject(response.status);
				}
				// response.on('end', responseEnd);
				// cancel();
	}).catch(function (error) {
		if (error.response) {
			// 请求成功发出且服务器也响应了状态码，但状态代码超出了 2xx 的范围
			console.log(error.response.data);
			console.log(error.response.status);
			console.log(error.response.headers);
		} else if (error.request) {
			// 请求已经成功发起，但没有收到响应
			// `error.request` 在浏览器中是 XMLHttpRequest 的实例，
			// 而在node.js中是 http.ClientRequest 的实例
			console.log(error.request);
		} else {
			// 发送请求时出了点问题
			console.log('Error', error.message);
		}
		console.log(error.config);
	});
	// 	.catch(error => {
	// 		logger.error(error.message)
	// });
    // request.setTimeout(options.timeout, () => {
    //   request.abort(); // 首先暂停
    //   reject(`Timed out after ${options.timeout}ms`);
    // });
    // request.on('error', error => reject(error));
    // Promise.all(promises).then(() => {
	//   计算下载时间
    //   const duration = Date.now() - start;
    //   resolve({ path, duration });
    // });
  });
}

module.exports = downloadFileAsync;
