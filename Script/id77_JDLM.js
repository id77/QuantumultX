/*

Author: 2Ya
version: v1.0.2
Github: https://github.com/domping
ScriptName: 京东账号登陆辅助
==================================
该脚本需要搭配 【京东账号 CK 检索】 使用
==================================

[MITM]
hostname = plogin.m.jd.com,home.m.jd.com

【Surge脚本配置】:
===================
[Script]
京东登陆页面辅助 = type=http-response,pattern=^https?:\/\/home\.m\.jd\.com\/userinfom\/QueryUserInfoM,requires-body=1,max-size=0,timeout=1000,script-path=https://raw.githubusercontent.com/dompling/Script/master/jd/jd_login_help.js,script-update-interval=0
京东个人中心登陆辅助 = type=http-response,pattern=^https?:\/\/plogin\.m\.jd\.com\/login\/login,requires-body=1,max-size=0,timeout=1000,script-path=https://raw.githubusercontent.com/dompling/Script/master/jd/jd_login_help.js,script-update-interval=0
===================
【Loon脚本配置】:
===================
[Script]
http-response ^https?:\/\/home\.m\.jd\.com\/userinfom\/QueryUserInfoM tag=京东登陆辅助, script-path=https://raw.githubusercontent.com/dompling/Script/master/jd/jd_login_help.js,requires-body=1
http-response ^https?:\/\/plogin\.m\.jd\.com\/login\/login tag=京东登陆辅助, script-path=https://raw.githubusercontent.com/dompling/Script/master/jd/jd_login_help.js,requires-body=1
===================
【 QX  脚本配置 】:
===================
[rewrite_local]
^https?:\/\/home\.m\.jd\.com\/userinfom\/QueryUserInfoM url script-response-body https://raw.githubusercontent.com/dompling/Script/master/jd/jd_login_help.js
^https?:\/\/plogin\.m\.jd\.com\/login\/login url script-response-body https://raw.githubusercontent.com/dompling/Script/master/jd/jd_login_help.js

 */

let html = $response.body;

if (!html.includes('<head>')) {
  $done({ body: html });
}

const $ = new API('jd_ck_remark');

const APIKey = 'CookiesJD';
const CacheKey = `#${APIKey}`;
const remark_key = `remark`;
const searchKey = 'keyword';
$.url = $request.url;
$.html = $response.body;

const isJS = $.url.match(/^https:\/\/.*\.com\/.*(\.js)/);
const isLogin = $.url.indexOf('/login/login') > -1;
$.headers = $response.headers;

// 处理各页面 rem 兼容
function getRem(r) {
  return `${r * 25}vw`;
}

// 初始化 boxjs 数据
function initBoxJSData() {
  const CookiesJD = JSON.parse($.read(CacheKey) || '[]');
  const CookieJD = $.read('#CookieJD');
  const CookieJD2 = $.read('#CookieJD2');
  const ckData = CookiesJD.map((item) => item.cookie);
  if (CookieJD) ckData.unshift(CookieJD);
  if (CookieJD2) ckData.unshift(CookieJD2);

  const cookiesFormat = {};
  ckData.forEach((item) => {
    let username = item.match(/pt_pin=(.+?);/)[1];
    username = decodeURIComponent(username);
    cookiesFormat[username] = item;
  });
  let cookiesRemark = JSON.parse($.read(remark_key) || '[]');
  const keyword = ($.read(searchKey) || '').split(',');
  cookiesRemark = cookiesRemark.filter((item, index) => {
    return keyword[0]
      ? keyword.indexOf(`${index}`) > -1 ||
          keyword.indexOf(item.username) > -1 ||
          keyword.indexOf(item.nickname) > -1 ||
          keyword.indexOf(item.status) > -1
      : !!item.mobile;
  });

  cookiesRemark = cookiesRemark
    .map((item) => ({ ...item, cookie: cookiesFormat[item.username] }))
    .filter((item) => !!item.cookie);
  return cookiesRemark;
}

const cookiesRemark = initBoxJSData();

const options = cookiesRemark
  .map(
    (item) =>
      `<option value="${item.mobile}">${item.username}[${item.nickname}]</option>`
  )
  .join('');

// 生成标签样式
function createStyle() {
  return `
<style>
  .tool_bars{
    position: fixed;
    top:50%;
    right: 0;
    z-index: 999;
    transform: translateY(-50%);
  }
  .tool_bar{
    display: flex;
    height:33px;
    width:33px;
    align-items: center;
    background: #f7bb10;
    padding-left: 2px;
    border-top-left-radius: 50%;
    border-bottom-left-radius: 50%;
    padding-right: 3px;
    color: #fff;
    font-size: ${getRem(0.1)};
    margin-bottom: ${getRem(0.1)};
  }
  .tool_bar img,.tool_bar span{
    border-radius: 50%;
    border:1px solid #fff;
    width: 27px;
    height: 27px;
    line-height: 27px;
    text-align: center;
    display: block;
    font-size: ${getRem(0.1)};
  }
  #cus-mask{
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
    background: rgba(0,0,0,.6);
  }
  .cus-mask_view{
    width: 85%;
    background: #fff;
    border-radius: ${getRem(0.1)};
    position: relative;
    top: 50%;
    left: 50%;
    color: #2e2d2d;
    transform: translate(-50%,-50%);
    -ms-transform: translate(-50%,-50%);
    -moz-transform: translate(-50%,-50%);
    -webkit-transform: translate(-50%,-50%);
    -o-transform: translate(-50%,-50%);
  }
  .cus-view{
    font-size: ${getRem(0.16)};
    font-family: PingFangSC-Semibold;
    text-align: center;
    padding: ${getRem(0.18)} 0 ${getRem(0.13)};
  }
  .cus-content{
    font-family: PingFangSC-Regular;
    font-size: ${getRem(0.14)};
    line-height: ${getRem(0.22)};
    padding: 0 ${getRem(0.25)};
    height: ${getRem(1.98)};
    overflow-x: hidden;
    overflow-y: scroll;
  }
  .cus-content label{
    color: rgba(0,0,0,.4);
    font-size: ${getRem(0.16)};
    margin-bottom: ${getRem(0.2)};
    display: block
  }
  .cus-content ul{
    padding-left: ${getRem(0.2)};
    color: rgba(0,0,0,.4);
    margin-top: ${getRem(0.1)};
    font-size: ${getRem(0.1)}
  }
  .cus-content li{
    list-style-type: cjk-ideographic;
  }
  #jd_account{
    width: 100%;
    height: ${getRem(0.4)};
    text-align: center
  }
  .cus-footer{
    margin-top: ${getRem(0.09)};
    border-radius: ${getRem(0.1)};
    -webkit-box-shadow: 0 -${getRem(0.025)} ${getRem(0.05)} 0 rgb(0 0 0/10%);
    box-shadow: 0 -${getRem(0.025)} ${getRem(0.05)} 0 rgb(0 0 0/10%);
  }
  .cus-footer .abtn{
    display: inline-block;
    font-family: PingFangSC-Regular;
    font-size: ${getRem(0.15)};
    color: #2e2d2d;
    text-align: center;
    height: ${getRem(0.45)};
    line-height: ${getRem(0.45)};
    width: 50%;
    border-top: 1px solid #eaeaea;
  }
  .cus-footer span{
    font-size: ${getRem(0.15)};
  }
  #fill-input,#clear-ck{
    border-left: 1px solid #eaeaea;
    border-top: 1px solid #eaeaea;
  }
  .cus-footer .btn-ok{
    color: #fff;
    background-image: -webkit-gradient(linear,left top,right top,from(#f7bb10),to(#ff4f18));
    background-image: -webkit-linear-gradient(left,#f7bb10,#ff4f18);
    background-image: -o-linear-gradient(left,#f7bb10,#ff4f18);
    background-image: linear-gradient(90deg,#f7bb10,#ff4f18);
    border-radius: 0 0 ${getRem(0.1)} 0;
  }
  #cus-tip{
    position: fixed;
    z-index: 999;
    background: rgba(0,0,0,.5);
    color: #fff;
    min-width: ${getRem(1)};
    min-height:${getRem(0.35)} ;
    max-width: 80%;
    max-height: 50%;
    overflow-y: scroll;
    top:50%;
    left: 50%;
    text-align: center;
    padding: ${getRem(0.1)};
    box-sizing: border-box;
    font-size: ${getRem(0.1)};
    border-radius: ${getRem(0.1)};
    transform: translate(-50%,-50%);
    -ms-transform: translate(-50%,-50%);
    -moz-transform: translate(-50%,-50%);
    -webkit-transform: translate(-50%,-50%);
    -o-transform: translate(-50%,-50%);
  }
</style>
`;
}

// 生成 html 标签
function createHTML() {
  const fastBtn = isLogin
    ? `<span class="abtn" id="fill-input">快速填充</span>`
    : '<span class="abtn" id="clear-ck">清空登陆</span>';
  return `
<div id="cus-mask" style="display: none">
  <div class="cus-mask_view">
    <div class="cus-view">
      ${isLogin ? 'BoxJS 京东 ck 列表' : '切换 BoxJS 其他账号'}
    </div>
    <div class="cus-content">
       <label>ck 选择列表：</label>
        <select id="jd_account">
            <option value="">------请选择------</option>
            ${options}
        </select>
        <ul>
            <li>请查看BoxJS是否订阅 <a style="color: #f7bb10" href="https://raw.githubusercontent.com/dompling/Script/master/dompling.boxjs.json">Dompling</a></li>
            <li>该脚本配合【<a href="javascript:viod(0);" onclick="window.location.href='http://boxjs.net/#/app/JD_Cookies_remark'" style="color: #f7bb10">京东账号 CK 检索</a>】使用</li>
            <li>若想更新 ck，可以在检索中设置【未登录】条件，然后使用页面的快速填充功能</li>
        </ul>
    </div>
    <div class="cus-footer">
        <div class="btn-wrap" style="display: flex">
          <span class="abtn" id="cus-mask-cancel">
              取消
          </span>
          ${fastBtn}
          <span class="abtn btn-ok" id="cus-mask-ok" >
              ${isLogin ? '直接登录' : '切换账号'}
          </span>
        </div>
    </div>
  </div>
</div>
<div id="cus-tip" style="display: none;"></div>

<div class="tool_bars">
  <div id="boxjs" class="tool_bar">
   <img src="https://raw.githubusercontent.com/chavyleung/scripts/master/BOXJS.png" />
  </div>
  <div id="copyCk" class="tool_bar"><span>Ck</span></div>
</div>

  `;
}

// 生成脚本标签
function createScript() {
  return `
<script>
    var pk = getCookie("pt_key");
    var pp = getCookie("pt_pin");
    const head = document.getElementsByTagName("head")[0];
    head.insertAdjacentHTML('beforeEnd', '<meta name="viewport" content="width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no" />');
    const jd_ck=${JSON.stringify(cookiesRemark)};
    const boxjs_btn = document.querySelector("#boxjs");
    const fill_btn = document.querySelector("#fill-input");
    const copyCk_btn = document.querySelector("#copyCk");
    const cancel_btn = document.querySelector("#cus-mask-cancel");
    const ok_btn = document.querySelector("#cus-mask-ok");
    const clear_btn = document.querySelector("#clear-ck");
    const tip_view = document.querySelector("#cus-tip");

    boxjs_btn.addEventListener('click', function(){
      maskVisible(true);
    });

    cancel_btn.addEventListener('click', function(){
      maskVisible(false);
    });

    ok_btn.addEventListener('click', function(){
      btnSubmit();
    });


    copyCk_btn.addEventListener('click',function(){
      copyToClip();
    })

    if(pk === "" || !pk)copyCk_btn.style.display="none";

    if(clear_btn){
      clear_btn.addEventListener('click',function(){
         sessionStorage.clear();
         localStorage.clear();
         setCookie('pt_key',"");
         setCookie("pt_pin","");
         window.location.reload();
      })
    }

    if(fill_btn){
      fill_btn.addEventListener('click',function(){
        fillInput();
      });
    }

    function toast(message,time= 2000){
       tip_view.style.display = "block";
       tip_view.innerHTML = message;
       setTimeout(function() {
         tip_view.style.display = "none";
          tip_view.innerHTML = "";
       },parseInt(time || "2000"));
    }

    function maskVisible(visible){
      const cusmsk = document.getElementById("cus-mask");
      cusmsk.style.display = visible? "block" : "none";
    }

    function fillInput(){
      const cuMobile = document.getElementById('jd_account').value;
      console.log('快速填充号码：'+ cuMobile);
      const input = document.getElementsByClassName('acc-input mobile J_ping')[0];
      input.value = cuMobile;
      ev = document.createEvent("HTMLEvents");
      ev.initEvent("input", true,false );
      input.dispatchEvent(ev);
      maskVisible(false);
    }

    function clearAllCookie() {
        var keys = document.cookie.match(/[^ =;]+(?=\\=)/g);
        if (keys) {
            for (var i = keys.length; i--;){
              document.cookie = keys[i] + '=;expires=' + new Date(0).toUTCString()
            }
        }
    }

   function btnSubmit(){
    const cuMobile = document.getElementById('jd_account').value;
    if(!cuMobile) return alert("请选择需要登陆的账号");
    const login_ck = jd_ck.find(item=>item.mobile===cuMobile);
    if(!login_ck) return alert("未找到相关账号");
    let [ pt_key , pt_pin ] = login_ck.cookie.split(";");
    pt_key = pt_key.split("=");
    pt_pin = pt_pin.split("=");
    clearAllCookie();
    setCookie(pt_key[0],pt_key[1]);
    setCookie(pt_pin[0],pt_pin[1]);
    window.location.reload();
  }
  function setCookie(cname,cvalue){
      var ed = new Date();
      const mt = ed.getMonth()+1;
      ed.setMonth(mt);
      var expires = "expires="+ed.toGMTString();
      document.cookie = cname+"="+cvalue+"; "+expires+"; path=/; domain=.jingxi.com";
      document.cookie = cname+"="+cvalue+"; "+expires+"; path=/; domain=.jd.com";
  }
  function getQueryVariable(variable){
     var query = window.location.search.substring(1);
     var vars = query.split("&");
     for (var i=0;i<vars.length;i++) {
             var pair = vars[i].split("=");
             if(pair[0] == variable){return pair[1];}
     }
     return(false);
  }
  function getCookie(cname){
      var name = cname + "=";
      var ca = document.cookie.split(';');
      for(var i=0; i<ca.length; i++) {
          var c = ca[i].trim();
          if (c.indexOf(name)==0) { return c.substring(name.length,c.length); }
      }
      return "";
  }
  function copyToClip(){
    const _input = document.createElement('input');
    _input.style.width="1px";
    _input.style.height="1px";
    _input.style.position="fixed";
    _input.style.right="-1px";
    document.body.prepend(_input);
    _input.value = "pt_key="+pk+";pt_pin="+pp;
    _input.focus();
    _input.select();
    document.execCommand('copy');
    _input.blur();
    document.body.removeChild(_input);
    toast('复制成功');
  }
</script>
  `;
}

const infuseStyles = createStyle();
const infuseScript = createScript();
const infuseHTML = createHTML();

function getInfuse() {
  return isJS
    ? `
const bodyELem = document.body;
bodyELem.insertAdjacentHTML('beforeEnd', \`${infuseStyles}\`);
bodyELem.insertAdjacentHTML('beforeEnd', \`${infuseHTML}\`);
${infuseScript.replace('<script>', '').replace('</script>', '')}
`
    : `
${infuseStyles}
${infuseHTML}
${infuseScript}
`;
}

const infuseText = getInfuse();
try {
  $.html = isJS
    ? $.html + `\n${infuseText}`
    : $.html.replace(/(<\/html>)/, `${infuseText} </html>`);
} catch (e) {
  console.log(e);
}

$.headers = { ...$.headers, 'Cache-Control': 'no-cache' };

$.done({ body: $.html, headers: $.headers });

function ENV() {
  const isQX = typeof $task !== 'undefined';
  const isLoon = typeof $loon !== 'undefined';
  const isSurge = typeof $httpClient !== 'undefined' && !isLoon;
  const isJSBox = typeof require == 'function' && typeof $jsbox != 'undefined';
  const isNode = typeof require == 'function' && !isJSBox;
  const isRequest = typeof $request !== 'undefined';
  const isScriptable = typeof importModule !== 'undefined';
  return {
    isQX,
    isLoon,
    isSurge,
    isNode,
    isJSBox,
    isRequest,
    isScriptable,
  };
}

function HTTP(defaultOptions = { baseURL: '' }) {
  const { isQX, isLoon, isSurge, isScriptable, isNode } = ENV();
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'];
  const URL_REGEX =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

  function send(method, options) {
    options =
      typeof options === 'string'
        ? {
            url: options,
          }
        : options;
    const baseURL = defaultOptions.baseURL;
    if (baseURL && !URL_REGEX.test(options.url || '')) {
      options.url = baseURL ? baseURL + options.url : options.url;
    }
    if (options.body && options.headers && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    options = {
      ...defaultOptions,
      ...options,
    };
    const timeout = options.timeout;
    const events = {
      ...{
        onRequest: () => {},
        onResponse: (resp) => resp,
        onTimeout: () => {},
      },
      ...options.events,
    };

    events.onRequest(method, options);

    let worker;
    if (isQX) {
      worker = $task.fetch({
        method,
        ...options,
      });
    } else if (isLoon || isSurge || isNode) {
      worker = new Promise((resolve, reject) => {
        const request = isNode ? require('request') : $httpClient;
        request[method.toLowerCase()](options, (err, response, body) => {
          if (err) reject(err);
          else
            resolve({
              statusCode: response.status || response.statusCode,
              headers: response.headers,
              body,
            });
        });
      });
    } else if (isScriptable) {
      const request = new Request(options.url);
      request.method = method;
      request.headers = options.headers;
      request.body = options.body;
      worker = new Promise((resolve, reject) => {
        request
          .loadString()
          .then((body) => {
            resolve({
              statusCode: request.response.statusCode,
              headers: request.response.headers,
              body,
            });
          })
          .catch((err) => reject(err));
      });
    }

    let timeoutid;
    const timer = timeout
      ? new Promise((_, reject) => {
          timeoutid = setTimeout(() => {
            events.onTimeout();
            return reject(
              `${method} URL: ${options.url} exceeds the timeout ${timeout} ms`
            );
          }, timeout);
        })
      : null;

    return (
      timer
        ? Promise.race([timer, worker]).then((res) => {
            clearTimeout(timeoutid);
            return res;
          })
        : worker
    ).then((resp) => events.onResponse(resp));
  }

  const http = {};
  methods.forEach(
    (method) =>
      (http[method.toLowerCase()] = (options) => send(method, options))
  );
  return http;
}

function API(name = 'untitled', debug = false) {
  const { isQX, isLoon, isSurge, isNode, isJSBox, isScriptable } = ENV();
  return new (class {
    constructor(name, debug) {
      this.name = name;
      this.debug = debug;

      this.http = HTTP();
      this.env = ENV();

      this.node = (() => {
        if (isNode) {
          const fs = require('fs');

          return {
            fs,
          };
        } else {
          return null;
        }
      })();
      this.initCache();

      const delay = (t, v) =>
        new Promise(function (resolve) {
          setTimeout(resolve.bind(null, v), t);
        });

      Promise.prototype.delay = function (t) {
        return this.then(function (v) {
          return delay(t, v);
        });
      };
    }

    // persistence
    // initialize cache
    initCache() {
      if (isQX) this.cache = JSON.parse($prefs.valueForKey(this.name) || '{}');
      if (isLoon || isSurge)
        this.cache = JSON.parse($persistentStore.read(this.name) || '{}');

      if (isNode) {
        // create a json for root cache
        let fpath = 'root.json';
        if (!this.node.fs.existsSync(fpath)) {
          this.node.fs.writeFileSync(
            fpath,
            JSON.stringify({}),
            {
              flag: 'wx',
            },
            (err) => console.log(err)
          );
        }
        this.root = {};

        // create a json file with the given name if not exists
        fpath = `${this.name}.json`;
        if (!this.node.fs.existsSync(fpath)) {
          this.node.fs.writeFileSync(
            fpath,
            JSON.stringify({}),
            {
              flag: 'wx',
            },
            (err) => console.log(err)
          );
          this.cache = {};
        } else {
          this.cache = JSON.parse(
            this.node.fs.readFileSync(`${this.name}.json`)
          );
        }
      }
    }

    // store cache
    persistCache() {
      const data = JSON.stringify(this.cache, null, 2);
      if (isQX) $prefs.setValueForKey(data, this.name);
      if (isLoon || isSurge) $persistentStore.write(data, this.name);
      if (isNode) {
        this.node.fs.writeFileSync(
          `${this.name}.json`,
          data,
          {
            flag: 'w',
          },
          (err) => console.log(err)
        );
        this.node.fs.writeFileSync(
          'root.json',
          JSON.stringify(this.root, null, 2),
          {
            flag: 'w',
          },
          (err) => console.log(err)
        );
      }
    }

    write(data, key) {
      this.log(`SET ${key}`);
      if (key.indexOf('#') !== -1) {
        key = key.substr(1);
        if (isSurge || isLoon) {
          return $persistentStore.write(data, key);
        }
        if (isQX) {
          return $prefs.setValueForKey(data, key);
        }
        if (isNode) {
          this.root[key] = data;
        }
      } else {
        this.cache[key] = data;
      }
      this.persistCache();
    }

    read(key) {
      this.log(`READ ${key}`);
      if (key.indexOf('#') !== -1) {
        key = key.substr(1);
        if (isSurge || isLoon) {
          return $persistentStore.read(key);
        }
        if (isQX) {
          return $prefs.valueForKey(key);
        }
        if (isNode) {
          return this.root[key];
        }
      } else {
        return this.cache[key];
      }
    }

    delete(key) {
      this.log(`DELETE ${key}`);
      if (key.indexOf('#') !== -1) {
        key = key.substr(1);
        if (isSurge || isLoon) {
          return $persistentStore.write(null, key);
        }
        if (isQX) {
          return $prefs.removeValueForKey(key);
        }
        if (isNode) {
          delete this.root[key];
        }
      } else {
        delete this.cache[key];
      }
      this.persistCache();
    }

    // notification
    notify(title, subtitle = '', content = '', options = {}) {
      const openURL = options['open-url'];
      const mediaURL = options['media-url'];

      if (isQX) $notify(title, subtitle, content, options);
      if (isSurge) {
        $notification.post(
          title,
          subtitle,
          content + `${mediaURL ? '\n多媒体:' + mediaURL : ''}`,
          {
            url: openURL,
          }
        );
      }
      if (isLoon) {
        let opts = {};
        if (openURL) opts['openUrl'] = openURL;
        if (mediaURL) opts['mediaUrl'] = mediaURL;
        if (JSON.stringify(opts) === '{}') {
          $notification.post(title, subtitle, content);
        } else {
          $notification.post(title, subtitle, content, opts);
        }
      }
      if (isNode || isScriptable) {
        const content_ =
          content +
          (openURL ? `\n点击跳转: ${openURL}` : '') +
          (mediaURL ? `\n多媒体: ${mediaURL}` : '');
        if (isJSBox) {
          const push = require('push');
          push.schedule({
            title: title,
            body: (subtitle ? subtitle + '\n' : '') + content_,
          });
        } else {
          console.log(`${title}\n${subtitle}\n${content_}\n\n`);
        }
      }
    }

    // other helper functions
    log(msg) {
      if (this.debug) console.log(`[${this.name}] LOG: ${this.stringify(msg)}`);
    }

    info(msg) {
      console.log(`[${this.name}] INFO: ${this.stringify(msg)}`);
    }

    error(msg) {
      console.log(`[${this.name}] ERROR: ${this.stringify(msg)}`);
    }

    wait(millisec) {
      return new Promise((resolve) => setTimeout(resolve, millisec));
    }

    done(value = {}) {
      if (isQX || isLoon || isSurge) {
        $done(value);
      } else if (isNode && !isJSBox) {
        if (typeof $context !== 'undefined') {
          $context.headers = value.headers;
          $context.statusCode = value.statusCode;
          $context.body = value.body;
        }
      }
    }

    stringify(obj_or_str) {
      if (typeof obj_or_str === 'string' || obj_or_str instanceof String)
        return obj_or_str;
      else
        try {
          return JSON.stringify(obj_or_str, null, 2);
        } catch (err) {
          return '[object Object]';
        }
    }
  })(name, debug);
}
