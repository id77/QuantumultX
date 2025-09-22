const $ = new Env('ocr');

$.ocrApi = $.getData('id77_ocr_api'); // 验证码识别API地址

!(async () => {
  const params = JSON.parse($request.body);
  const res = await OCR识别(params);
  $.done({
    status: 'HTTP/1.1 200',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: res,
  });
})()
  .catch((e) => $.logErr(e))
  .finally(() => $.done());

function OCR识别(params) {
  if (!$.ocrApi) {
    return Promise.resolve('');
  }
  return new Promise((resolve, reject) => {
    try {
      const url = $.ocrApi; // 自建服务的OCR API地址
      const headers = {
        'Content-Type': 'application/json',
      };

      // 构建请求体
      const body = JSON.stringify(params);

      // 发送请求
      const opts = {
        url,
        method: 'POST',
        headers,
        body,
      };

      $.post(opts, (err, resp, data) => {
        if (err) {
          console.log(`OCR验证码识别请求失败: ${err}`);
          resolve('');
          return;
        }

        try {
          const result = JSON.parse(data);
          if (result.code === 0) {
            console.log(`OCR验证码识别成功: ${result.data.text}`);
            resolve(data);
          } else {
            console.log(`OCR验证码识别失败: ${result.msg || '未知错误'}`);
            resolve('');
          }
        } catch (e) {
          console.log(`OCR验证码结果解析失败: ${e}, 原始数据: ${data}`);
          resolve('');
        }
      });
    } catch (e) {
      console.log(`OCR验证码处理异常: ${e}`);
      resolve('');
    }
  });
}

function Env(name, opts) {
  class Http {
    constructor(env) {
      this.env = env;
    }

    send(opts, method = 'GET') {
      opts = typeof opts === 'string' ? { url: opts } : opts;
      let sender = this.get;
      if (method === 'POST') {
        sender = this.post;
      }

      const delayPromise = (promise, delay = 1000) => {
        return Promise.race([
          promise,
          new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('请求超时'));
            }, delay);
          }),
        ]);
      };

      const call = new Promise((resolve, reject) => {
        sender.call(this, opts, (err, resp, body) => {
          if (err) reject(err);
          else resolve(resp);
        });
      });

      return opts.timeout ? delayPromise(call, opts.timeout) : call;
    }

    get(opts) {
      return this.send.call(this.env, opts);
    }

    post(opts) {
      return this.send.call(this.env, opts, 'POST');
    }
  }

  return new (class {
    constructor(name, opts = {}) {
      this.logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
      this.logLevelPrefixs = {
        debug: '[DEBUG] ',
        info: '[INFO] ',
        warn: '[WARN] ',
        error: '[ERROR] ',
      };
      this.logLevel = 'info';
      this.name = name;
      this.http = new Http(this);
      this.data = null;
      this.dataFile = 'box.dat';
      this.logs = [];
      this.isMute = false;
      this.isNeedRewrite = false;
      this.logSeparator = '\n';
      this.encoding = 'utf-8';
      this.startTime = new Date().getTime();
      Object.assign(this, opts);
      this.log('', `🔔${this.name}, 开始!`);
    }

    getEnv() {
      if ('undefined' !== typeof $environment && $environment['surge-version'])
        return 'Surge';
      if ('undefined' !== typeof $environment && $environment['stash-version'])
        return 'Stash';
      if ('undefined' !== typeof module && !!module.exports) return 'Node.js';
      if ('undefined' !== typeof $task) return 'Quantumult X';
      if ('undefined' !== typeof $loon) return 'Loon';
      if ('undefined' !== typeof $rocket) return 'Shadowrocket';
    }

    isNode() {
      return 'Node.js' === this.getEnv();
    }

    isQuanX() {
      return 'Quantumult X' === this.getEnv();
    }

    isSurge() {
      return 'Surge' === this.getEnv();
    }

    isLoon() {
      return 'Loon' === this.getEnv();
    }

    isShadowrocket() {
      return 'Shadowrocket' === this.getEnv();
    }

    isStash() {
      return 'Stash' === this.getEnv();
    }

    toObj(str, defaultValue = null) {
      try {
        return JSON.parse(str);
      } catch {
        return defaultValue;
      }
    }

    toStr(obj, defaultValue = null, ...args) {
      try {
        return JSON.stringify(obj, ...args);
      } catch {
        return defaultValue;
      }
    }

    getJson(key, defaultValue) {
      let json = defaultValue;
      const val = this.getData(key);
      if (val) {
        try {
          json = JSON.parse(this.getData(key));
        } catch {}
      }
      return json;
    }

    setJson(val, key) {
      try {
        return this.setData(JSON.stringify(val), key);
      } catch {
        return false;
      }
    }

    getScript(url) {
      return new Promise((resolve) => {
        this.get({ url }, (err, resp, body) => resolve(body));
      });
    }

    getFileNameFromUrl(url) {
      // 使用正则表达式匹配文件名（包括后缀）
      const match = url.match(/\/([^\/?#]+)(?:\?|#|$)/);
      return match ? match[1] : null;
    }

    runScript(script, runOpts) {
      return new Promise((resolve) => {
        let httpApi = this.getData('@chavy_boxjs_userCfgs.httpApi');
        httpApi = httpApi ? httpApi.replace(/\n/g, '').trim() : httpApi;
        let httpApi_timeout = this.getData(
          '@chavy_boxjs_userCfgs.httpApi_timeout'
        );
        httpApi_timeout = httpApi_timeout ? httpApi_timeout * 1 : 20;
        httpApi_timeout =
          runOpts && runOpts.timeout ? runOpts.timeout : httpApi_timeout;
        const [key, addr] = httpApi.split('@');
        const opts = {
          url: `http://${addr}/v1/scripting/evaluate`,
          body: {
            script_text: script,
            mock_type: 'cron',
            timeout: httpApi_timeout,
          },
          headers: {
            'X-Key': key,
            Accept: '*/*',
          },
          policy: 'DIRECT',
          timeout: httpApi_timeout,
        };
        this.post(opts, (err, resp, body) => resolve(body));
      }).catch((e) => this.logErr(e));
    }

    loadData() {
      if (this.isNode()) {
        this.fs = this.fs ? this.fs : require('fs');
        this.path = this.path ? this.path : require('path');
        const curDirDataFilePath = this.path.resolve(this.dataFile);
        const rootDirDataFilePath = this.path.resolve(
          process.cwd(),
          this.dataFile
        );
        const isCurDirDataFile = this.fs.existsSync(curDirDataFilePath);
        const isRootDirDataFile =
          !isCurDirDataFile && this.fs.existsSync(rootDirDataFilePath);
        if (isCurDirDataFile || isRootDirDataFile) {
          const datPath = isCurDirDataFile
            ? curDirDataFilePath
            : rootDirDataFilePath;
          try {
            return JSON.parse(this.fs.readFileSync(datPath));
          } catch (e) {
            return {};
          }
        } else return {};
      } else return {};
    }

    readFile(filePath) {
      try {
        if (typeof $iCloud !== 'undefined') {
          if (!filePath) {
            filePath = '../Scripts/' + fileName;
          }
          // QuantumultX
          let readUint8Array = $iCloud.readFile(filePath);
          if (readUint8Array === undefined) {
            console.log(`读取失败！可能该设备没同步到 ${filePath} 文件。`);
          } else {
            let textDecoder = new TextDecoder();
            let readContent = textDecoder.decode(readUint8Array);
            console.log('读取文件成功！');
            return readContent;
          }
        } else if (this.isNode()) {
          // Node.js
          const filePath = __dirname + '/' + fileName;
          const fs = require('fs');
          const data = fs.readFileSync(filePath, 'utf8');
          return data;
        } else {
          throw new Error('不受支持的环境');
        }
      } catch (err) {
        console.log(err);
        return null;
      }
    }

    writeFile(writeContent, filePath) {
      try {
        if (typeof $iCloud !== 'undefined') {
          if (!filePath) {
            filePath = '../Scripts/' + fileName;
          }
          // QuantumultX
          let encoder = new TextEncoder();
          let writeUint8Array = encoder.encode(writeContent);

          if ($iCloud.writeFile(writeUint8Array, filePath)) {
            console.log('写入文件内容成功！');
          } else {
            console.log('写入文件内容失败！');
          }
        } else {
          throw new Error('不受支持的环境');
        }
      } catch (err) {
        console.log(err);
        return null;
      }
    }

    writeData() {
      if (this.isNode()) {
        this.fs = this.fs ? this.fs : require('fs');
        this.path = this.path ? this.path : require('path');
        const curDirDataFilePath = this.path.resolve(this.dataFile);
        const rootDirDataFilePath = this.path.resolve(
          process.cwd(),
          this.dataFile
        );
        const isCurDirDataFile = this.fs.existsSync(curDirDataFilePath);
        const isRootDirDataFile =
          !isCurDirDataFile && this.fs.existsSync(rootDirDataFilePath);
        const jsonData = JSON.stringify(this.data);
        if (isCurDirDataFile) {
          this.fs.writeFileSync(curDirDataFilePath, jsonData);
        } else if (isRootDirDataFile) {
          this.fs.writeFileSync(rootDirDataFilePath, jsonData);
        } else {
          this.fs.writeFileSync(curDirDataFilePath, jsonData);
        }
      }
    }

    lodash_get(source, path, defaultValue = undefined) {
      const paths = path.replace(/\[(\d+)\]/g, '.$1').split('.');
      let result = source;
      for (const p of paths) {
        result = Object(result)[p];
        if (result === undefined) {
          return defaultValue;
        }
      }
      return result;
    }

    lodash_set(obj, path, value) {
      if (Object(obj) !== obj) return obj;
      if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || [];
      path
        .slice(0, -1)
        .reduce(
          (a, c, i) =>
            Object(a[c]) === a[c]
              ? a[c]
              : (a[c] = Math.abs(path[i + 1]) >> 0 === +path[i + 1] ? [] : {}),
          obj
        )[path[path.length - 1]] = value;
      return obj;
    }

    getData(key) {
      let val = this.getVal(key);
      // 如果以 @
      if (/^@/.test(key)) {
        const [, objKey, paths] = /^@(.*?)\.(.*?)$/.exec(key);
        const objVal = objKey ? this.getVal(objKey) : '';
        if (objVal) {
          try {
            const objedVal = JSON.parse(objVal);
            val = objedVal ? this.lodash_get(objedVal, paths, '') : val;
          } catch (e) {
            val = '';
          }
        }
      }
      return val;
    }

    setData(val, key) {
      let isSuc = false;
      if (/^@/.test(key)) {
        const [, objKey, paths] = /^@(.*?)\.(.*?)$/.exec(key);
        const objdat = this.getVal(objKey);
        const objVal = objKey
          ? objdat === 'null'
            ? null
            : objdat || '{}'
          : '{}';
        try {
          const objedVal = JSON.parse(objVal);
          this.lodash_set(objedVal, paths, val);
          isSuc = this.setVal(JSON.stringify(objedVal), objKey);
        } catch (e) {
          const objedVal = {};
          this.lodash_set(objedVal, paths, val);
          isSuc = this.setVal(JSON.stringify(objedVal), objKey);
        }
      } else {
        isSuc = this.setVal(val, key);
      }
      return isSuc;
    }

    getVal(key) {
      switch (this.getEnv()) {
        case 'Surge':
        case 'Loon':
        case 'Stash':
        case 'Shadowrocket':
          return $persistentStore.read(key);
        case 'Quantumult X':
          return $prefs.valueForKey(key);
        case 'Node.js':
          this.data = this.loadData();
          return this.data[key];
        default:
          return (this.data && this.data[key]) || null;
      }
    }

    setVal(val, key) {
      switch (this.getEnv()) {
        case 'Surge':
        case 'Loon':
        case 'Stash':
        case 'Shadowrocket':
          return $persistentStore.write(val, key);
        case 'Quantumult X':
          return $prefs.setValueForKey(val, key);
        case 'Node.js':
          this.data = this.loadData();
          this.data[key] = val;
          this.writeData();
          return true;
        default:
          return (this.data && this.data[key]) || null;
      }
    }

    initGotEnv(opts) {
      this.got = this.got ? this.got : require('got');
      this.ckTough = this.ckTough ? this.ckTough : require('tough-cookie');
      this.ckJar = this.ckJar ? this.ckJar : new this.ckTough.CookieJar();
      if (opts) {
        opts.headers = opts.headers ? opts.headers : {};
        if (opts) {
          opts.headers = opts.headers ? opts.headers : {};
          if (
            undefined === opts.headers.cookie &&
            undefined === opts.headers.Cookie &&
            undefined === opts.cookieJar
          ) {
            opts.cookieJar = this.ckJar;
          }
        }
      }
    }

    get(request, callback = () => {}) {
      if (request.headers) {
        delete request.headers['Content-Type'];
        delete request.headers['Content-Length'];
        delete opts.headers['Host'];
        // HTTP/2 全是小写
        delete request.headers['content-type'];
        delete request.headers['content-length'];
        delete opts.headers['host'];
      }
      if (request.params) {
        request.url += '?' + this.queryStr(request.params);
      }
      // followRedirect 禁止重定向
      if (
        typeof request.followRedirect !== 'undefined' &&
        !request['followRedirect']
      ) {
        if (this.isSurge() || this.isLoon()) request['auto-redirect'] = false; // Surge & Loon
        if (this.isQuanX())
          request.opts
            ? (request['opts']['redirection'] = false)
            : (request.opts = { redirection: false }); // Quantumult X
      }
      switch (this.getEnv()) {
        case 'Surge':
        case 'Loon':
        case 'Stash':
        case 'Shadowrocket':
        default:
          if (this.isSurge() && this.isNeedRewrite) {
            request.headers = request.headers || {};
            Object.assign(request.headers, { 'X-Surge-Skip-Scripting': false });
          }
          $httpClient.get(request, (err, resp, body) => {
            if (!err && resp) {
              resp.body = body;
              resp.statusCode = resp.status ? resp.status : resp.statusCode;
              resp.status = resp.statusCode;
            }
            callback(err, resp, body);
          });
          break;
        case 'Quantumult X':
          if (this.isNeedRewrite) {
            request.opts = request.opts || {};
            Object.assign(request.opts, { hints: false });
          }
          $task.fetch(request).then(
            (resp) => {
              const {
                statusCode: status,
                statusCode,
                headers,
                body,
                bodyBytes,
              } = resp;
              callback(
                null,
                { status, statusCode, headers, body, bodyBytes },
                body,
                bodyBytes
              );
            },
            (err) => callback((err && err.error) || 'UndefinedError')
          );
          break;
        case 'Node.js':
          let iconv = require('iconv-lite');
          this.initGotEnv(request);
          this.got(request)
            .on('redirect', (resp, nextOpts) => {
              try {
                if (resp.headers['set-cookie']) {
                  const ck = resp.headers['set-cookie']
                    .map(this.ckTough.Cookie.parse)
                    .toString();
                  if (ck) {
                    this.ckJar.setCookieSync(ck, null);
                  }
                  nextOpts.cookieJar = this.ckJar;
                }
              } catch (e) {
                this.logErr(e);
              }
              // this.ckJar.setCookieSync(resp.headers['set-cookie'].map(Cookie.parse).toString())
            })
            .then(
              (resp) => {
                const {
                  statusCode: status,
                  statusCode,
                  headers,
                  rawBody,
                } = resp;
                const body = iconv.decode(rawBody, this.encoding);
                callback(
                  null,
                  { status, statusCode, headers, rawBody, body },
                  body
                );
              },
              (err) => {
                const { message: error, response: resp } = err;
                callback(
                  error,
                  resp,
                  resp && iconv.decode(resp.rawBody, this.encoding)
                );
              }
            );
          break;
      }
    }

    post(request, callback = () => {}) {
      const method = request.method
        ? request.method.toLocaleLowerCase()
        : 'post';

      // 如果指定了请求体, 但没指定 `Content-Type`、`content-type`, 则自动生成。
      if (
        request.body &&
        request.headers &&
        !request.headers['Content-Type'] &&
        !request.headers['content-type']
      ) {
        // HTTP/1、HTTP/2 都支持小写 headers
        request.headers['content-type'] = 'application/x-www-form-urlencoded';
      }
      // 为避免指定错误 `content-length` 这里删除该属性，由工具端 (HttpClient) 负责重新计算并赋值
      if (request.headers) {
        delete request.headers['Content-Length'];
        delete request.headers['content-length'];
        delete request.headers['Host'];
        delete request.headers['host'];
      }
      // followRedirect 禁止重定向
      if (
        typeof request.followRedirect !== 'undefined' &&
        !request['followRedirect']
      ) {
        if (this.isSurge() || this.isLoon()) request['auto-redirect'] = false; // Surge & Loon
        if (this.isQuanX())
          request.opts
            ? (request['opts']['redirection'] = false)
            : (request.opts = { redirection: false }); // Quantumult X
      }
      switch (this.getEnv()) {
        case 'Surge':
        case 'Loon':
        case 'Stash':
        case 'Shadowrocket':
        default:
          if (this.isSurge() && this.isNeedRewrite) {
            request.headers = request.headers || {};
            Object.assign(request.headers, { 'X-Surge-Skip-Scripting': false });
          }
          $httpClient[method](request, (err, resp, body) => {
            if (!err && resp) {
              resp.body = body;
              resp.statusCode = resp.status ? resp.status : resp.statusCode;
              resp.status = resp.statusCode;
            }
            callback(err, resp, body);
          });
          break;
        case 'Quantumult X':
          request.method = method;
          if (this.isNeedRewrite) {
            request.opts = request.opts || {};
            Object.assign(request.opts, { hints: false });
          }
          $task.fetch(request).then(
            (resp) => {
              const {
                statusCode: status,
                statusCode,
                headers,
                body,
                bodyBytes,
              } = resp;
              callback(
                null,
                { status, statusCode, headers, body, bodyBytes },
                body,
                bodyBytes
              );
            },
            (err) => callback((err && err.error) || 'UndefinedError')
          );
          break;
        case 'Node.js':
          let iconv = require('iconv-lite');
          this.initGotEnv(request);
          const { url, ..._request } = request;
          this.got[method](url, _request).then(
            (resp) => {
              const { statusCode: status, statusCode, headers, rawBody } = resp;
              const body = iconv.decode(rawBody, this.encoding);
              callback(
                null,
                { status, statusCode, headers, rawBody, body },
                body
              );
            },
            (err) => {
              const { message: error, response: resp } = err;
              callback(
                error,
                resp,
                resp && iconv.decode(resp.rawBody, this.encoding)
              );
            }
          );
          break;
      }
    }
    /**
     *
     * 示例:$.time('yyyy-MM-dd qq HH:mm:ss.S')
     *    :$.time('yyyyMMddHHmmssS')
     *    y:年 M:月 d:日 q:季 H:时 m:分 s:秒 S:毫秒
     *    其中y可选0-4位占位符、S可选0-1位占位符，其余可选0-2位占位符
     * @param {string} fmt 格式化参数
     * @param {number} 可选: 根据指定时间戳返回格式化日期
     *
     */
    time(fmt, ts = null) {
      const date = ts ? new Date(ts) : new Date();
      let o = {
        'M+': date.getMonth() + 1,
        'd+': date.getDate(),
        'H+': date.getHours(),
        'm+': date.getMinutes(),
        's+': date.getSeconds(),
        'q+': Math.floor((date.getMonth() + 3) / 3),
        S: date.getMilliseconds(),
      };
      if (/(y+)/.test(fmt))
        fmt = fmt.replace(
          RegExp.$1,
          (date.getFullYear() + '').substr(4 - RegExp.$1.length)
        );
      for (let k in o)
        if (new RegExp('(' + k + ')').test(fmt))
          fmt = fmt.replace(
            RegExp.$1,
            RegExp.$1.length == 1
              ? o[k]
              : ('00' + o[k]).substr(('' + o[k]).length)
          );
      return fmt;
    }

    /**
     *
     * @param {Object} options
     * @returns {String} 将 Object 对象 转换成 queryStr: key=val&name=senku
     */
    queryStr(options) {
      let queryString = '';

      for (const key in options) {
        let value = options[key];
        if (value != null && value !== '') {
          if (typeof value === 'object') {
            value = JSON.stringify(value);
          }
          queryString += `${key}=${value}&`;
        }
      }
      queryString = queryString.substring(0, queryString.length - 1);

      return queryString;
    }

    /**
     * 系统通知
     *
     * > 通知参数: 同时支持 QuanX 和 Loon 两种格式, EnvJs根据运行环境自动转换, Surge 环境不支持多媒体通知
     *
     * 示例:
     * $.msg(title, subt, desc, 'twitter://')
     * $.msg(title, subt, desc, { 'open-url': 'twitter://', 'media-url': 'https://github.githubassets.com/images/modules/open_graph/github-mark.png' })
     * $.msg(title, subt, desc, { 'open-url': 'https://bing.com', 'media-url': 'https://github.githubassets.com/images/modules/open_graph/github-mark.png' })
     *
     * @param {*} title 标题
     * @param {*} subt 副标题
     * @param {*} desc 通知详情
     * @param {*} opts 通知参数
     *
     */
    msg(title = name, subt = '', desc = '', opts = {}) {
      const toEnvOpts = (rawopts) => {
        const { $open, $copy, $media, $mediaMime } = rawopts;
        switch (typeof rawopts) {
          case undefined:
            return rawopts;
          case 'string':
            switch (this.getEnv()) {
              case 'Surge':
              case 'Stash':
              default:
                return { url: rawopts };
              case 'Loon':
              case 'Shadowrocket':
                return rawopts;
              case 'Quantumult X':
                return { 'open-url': rawopts };
              case 'Node.js':
                return undefined;
            }
          case 'object':
            switch (this.getEnv()) {
              case 'Surge':
              case 'Stash':
              case 'Shadowrocket':
              default: {
                const options = {};

                // 打开URL
                let openUrl =
                  rawopts.openUrl ||
                  rawopts.url ||
                  rawopts['open-url'] ||
                  $open;
                if (openUrl)
                  Object.assign(options, { action: 'open-url', url: openUrl });

                // 粘贴板
                let copy =
                  rawopts['update-pasteboard'] ||
                  rawopts.updatePasteboard ||
                  $copy;
                if (copy) {
                  Object.assign(options, { action: 'clipboard', text: copy });
                }

                if ($media) {
                  let mediaUrl = undefined;
                  let media = undefined;
                  let mime = undefined;
                  // http 开头的网络地址
                  if ($media.startsWith('http')) {
                    mediaUrl = $media;
                  }
                  // 带标识的 Base64 字符串
                  // data:image/png;base64,iVBORw0KGgo...
                  else if ($media.startsWith('data:')) {
                    const [data] = $media.split(';');
                    const [, base64str] = $media.split(',');
                    media = base64str;
                    mime = data.replace('data:', '');
                  }
                  // 没有标识的 Base64 字符串
                  // iVBORw0KGgo...
                  else {
                    // https://stackoverflow.com/questions/57976898/how-to-get-mime-type-from-base-64-string
                    const getMimeFromBase64 = (encoded) => {
                      const signatures = {
                        JVBERi0: 'application/pdf',
                        R0lGODdh: 'image/gif',
                        R0lGODlh: 'image/gif',
                        iVBORw0KGgo: 'image/png',
                        '/9j/': 'image/jpg',
                      };
                      for (var s in signatures) {
                        if (encoded.indexOf(s) === 0) {
                          return signatures[s];
                        }
                      }
                      return null;
                    };
                    media = $media;
                    mime = getMimeFromBase64($media);
                  }

                  Object.assign(options, {
                    'media-url': mediaUrl,
                    'media-base64': media,
                    'media-base64-mime': $mediaMime ?? mime,
                  });
                }

                Object.assign(options, {
                  'auto-dismiss': rawopts['auto-dismiss'],
                  sound: rawopts['sound'],
                });
                return options;
              }
              case 'Loon': {
                const options = {};

                let openUrl =
                  rawopts.openUrl ||
                  rawopts.url ||
                  rawopts['open-url'] ||
                  $open;
                if (openUrl) Object.assign(options, { openUrl });

                let mediaUrl = rawopts.mediaUrl || rawopts['media-url'];
                if ($media?.startsWith('http')) mediaUrl = $media;
                if (mediaUrl) Object.assign(options, { mediaUrl });

                console.log(JSON.stringify(options));
                return options;
              }
              case 'Quantumult X': {
                const options = {};

                let openUrl =
                  rawopts['open-url'] ||
                  rawopts.url ||
                  rawopts.openUrl ||
                  $open;
                if (openUrl) Object.assign(options, { 'open-url': openUrl });

                let mediaUrl = rawopts['media-url'] || rawopts.mediaUrl;
                if ($media?.startsWith('http')) mediaUrl = $media;
                if (mediaUrl) Object.assign(options, { 'media-url': mediaUrl });

                let copy =
                  rawopts['update-pasteboard'] ||
                  rawopts.updatePasteboard ||
                  $copy;
                if (copy) Object.assign(options, { 'update-pasteboard': copy });

                console.log(JSON.stringify(options));
                return options;
              }
              case 'Node.js':
                return undefined;
            }
          default:
            return undefined;
        }
      };
      if (!this.isMute) {
        switch (this.getEnv()) {
          case 'Surge':
          case 'Loon':
          case 'Stash':
          case 'Shadowrocket':
          default:
            $notification.post(title, subt, desc, toEnvOpts(opts));
            break;
          case 'Quantumult X':
            $notify(title, subt, desc, toEnvOpts(opts));
            break;
          case 'Node.js':
            break;
        }
      }
      if (!this.isMuteLog) {
        let logs = ['', '==============📣系统通知📣=============='];
        logs.push(title);
        subt ? logs.push(subt) : '';
        desc ? logs.push(desc) : '';
        console.log(logs.join('\n'));
        this.logs = this.logs.concat(logs);
      }
    }

    debug(...logs) {
      if (this.logLevels[this.logLevel] <= this.logLevels.debug) {
        if (logs.length > 0) {
          this.logs = [...this.logs, ...logs];
        }
        console.log(
          `${this.logLevelPrefixs.debug}${logs
            .map((l) => l ?? String(l))
            .join(this.logSeparator)}`
        );
      }
    }

    info(...logs) {
      if (this.logLevels[this.logLevel] <= this.logLevels.info) {
        if (logs.length > 0) {
          this.logs = [...this.logs, ...logs];
        }
        console.log(
          `${this.logLevelPrefixs.info}${logs
            .map((l) => l ?? String(l))
            .join(this.logSeparator)}`
        );
      }
    }

    warn(...logs) {
      if (this.logLevels[this.logLevel] <= this.logLevels.warn) {
        if (logs.length > 0) {
          this.logs = [...this.logs, ...logs];
        }
        console.log(
          `${this.logLevelPrefixs.warn}${logs
            .map((l) => l ?? String(l))
            .join(this.logSeparator)}`
        );
      }
    }

    error(...logs) {
      if (this.logLevels[this.logLevel] <= this.logLevels.error) {
        if (logs.length > 0) {
          this.logs = [...this.logs, ...logs];
        }
        console.log(
          `${this.logLevelPrefixs.error}${logs
            .map((l) => l ?? String(l))
            .join(this.logSeparator)}`
        );
      }
    }

    log(...logs) {
      if (logs.length > 0) {
        this.logs = [...this.logs, ...logs];
      }
      console.log(logs.map((l) => l ?? String(l)).join(this.logSeparator));
    }

    logErr(err, msg) {
      switch (this.getEnv()) {
        case 'Surge':
        case 'Loon':
        case 'Stash':
        case 'Shadowrocket':
        case 'Quantumult X':
        default:
          this.log('', `❗️${this.name}, 错误!`, msg, err);
          break;
        case 'Node.js':
          this.log(
            '',
            `❗️${this.name}, 错误!`,
            msg,
            typeof err.message !== 'undefined' ? err.message : err,
            err.stack
          );
          break;
      }
    }

    wait(time) {
      return new Promise((resolve) => setTimeout(resolve, time));
    }

    done(val = {}) {
      const endTime = new Date().getTime();
      const costTime = (endTime - this.startTime) / 1000;
      this.log('', `🔔${this.name}, 结束! 🕛 ${costTime} 秒`);
      this.log();
      switch (this.getEnv()) {
        case 'Surge':
        case 'Loon':
        case 'Stash':
        case 'Shadowrocket':
        case 'Quantumult X':
        default:
          $done(val);
          break;
        case 'Node.js':
          process.exit(1);
      }
    }
  })(name, opts);
}
