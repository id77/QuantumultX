// https://github.com/chavyleung/scripts/blob/master/Env.js
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
      this.noLogKey = opts.noLogKey || '';
      this.noLog = opts.noLog;
      this.isNeedRewrite = false;
      this.logSeparator = '\n';
      this.encoding = 'utf-8';
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

    getBase64Chars() {
      return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    }

    normalizeBase64(base64) {
      const cleaned = String(base64 || '')
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .replace(/\s+/g, '');
      return cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4);
    }

    atobFallback(base64) {
      const chars = this.getBase64Chars();
      const normalized = this.normalizeBase64(base64).replace(/=+$/, '');
      let bits = 0;
      let bitLength = 0;
      let out = '';

      for (let i = 0; i < normalized.length; i++) {
        const val = chars.indexOf(normalized[i]);
        if (val < 0) continue;

        bits = (bits << 6) | val;
        bitLength += 6;

        if (bitLength >= 8) {
          bitLength -= 8;
          out += String.fromCharCode((bits >> bitLength) & 0xff);
        }
      }

      return out;
    }

    btoaFallback(binary) {
      const chars = this.getBase64Chars();
      let out = '';
      let i = 0;

      while (i < binary.length) {
        const c1 = binary.charCodeAt(i++) & 0xff;
        const c2 = i < binary.length ? binary.charCodeAt(i++) & 0xff : NaN;
        const c3 = i < binary.length ? binary.charCodeAt(i++) & 0xff : NaN;

        const n = (c1 << 16) | ((c2 || 0) << 8) | (c3 || 0);
        out += chars[(n >> 18) & 63];
        out += chars[(n >> 12) & 63];
        out += Number.isNaN(c2) ? '=' : chars[(n >> 6) & 63];
        out += Number.isNaN(c3) ? '=' : chars[n & 63];
      }

      return out;
    }

    atob(base64) {
      const normalized = this.normalizeBase64(base64);
      if (typeof atob === 'function') return atob(normalized);
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(normalized, 'base64').toString('binary');
      }
      return this.atobFallback(normalized);
    }

    btoa(binary) {
      if (typeof btoa === 'function') return btoa(binary);
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(binary, 'binary').toString('base64');
      }
      return this.btoaFallback(binary);
    }

    // Buffer Polyfill（适用于 QuanX / Surge / Loon / TrollScript 等无原生 Buffer 的环境）
    createBufferPolyfill() {
      const env = this;
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
                const binaryStr = env.atob(fixedBase64);
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
            return env.btoa(binaryStr);
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

    normalizeBytes(input) {
      if (!input) return new Uint8Array();

      if (
        typeof this.Buffer !== 'undefined' &&
        this.Buffer.isBuffer &&
        this.Buffer.isBuffer(input)
      ) {
        return input; // Buffer 本身也是 Uint8Array
      }

      if (input instanceof Uint8Array) {
        return input;
      }

      if (input instanceof ArrayBuffer) {
        return new Uint8Array(input);
      }

      if (ArrayBuffer.isView(input)) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      }

      if (Array.isArray(input)) {
        return Uint8Array.from(input);
      }

      return new Uint8Array();
    }

    bytesToBase64(input) {
      // Node.js / 支持 Buffer
      if (typeof this.Buffer !== 'undefined') {
        const bytes = this.normalizeBytes(input);
        return this.Buffer.from(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength,
        ).toString('base64');
      }

      // 浏览器/QX 回退
      const bytes = this.normalizeBytes(input);
      if (!bytes.byteLength) return '';

      let binary = '';
      const chunkSize = 0x8000;

      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(
          null,
          bytes.subarray(i, i + chunkSize),
        );
      }

      return this.btoa(binary);
    }

    base64ToBytes(base64) {
      if (!base64) {
        return typeof this.Buffer !== 'undefined'
          ? this.Buffer.alloc(0)
          : new Uint8Array();
      }

      // Node.js / 支持 Buffer
      if (typeof this.Buffer !== 'undefined') {
        return this.Buffer.from(base64, 'base64');
      }

      // 浏览器/QX 回退
      const binary = this.atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    cloneBytesValue(value) {
      if (value == null) return value;

      if (
        typeof this.Buffer !== 'undefined' &&
        this.Buffer.isBuffer &&
        this.Buffer.isBuffer(value)
      ) {
        return this.Buffer.from(value);
      }

      if (value instanceof ArrayBuffer) {
        return value.slice(0);
      }

      if (ArrayBuffer.isView(value)) {
        if (value instanceof Uint8Array) {
          return new Uint8Array(value);
        }
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      }

      return value;
    }

    cloneRequestPreserveBinary(req) {
      const cloned = {
        ...req,
        headers: req.headers ? { ...req.headers } : req.headers,
      };

      if ('body' in cloned) {
        cloned.body = this.cloneBytesValue(cloned.body);
      }

      if ('bodyBytes' in cloned) {
        cloned.bodyBytes = this.cloneBytesValue(cloned.bodyBytes);
      }

      return cloned;
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
      if ('undefined' !== typeof TrollScriptPlugin) return 'TrollScript';
    }

    isNode() {
      return 'Node.js' === this.getEnv();
    }

    isQuanX() {
      return 'Quantumult X' === this.getEnv();
    }

    isTrollScript() {
      return 'TrollScript' === this.getEnv();
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
          '@chavy_boxjs_userCfgs.httpApi_timeout',
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
        const curDirDataFilePath = this.path.resolve(this.dataFile);
        const rootDirDataFilePath = this.path.resolve(
          process.cwd(),
          this.dataFile,
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
          this.dataFile,
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
          obj,
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
        case 'TrollScript':
          const val = storage.get(key);
          // TrollScript storage.get returns undefined if not exists
          // Env convention: return null or string
          if (val === undefined) return null;
          // storage.get auto-deserializes, but Env expects string
          return typeof val === 'string' ? val : JSON.stringify(val);
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
        case 'TrollScript':
          if (val === null || val === undefined || val === '') {
            storage.remove(key);
          } else {
            storage.set(key, val);
          }
          return true;
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

    /**
     * 统一的 HTTP 请求方法，get/post 均通过此方法实现
     * @param {string} method 请求方法 (get/post/put/delete/patch/head)
     * @param {object} request 请求参数
     * @param {function} callback 回调函数
     */
    _request(method, request, callback = () => {}) {
      // 清理请求头
      if (request.headers) {
        delete request.headers['Content-Length'];
        delete request.headers['Host'];
        // HTTP/2 全是小写
        delete request.headers['content-length'];
        delete request.headers['host'];

        if (method === 'get') {
          delete request.headers['Content-Type'];
          // HTTP/2 全是小写
          delete request.headers['content-type'];
        }
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
        case 'TrollScript':
          (async () => {
            try {
              const tsOpts = { ...request };
              if (request.headers) tsOpts.headers = request.headers;
              if (request.body) {
                tsOpts.body =
                  typeof request.body === 'object'
                    ? JSON.stringify(request.body)
                    : request.body;
              }
              if (request.timeout)
                tsOpts.timeout = Math.ceil(request.timeout / 1000);
              if (request.insecure !== undefined)
                tsOpts.insecure = request.insecure;

              let response = await http.request(tsOpts.url, tsOpts);

              if (response.success) {
                const body = response.data || '';
                callback(
                  null,
                  {
                    status: response.status,
                    statusCode: response.status,
                    headers: response.headers || {},
                    body: body,
                  },
                  body,
                );
              } else {
                callback(response.error || 'Request failed', null, '');
              }
            } catch (e) {
              callback(e.message || e, null, '');
            }
          })();
          break;
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
                bodyBytes,
              );
            },
            (err) => callback((err && err.error) || 'UndefinedError'),
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
                body,
              );
            },
            (err) => {
              const { message: error, response: resp } = err;
              callback(
                error,
                resp,
                resp && iconv.decode(resp.rawBody, this.encoding),
              );
            },
          );
          break;
      }
    }

    get(request, callback = () => {}) {
      return this._request('get', request, callback);
    }

    post(request, callback = () => {}) {
      const method = request.method
        ? request.method.toLocaleLowerCase()
        : 'post';
      return this._request(method, request, callback);
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
      fmt = fmt.replace(
        /M{1,2}|d{1,2}|H{1,2}|m{1,2}|s{1,2}|q{1,2}|S/g,
        function (match) {
          var key = match.charAt(0);
          var val = map[key];

          if (key === 'S') {
            return String(val);
          }

          if (match.length === 1) {
            return String(val);
          }

          return pad2(val);
        },
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

                // 图片通知
                let mediaUrl =
                  rawopts.mediaUrl || rawopts['media-url'] || $media;
                if (mediaUrl) {
                  let media = undefined;
                  let mime = undefined;
                  // http 开头的网络地址
                  if (mediaUrl.startsWith('http')) {
                    //不做任何操作
                  }
                  // 带标识的 Base64 字符串
                  // data:image/png;base64,iVBORw0KGgo...
                  else if (mediaUrl.startsWith('data:')) {
                    const [data] = mediaUrl.split(';');
                    const [, base64str] = mediaUrl.split(',');
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
                    media = mediaUrl;
                    mime = getMimeFromBase64(mediaUrl);
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

                let mediaUrl =
                  rawopts.mediaUrl || rawopts['media-url'] || $media;
                if (mediaUrl) Object.assign(options, { mediaUrl });
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

                let mediaUrl =
                  rawopts.mediaUrl || rawopts['media-url'] || $media;
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
          case 'TrollScript':
            try {
              const body = [subt, desc].filter(Boolean).join('\n');
              notification.send(title, body || ' ');
            } catch (e) {}
            break;
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
            .join(this.logSeparator)}`,
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
            .join(this.logSeparator)}`,
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
            .join(this.logSeparator)}`,
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
            .join(this.logSeparator)}`,
        );
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
            err.stack,
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
          process.exit(0);
      }
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
