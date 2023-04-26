/**
 * 伊利乳品 - 小程序
 *
 * > 支持多账号
 * > 进入小程序点我的
 *
 * hostname = club.yili.com
 *
 * # Surge
 * Rewrite: 伊利乳品 = type=http-request, requires-body=1, pattern=https:\/\/club\.yili\.com\/MALLIFChe\/MCSWSIAPI\.asmx\/Call,script-path=https://raw.githubusercontent.com/id77/QuantumultX/master/task/yiLi.cookie.js
 * Tasks: 伊利乳品 = type=cron,cronexp=10 0 * * *,script-path=https://raw.githubusercontent.com/id77/QuantumultX/master/task/yiLi.js,wake-system=true
 *
 * # QuanX
 * https:\/\/club\.yili\.com\/MALLIFChe\/MCSWSIAPI\.asmx\/Call url script-request-body https://raw.githubusercontent.com/id77/QuantumultX/master/task/yiLi.cookie.js
 * 10 0 * * * https://raw.githubusercontent.com/id77/QuantumultX/master/task/yiLi.js, tag=伊利乳品, img-url=https://raw.githubusercontent.com/id77/QuantumultX/master/icon/yiLi.png
 *
 * # Loon
 * http-request https:\/\/club\.yili\.com\/MALLIFChe\/MCSWSIAPI\.asmx\/Call script-path=https://raw.githubusercontent.com/id77/QuantumultX/master/task/yiLi.cookie.js, requires-body=true,
 * cron "10 0 * * *" script-path=https://raw.githubusercontent.com/id77/QuantumultX/master/task/yiLi.js
 *
 */

const $ = new Env('伊利乳品');
$.COOKIES_KEY = 'id77_yiLi_cookies';

const users = $.getData($.COOKIES_KEY);
$.users = users ? JSON.parse(users) : {};

const headers = {
  'Accept-Encoding': `gzip,deflate,br`,
  'content-type': `application/x-www-form-urlencoded`,
  Connection: `keep-alive`,
  Accept: `*/*`,
  Host: `club.yili.com`,
  'User-Agent': `Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/7.0.15(0x17000f27) NetType/WIFI Language/zh_CN`,
};

const body = {
  DeviceCode: 'DeviceCode',
  CompressFlag: 'Y',
};

!(async () => {
  if ($request.body.includes('MALLIFCheese.GetPointsBalance')) {
    let reqBody = JSON.parse(
      decodeURIComponent($request.body)
        .replace(/RequestPack=/, '')
        .replace(/\\/g, '')
        .replace(/("(\{|\[))|((\}|\])")/g, '$2$4')
    );
    // $.log(JSON.stringify(reqBody));

    const {
      AuthKey,
      Params: { OpenId },
    } = reqBody;

    $.userInfo = {
      authKey: AuthKey,
      openId: OpenId,
    };

    // 获取账号信息，写入 $.userInfo
    await getUserInfo();

    $.users[OpenId] = $.userInfo;

    if ($.userInfo.aspnetUserId) {
      if ($.setData(JSON.stringify($.users), $.COOKIES_KEY)) {
        $.subt = `获取会话: 成功!`;
      } else {
        $.subt = `获取会话: 失败!`;
      }
      $.msg($.name, $.subt);
    }
  }
})()
  .catch((e) => $.logErr(e))
  .finally(() => $.done());

function getUserInfo() {
  return new Promise((resolve) => {
    const { authKey, openId } = $.userInfo;
    const params = JSON.stringify({
      OpenId: openId,
      Platform: 'YLCheese_SmallPragram',
      DeviceCode: 'DeviceCode',
    });
    body.AuthKey = authKey;
    body.Method = 'MALLIFCheese.LoginByWechatOpenId';
    body.Params = params;

    const opts = {
      headers,
      body: `RequestPack=${encodeURIComponent(JSON.stringify(body))}`,
    };
    opts.url = `https://club.yili.com/MALLIFChe/MCSWSIAPI.asmx/Call`;

    $.post(opts, (err, resp, data) => {
      try {
        data = XMLtoJson(data).Result.UserInfo;

        $.userInfo = {
          ...$.userInfo,
          ...data,
        };
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve();
      }
    });
  });
}

function XMLtoJson(xml) {
  return JSON.parse(
    xml
      .match(/>(.*)<\//)[1]
      .replace(/\\/g, '')
      .replace(/("(\{|\[))|((\}|\])")/g, '$2$4')
  );
}

// https://github.com/chavyleung/scripts/blob/master/Env.js
// prettier-ignore
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
      return new Promise((resolve, reject) => {
        sender.call(this, opts, (err, resp, body) => {
          if (err) reject(err);
          else resolve(resp);
        });
      });
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
    }

    isNode() {
      return 'undefined' !== typeof module && !!module.exports;
    }

    isQuanX() {
      return 'undefined' !== typeof $task;
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
      if (this.isSurge() || this.isLoon()) {
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
      if (this.isSurge() || this.isLoon()) {
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

    get(opts, callback = () => {}) {
      if (opts.headers) {
        delete opts.headers['Content-Type'];
        delete opts.headers['Content-Length'];
      }
      if (this.isSurge() || this.isLoon()) {
        if (this.isSurge() && this.isNeedRewrite) {
          opts.headers = opts.headers || {};
          Object.assign(opts.headers, { 'X-Surge-Skip-Scripting': false });
        }
        $httpClient.get(opts, (err, resp, body) => {
          if (!err && resp) {
            resp.body = body;
            resp.statusCode = resp.status;
          }
          callback(err, resp, body);
        });
      } else if (this.isQuanX()) {
        if (this.isNeedRewrite) {
          opts.opts = opts.opts || {};
          Object.assign(opts.opts, { hints: false });
        }
        $task.fetch(opts).then(
          (resp) => {
            const { statusCode: status, statusCode, headers, body } = resp;
            callback(null, { status, statusCode, headers, body }, body);
          },
          (err) => callback(err)
        );
      } else if (this.isNode()) {
        this.initGotEnv(opts);
        this.got(opts)
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

    post(opts, callback = () => {}) {
      const method = opts.method ? opts.method.toLocaleLowerCase() : 'post';
      // 如果指定了请求体, 但没指定`Content-Type`, 则自动生成
      // if (opts.body && // opts.headers && !opts.headers['Content-Type']) {
        // opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      //  }
      if (opts.headers) delete opts.headers['Content-Length'];
      if (this.isSurge() || this.isLoon()) {
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
            const { statusCode: status, statusCode, headers, body } = resp;
            callback(null, { status, statusCode, headers, body }, body);
          },
          (err) => callback(err)
        );
      } else if (this.isNode()) {
        this.initGotEnv(opts);
        const { url, ..._opts } = opts;
        this.got[method](url, _opts).then(
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
        if (this.isSurge() || this.isLoon()) {
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
      if (this.noLog || (this.noLogKey && (this.getData(this.noLogKey) || 'N').toLocaleUpperCase() === 'Y')) {
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
    }
  })(name, opts);
}
