/**
 * 京东多账号-物流派件提醒
 * 派送状态会跑一次，通知一次
 * 超过30天的订单，不通知不显示
 *
 *
 * > 同时支持使用 NobyDa 与 domplin 脚本的京东 cookie
 * > https://raw.githubusercontent.com/NobyDa/Script/master/JD-DailyBonus/JD_DailyBonus.js
 * > https://raw.githubusercontent.com/dompling/Script/master/jd/JD_extra.js
 *
 * # Surge
 * Tasks: 京东物流派件提醒 = type=cron,cronexp=0 12 * * *,script-path=https://raw.githubusercontent.com/id77/QuantumultX/master/task/jdWuLiu.js,wake-system=true
 *
 * # QuanX
 * 0 12 * * * https://raw.githubusercontent.com/id77/QuantumultX/master/task/jdWuLiu.js, tag=京东物流派件提醒, img-url=https://raw.githubusercontent.com/id77/QuantumultX/master/icon/jdWuLiu.png
 *
 * # Loon
 * cron "0 12 * * *" script-path=https://raw.githubusercontent.com/id77/QuantumultX/master/task/jdWuLiu.js
 *
 */
const $ = new Env('京东物流');
$.PAGE_MAX_KEY = 'id77_jdWuLiu_pageMax';
$.CARRIAGE_ID_ARR_KEY = 'id77_carriageIdArr';
$.USER_NUM = 'id77_jdWuLiu_userNum';
$.pageMax = $.getData($.PAGE_MAX_KEY) || 10;
$.carriageIdArr = JSON.parse($.getData($.CARRIAGE_ID_ARR_KEY) || '[]');
$.isMuteLog = true;
$.page = 1;

let cookies = [];
$.getData('CookieJD') && cookies.push($.getData('CookieJD'));
$.getData('CookieJD2') && cookies.push($.getData('CookieJD2'));

const extraCookies = JSON.parse($.getData('CookiesJD') || '[]').map(
  (item) => item.cookie
);
cookies = Array.from(new Set([...cookies, ...extraCookies]));

// 清除过期缓存
const length = $.carriageIdArr.length;
$.log(`💡缓存数据：${length}条`);

$.userNum = $.getData($.USER_NUM) || cookies.length;

const total = $.pageMax * $.userNum;
if (length > total) {
  $.setData(
    JSON.stringify($.carriageIdArr.slice(length - total, length)),
    $.CARRIAGE_ID_ARR_KEY
  );
}

const opts = {
  headers: {
    Accept: `*/*`,
    Connection: `keep-alive`,
    'Accept-Language': 'zh-cn',
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent': `Mozilla/5.0 (iPhone; CPU iPhone OS 14_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.1 Mobile/15E148 Safari/604.1`,
  },
};

!(async () => {
  let cookie, userInfo, orderList, order, wuLiuDetail;

  for (let index = 0; index < $.userNum; index++) {
    cookie = cookies[index];
    opts.headers.Cookie = cookie;

    userInfo = await getUserInfo();
    orderList = [];

    for (let p = 1; p <= $.pageMax / 10; p++) {
      $.page = p;

      orderList = [...orderList, ...(await getOrderList())];
    }

    for (let k = 0; k < orderList.length; k++) {
      const {
        orderId,
        orderType,
        stateInfo: { stateName },
      } = orderList[k];

      $.logText = '';
      if (k === 0) {
        $.logText = '====================================\n';
        $.logText += `🙆🏻‍♂️账号：${userInfo.baseInfo.nickname}\n`;
      }
      // 忽略取消订单以及非实物订单
      if (
        stateName !== '已取消' &&
        stateName !== '退款成功' &&
        stateName !== '处理成功' &&
        orderType !== '75' &&
        stateName !== '已消费' &&
        orderType !== '37' &&
        stateName !== '充值成功'
      ) {
        wuLiuDetail = await getWuLiu(orderId);
        await showMsg(userInfo, wuLiuDetail, orderId, k);
        console.log($.logText);
        await $.wait(777);
      }
    }
  }
})()
  .catch((e) => $.logErr(e))
  .finally(() => $.done());

function getUserInfo() {
  return new Promise((resolve) => {
    opts.url =
      'https://me-api.jd.com/user_new/info/GetJDUserInfoUnion?orgFlag=JD_PinGou_New&callSource=mainorder&channel=4&isHomewhite=0&sceneval=2&g_login_type=1g_ty=ls';
    opts.headers.Referer = `https://home.m.jd.com/`;

    $.get(opts, (err, resp, data) => {
      let userInfo;

      try {
        userInfo = JSON.parse(data).data.userInfo;
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve(userInfo);
      }
    });
  });
}

function getOrderList() {
  return new Promise((resolve) => {
    opts.url = `https://wq.jd.com/bases/orderlist/list?order_type=0&start_page=${$.page}&page_size=10`;
    opts.headers.Referer = `https://wqs.jd.com/order/orderlist_merge.shtml?sceneval=2&orderType=waitReceipt`;

    $.get(opts, (err, resp, data) => {
      let orderList;

      try {
        orderList = JSON.parse(data).orderList;
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve(orderList);
      }
    });
  });
}

function getWuLiu(orderId) {
  return new Promise((resolve) => {
    opts.url = `https://wq.jd.com/bases/wuliudetail/dealloglist?deal_id=${orderId}`;
    opts.headers.Referer = `https://wqs.jd.com/order/deal_wuliu.shtml?from=orderdetail&dealState=15&dealId=${orderId}&orderType=18&sceneval=2`;

    $.get(opts, (err, resp, data) => {
      let detail;

      try {
        detail = JSON.parse(data);
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve(detail);
      }
    });
  });
}

function showMsg(userInfo, wuLiuDetail, orderId, k) {
  return new Promise((resolve) => {
    const {
      carrier = '',
      carriageId,
      recvMobile,
      orderWareList,
      dealLogList,
    } = wuLiuDetail;
    // 部分订单属于敏感信息，收货之后，物流信息不会返回
    // 比如购药订单
    if (!dealLogList) {
      return resolve();
    }
    const index = dealLogList.length - 1;
    const dealLog =
      dealLogList.length > 0 ? dealLogList[index].wlStateDesc : '无';
    // 0006 派送
    // 0008 可能代签收/快递柜/物流寄存点
    const wuLiuStateCode = dealLogList[index].groupType;

    const _30DayBefore = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const { createTime } = dealLogList[index];

    // 清空派送超过30天的记录
    if (_30DayBefore > new Date(createTime.replace(/\-/g, '/')).getTime()) {
      $.setData(
        JSON.stringify($.carriageIdArr.filter((item) => item !== carriageId)),
        $.CARRIAGE_ID_ARR_KEY
      );

      return resolve();
    }

    if (k > 0) {
      $.logText += `------------------------------------\n`;
    }

    $.name = `京东物流 账号：${userInfo.baseInfo.nickname}`;
    $.subt = ``;
    $.desc = `📦${carrier.replace(
      /包裹|大件/,
      ''
    )}：${carriageId}\n📱手机尾号：${recvMobile.slice(-4)}`;
    $.info = `📘包含商品：${orderWareList[0].itemName}\n📗商品数目：${orderWareList.length}\n📕订单编号：${orderId}`;
    $.wl = `🚚最新物流：${dealLog}`;
    $.imgPath = `https://img30.360buyimg.com/jdwlcms/${orderWareList[0].itemImgPath}`;
    $.state = `🚥当前状态：${
      wuLiuStateCode === '0008'
        ? '🟢签收'
        : wuLiuStateCode === '0006'
        ? '🟡派送'
        : '🔴运输'
    }\n`;

    $.logText +=
      $.subt + '\n' + $.desc + '\n' + $.info + '\n' + $.wl + '\n' + $.state;
    // 已通知过的快递，跳过通知
    if ($.carriageIdArr.includes(carriageId)) {
      return resolve();
    }

    if (wuLiuStateCode !== '0006' && wuLiuStateCode !== '0008') {
      return resolve();
    }

    // 缓存 0008 状态，只通知一次
    if (wuLiuStateCode === '0008') {
      $.carriageIdArr.push(carriageId);

      $.setData(JSON.stringify($.carriageIdArr), $.CARRIAGE_ID_ARR_KEY);
    }

    $.msg($.name, $.subt, $.desc + '\n' + $.wl, {
      openUrl: `openjd://virtual?params=%7B%20%22category%22:%20%22jump%22,%20%22des%22:%20%22m%22,%20%22url%22:%20%22https://wqs.jd.com/order/n_detail_v2.shtml?deal_id=${orderId}%22%7D`,
      mediaUrl: $.imgPath,
    });

    resolve();
  });
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
