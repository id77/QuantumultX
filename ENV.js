// https://github.com/chavyleung/scripts/blob/master/Env.js
// prettier-ignore
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

      const call = new Promise((resolve, reject) => {
        sender.call(this, opts, (err, resp, body) => {
          if (err) reject(err);
          else resolve(resp);
        });
      });

      if (opts.timeout) {
        let timer;
        return Promise.race([
          call.finally(() => clearTimeout(timer)),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('请求超时')),
              opts.timeout,
            );
          }),
        ]);
      }
      return call;
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
      this.name = name;
      this.http = new Http(this);
      this.data = null;
      this.dataFile = 'box.dat';
      this.logs = [];
      this.isMute = false;
      this.noLogKey = opts.noLogKey || '';
      this.noLog = opts.noLog;
      this.isNeedRewrite = false;
      this.logSeparator = '\n';
      this.startTime = new Date().getTime();
      Object.assign(this, opts);
      this.log('', `🔔${this.name}, 开始!`);

      if (this.isNode()) {
        // Node.js 原生模块
        this.Buffer = Buffer;
        this.fs = require('fs');
        this.path = require('path');
      } else {
        // console.log(`创建 Buffer Polyfill`);
        this.Buffer = this.createBufferPolyfill(); // 创建 Buffer Polyfill
      }
    }

    // Buffer Polyfill（适用于 QuanX / Surge / Loon / TrollScript 等无原生 Buffer 的环境）
    createBufferPolyfill() {
      return class BufferPolyfill extends Uint8Array {
        /**
         * 判断是否为 BufferPolyfill 实例
         */
        static isBuffer(obj) {
          return obj instanceof BufferPolyfill;
        }

        /**
         * 创建指定大小的零填充 Buffer
         */
        static alloc(size, fill = 0) {
          const buf = new BufferPolyfill(size);
          if (fill !== 0) buf.fill(fill);
          return buf;
        }

        /**
         * 拼接多个 Buffer
         */
        static concat(list, totalLength) {
          if (!totalLength) {
            totalLength = list.reduce((acc, buf) => acc + buf.length, 0);
          }
          const result = new Uint8Array(totalLength);
          let offset = 0;
          for (const buf of list) {
            result.set(buf, offset);
            offset += buf.length;
          }
          return new BufferPolyfill(result);
        }

        /**
         * 从多种类型创建 Buffer
         * 支持: string (base64/utf8/hex), Array, Uint8Array, ArrayBuffer
         */
        static from(value, encoding) {
          // 字符串
          if (typeof value === 'string') {
            if (encoding === 'base64' || encoding === 'base64url') {
              // 处理 base64url 编码 (JWT 格式)
              let fixedBase64 = value.replace(/-/g, '+').replace(/_/g, '/');
              while (fixedBase64.length % 4) fixedBase64 += '=';
              try {
                const binaryStr = atob(fixedBase64);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }
                return new BufferPolyfill(bytes);
              } catch (e) {
                console.log('Base64 解码错误:', e.message);
                throw e;
              }
            } else if (encoding === 'hex') {
              const bytes = new Uint8Array(value.length / 2);
              for (let i = 0; i < value.length; i += 2) {
                bytes[i / 2] = parseInt(value.substring(i, i + 2), 16);
              }
              return new BufferPolyfill(bytes);
            } else {
              // 默认 utf-8
              return new BufferPolyfill(new TextEncoder().encode(value));
            }
          }
          // Array / Uint8Array / ArrayBuffer
          if (Array.isArray(value)) {
            return new BufferPolyfill(new Uint8Array(value));
          }
          if (value instanceof ArrayBuffer) {
            return new BufferPolyfill(new Uint8Array(value));
          }
          if (value instanceof Uint8Array || value instanceof BufferPolyfill) {
            return new BufferPolyfill(value);
          }
          throw new Error('BufferPolyfill.from: unsupported input type');
        }

        /**
         * 转换为指定编码的字符串
         * 支持: base64 / utf8 / hex
         */
        toString(encoding = 'utf-8') {
          if (encoding === 'base64') {
            let binaryStr = '';
            for (let i = 0; i < this.length; i++) {
              binaryStr += String.fromCharCode(this[i]);
            }
            return btoa(binaryStr);
          } else if (encoding === 'hex') {
            let hex = '';
            for (let i = 0; i < this.length; i++) {
              hex += this[i].toString(16).padStart(2, '0');
            }
            return hex;
          } else if (['utf8', 'utf-8'].includes(encoding)) {
            return new TextDecoder().decode(this);
          }
          // 回退到 utf-8
          return new TextDecoder().decode(this);
        }
      };
    }

    isNode() {
      return 'undefined' !== typeof module && !!module.exports;
    }

    isQuanX() {
      return 'undefined' !== typeof $task;
    }
    
    isTrollScript() {
      return typeof TrollScriptPlugin !== 'undefined' && TrollScriptPlugin !== undefined;
    }
    isSurge() {
      return 'undefined' !== typeof $httpClient && 'undefined' === typeof $loon;
    }

    isLoon() {
      return 'undefined' !== typeof $loon;
    }

    isShadowrocket() {
      return 'undefined' !== typeof $rocket;
    }

    toObj(str, defaultValue = null) {
      try {
        return JSON.parse(str);
      } catch {
        return defaultValue;
      }
    }

    toStr(obj, defaultValue = null) {
      try {
        return JSON.stringify(obj);
      } catch {
        return defaultValue;
      }
    }

    getJson(key, defaultValue) {
      let json = defaultValue;
      const val = this.getData(key);
      if (val) {
        try {
          json = JSON.parse(val);
        } catch (e) {
          this.logErr(e);
        }
      }
      return json;
    }

    setJson(val, key) {
      try {
        return this.setData(JSON.stringify(val), key);
      } catch (e) {
        this.logErr(e);
        return false;
      }
    }

    getScript(url) {
      return new Promise((resolve) => {
        this.get({ url }, (err, resp, body) => resolve(body));
      });
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
          headers: { 'X-Key': key, Accept: '*/*' },
        };
        this.post(opts, (err, resp, body) => resolve(body));
      }).catch((e) => this.logErr(e));
    }

    loadData() {
      if (this.isNode()) {
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
          if (!filePath && fileName) {
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
          if (!filePath && fileName) {
            filePath = __dirname + '/' + fileName;
          }
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
          if (!filePath && fileName) {
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
      if (this.isTrollScript()) {
        const val = storage.get(key);
        // TrollScript storage.get returns undefined if not exists
        // Env convention: return null or string
        if (val === undefined) return null;
        // storage.get auto-deserializes, but Env expects string
        return typeof val === 'string' ? val : JSON.stringify(val);
      } else if (this.isSurge() || this.isLoon()) {
        return $persistentStore.read(key);
      } else if (this.isQuanX()) {
        return $prefs.valueForKey(key);
      } else if (this.isNode()) {
        this.data = this.loadData();
        return this.data[key];
      } else {
        return (this.data && this.data[key]) || null;
      }
    }

    setVal(val, key) {
      if (this.isTrollScript()) {
        if (val === null || val === undefined || val === '') {
          storage.remove(key);
        } else {
          storage.set(key, val);
        }
        return true;
      } else if (this.isSurge() || this.isLoon()) {
        return $persistentStore.write(val, key);
      } else if (this.isQuanX()) {
        return $prefs.setValueForKey(val, key);
      } else if (this.isNode()) {
        this.data = this.loadData();
        this.data[key] = val;
        this.writeData();
        return true;
      } else {
        return (this.data && this.data[key]) || null;
      }
    }

    initGotEnv(opts) {
      this.got = this.got ? this.got : require('got');
      this.ckTough = this.ckTough ? this.ckTough : require('tough-cookie');
      this.ckJar = this.ckJar ? this.ckJar : new this.ckTough.CookieJar();
      if (opts) {
        opts.headers = opts.headers ? opts.headers : {};
        if (undefined === opts.headers.Cookie && undefined === opts.cookieJar) {
          opts.cookieJar = this.ckJar;
        }
      }
    }

    /**
     * 统一的 HTTP 请求方法，get/post 均通过此方法实现
     * @param {string} method 请求方法 (get/post/put/delete/patch/head)
     * @param {object} opts 请求参数
     * @param {function} callback 回调函数
     */
    _request(method, opts, callback = () => {}) {
      // 清理请求头
      if (opts.headers) {
        delete opts.headers['Host'];
        delete opts.headers['Content-Length'];
        delete opts.headers['host'];
        delete opts.headers['content-length'];
        if (method === 'get') {
          delete opts.headers['Content-Type'];
          delete opts.headers['content-type'];
        }
      }
      if (this.isTrollScript()) {
        (async () => {
          try {
            const tsOpts = { ...opts };
            if (opts.headers) tsOpts.headers = opts.headers;
            if (opts.body) {
              tsOpts.body = typeof opts.body === 'object' ? JSON.stringify(opts.body) : opts.body;
            }
            if (opts.timeout) tsOpts.timeout = Math.ceil(opts.timeout / 1000);
            if (opts.insecure !== undefined) tsOpts.insecure = opts.insecure;
            const methodUpper = method.toUpperCase();
            let response;
            switch (methodUpper) {
              case 'GET':
                response = await http.get(opts.url, tsOpts);
                break;
              case 'PUT':
                response = await http.put(opts.url, tsOpts);
                break;
              case 'DELETE':
                response = await http.delete(opts.url, tsOpts);
                break;
              case 'PATCH':
                response = await http.patch(opts.url, tsOpts);
                break;
              case 'HEAD':
                response = await http.head(opts.url, tsOpts);
                break;
              default:
                response = await http.post(opts.url, tsOpts);
            }
            if (response.success) {
              const body = response.data || '';
              callback(null, {
                status: response.status,
                statusCode: response.status,
                headers: response.headers || {},
                body: body,
              }, body);
            } else {
              callback(response.error || 'Request failed', null, '');
            }
          } catch (e) {
            callback(e.message || e, null, '');
          }
        })();
      } else if (this.isSurge() || this.isLoon()) {
        if (this.isSurge() && this.isNeedRewrite) {
          opts.headers = opts.headers || {};
          Object.assign(opts.headers, { 'X-Surge-Skip-Scripting': false });
        }
        $httpClient[method](opts, (err, resp, body) => {
          if (!err && resp) {
            resp.body = body;
            resp.statusCode = resp.status;
          }
          callback(err, resp, body);
        });
      } else if (this.isQuanX()) {
        opts.method = method;
        if (this.isNeedRewrite) {
          opts.opts = opts.opts || {};
          Object.assign(opts.opts, { hints: false });
        }
        $task.fetch(opts).then(
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
              body
            );
          },
          (err) => callback(err)
        );
      } else if (this.isNode()) {
        this.initGotEnv(opts);
        const { url, ..._opts } = opts;
        const gotCall = method === 'get' ? this.got(opts) : this.got[method](url, _opts);
        if (method === 'get') {
          gotCall.on('redirect', (resp, nextOpts) => {
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
          });
        }
        gotCall.then(
          (resp) => {
            const { statusCode: status, statusCode, headers, body } = resp;
            callback(null, { status, statusCode, headers, body }, body);
          },
          (err) => {
            const { message: error, response: resp } = err;
            callback(error, resp, resp && resp.body);
          }
        );
      }
    }

    get(opts, callback = () => {}) {
      return this._request('get', opts, callback);
    }

    post(opts, callback = () => {}) {
      const method = opts.method ? opts.method.toLocaleLowerCase() : 'post';
      return this._request(method, opts, callback);
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
    time(fmt, ts) {
      var date;

      if (ts instanceof Date) {
        date = ts;
      } else if (ts !== undefined && ts !== null) {
        date = new Date(ts);
      } else {
        date = new Date();
      }

      function pad2(num) {
        num = String(num);
        return num.length < 2 ? '0' + num : num;
      }

      var map = {
        M: date.getMonth() + 1,
        d: date.getDate(),
        H: date.getHours(),
        m: date.getMinutes(),
        s: date.getSeconds(),
        q: Math.floor((date.getMonth() + 3) / 3),
        S: date.getMilliseconds(),
      };

      // 年份
      fmt = fmt.replace(/y{1,4}/g, function (match) {
        var year = String(date.getFullYear());
        return match.length === 4 ? year : year.slice(4 - match.length);
      });

      // 其它
      fmt = fmt.replace(/M{1,2}|d{1,2}|H{1,2}|m{1,2}|s{1,2}|q{1,2}|S/g, function (match) {
        var key = match.charAt(0);
        var val = map[key];

        if (key === 'S') {
          return String(val);
        }

        if (match.length === 1) {
          return String(val);
        }

        return pad2(val);
      });

      return fmt;
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
    msg(title = name, subt = '', desc = '', opts) {
      const toEnvOpts = (rawOpts) => {
        if (!rawOpts) return rawOpts;
        if (typeof rawOpts === 'string') {
          if (this.isLoon()) return rawOpts;
          else if (this.isQuanX()) return { 'open-url': rawOpts };
          else if (this.isSurge()) return { url: rawOpts };
          else return undefined;
        } else if (typeof rawOpts === 'object') {
          if (this.isLoon()) {
            let openUrl = rawOpts.openUrl || rawOpts.url || rawOpts['open-url'];
            let mediaUrl = rawOpts.mediaUrl || rawOpts['media-url'];
            return { openUrl, mediaUrl };
          } else if (this.isQuanX()) {
            let openUrl = rawOpts['open-url'] || rawOpts.url || rawOpts.openUrl;
            let mediaUrl = rawOpts['media-url'] || rawOpts.mediaUrl;
            let updatePasteboard =
              rawOpts['update-pasteboard'] || rawOpts.updatePasteboard;
            return {
              'open-url': openUrl,
              'media-url': mediaUrl,
              'update-pasteboard': updatePasteboard,
            };
          } else if (this.isSurge()) {
            let openUrl = rawOpts.url || rawOpts.openUrl || rawOpts['open-url'];
            return { url: openUrl };
          }
        } else {
          return undefined;
        }
      };
      if (!this.isMute) {
        if (this.isTrollScript()) {
          try {
            const body = [subt, desc].filter(Boolean).join('\n');
            notification.send(title, body || ' ');
          } catch (e) {}
        } else if (this.isSurge() || this.isLoon()) {
          $notification.post(title, subt, desc, toEnvOpts(opts));
        } else if (this.isQuanX()) {
          $notify(title, subt, desc, toEnvOpts(opts));
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

    log(...logs) {
      if (
        this.noLog ||
        (this.noLogKey &&
          (this.getData(this.noLogKey) || 'N').toLocaleUpperCase() === 'Y')
      ) {
        return;
      }
      if (logs.length > 0) {
        this.logs = [...this.logs, ...logs];
      }
      console.log(logs.join(this.logSeparator));
    }

    logErr(err, msg) {
      const isPrintSack = !this.isSurge() && !this.isQuanX() && !this.isLoon();
      if (!isPrintSack) {
        this.log('', `❗️${this.name}, 错误!`, err);
      } else {
        this.log('', `❗️${this.name}, 错误!`, err.stack);
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
      if (this.isSurge() || this.isQuanX() || this.isLoon()) {
        $done(val);
      }
      if (this.isNode()) {
        process.exit(0);
      }
      // TrollScript: 脚本自然结束即可，无需特殊处理
    }

    isJWT(token) {
      return token.split('.').length === 3;
    }

    decodeJWT(token) {
      if (!this.isJWT(token)) {
        throw new Error('Token is not a valid JWT.');
      }

      const [header, payload, signature] = token.split('.');
      const decodeBase64 = (base64) =>
        JSON.parse(this.Buffer.from(base64, 'base64').toString('utf-8'));
      try {
        const decodedHeader = decodeBase64(header);
        const decodedPayload = decodeBase64(payload);
        return {
          header: decodedHeader,
          payload: decodedPayload,
          signature, // 签名部分通常无法解码，除非验证密钥
        };
      } catch (error) {
        console.log(error.message);
        throw new Error('Failed to decode JWT: ' + error.message);
      }
    }
  })(name, opts);
}
