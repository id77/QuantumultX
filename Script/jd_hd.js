/* 
打开活动页面自动注入console，需要手动执行脚本

[rewrite_local]

https?://plogin.m.jd.com/cgi-bin/mm/domlogin url script-response-header https://raw.githubusercontent.com/id77/QuantumultX/master/Script/unHttpOnly.js
https://jdqd.jd.com/poststring url reject

# web切换jd cookie

^https?:\/\/.{0,27}\.?jd\.(com|hk)\/?((?!\.(js|json|jpg|gif|png|webp|dpg|flv|mp3|mp4)).)*$ url script-response-body https://raw.githubusercontent.com/id77/QuantumultX/master/Script/jd_hd.js
^https?:\/\/.*\.jingxi\.com\/?((?!\.(js|json|jpg|gif|png|flv|mp3|mp4)).)*$ url script-response-body https://raw.githubusercontent.com/id77/QuantumultX/master/Script/jd_hd.js

# 京东活动
https?://.*\.isvjcloud\.com url script-response-body https://raw.githubusercontent.com/id77/QuantumultX/master/Script/jd_hd.js
https?://.*\.moxigame\.cn url script-response-body https://raw.githubusercontent.com/id77/QuantumultX/master/Script/jd_hd.js

[mitm]
hostname = -lite-msg.m.jd.com, -jdcs.m.jd.com, -ddms.jd.com, -redpoint-msg.m.jd.com, -msjdpay.jd.com, -payfinish.jd.com, -payfinish.m.jd.com, *.jd.com, *.*.jd.com ,*.jd.hk, *.*.jd.hk, *.moxigame.cn
*/

const $ = new Env('京东助手', { noLog: true });
$.domain = $request.url.match(/https?:\/\/([^\/]+)/)[1];
$.JDDomain = ['jd.com', 'jd.hk', 'jingxi.com'];
$.isJD = false;
$.seckill = false;

if ($request.url.includes('/seckill')) {
  // $.seckill = true;
}

let notCache = $.getData('id77_notCache') == 1 || false;
let toolSwitch = $.getData('id77_tools_switch');
const clicker_off_zIndex = $.getData('id77_clicker_off_zIndex') || 10001;
const clicker_frequency = $.getData('id77_clicker_frequency') || 10;
const click_interval = $.getData('id77_click_interval') || 100;
const ocrApi = $.getData('id77_ocr_api'); // 验证码识别API地址
const ocrPath = $.getData('id77_ocr_path') || '/api/ocr'; // 验证码识别API地址
const ocrRules = JSON.parse($.getData('id77_ocr_rules') || '[]'); // 自定义验证码规则
let urlSku;
const skuCache = $.getData('id77_JDSkuId_Cache');
const msgOpts = JSON.parse($.getData('id77_JDMsgOpts_Cache') || '{}');
let urlMatchArr = [];
if ($request.url.includes('graphext/draw')) {
  urlMatchArr = $request.url.match(/sku=(\d+)/);
  appType = 'jdpingou';
} else if ($request.url.includes('wqsitem.jd.com/detail')) {
  urlMatchArr = $request.url.match(/wqsitem\.jd\.com\/detail\/(\d+)_/);
} else {
  urlMatchArr = $request.url.match(/\/.*\/(\d+)\.html/);
}
if (urlMatchArr?.length) {
  urlSku = urlMatchArr[1];
  // setTimeout(() => {}, 300);
}
$.needReload = $.getData('id77_needReloadStatusCode')
  ?.split('@')
  ?.map((item) => Number(item))
  ?.includes($response.statusCode);

$.hideDomClass = $.getData('id77_hideDomClass');

$.JDDomain.forEach((item) => {
  if ($.domain.includes(item)) {
    $.isJD = true;
  }
});

function randomInteger(min, max) {
  // now rand is from  (min-0.5) to (max+0.5)
  let rand = min - 0.5 + Math.random() * (max - min + 1);
  return Math.round(rand);
}

let prefix = randomInteger(777, 7777);

let html = $response.body || '';

// console.log(`html:${html}`);
let modifiedHeaders = { ...$response.headers };
if (modifiedHeaders['Content-Security-Policy'])
  delete modifiedHeaders['Content-Security-Policy'];
if (modifiedHeaders['content-security-policy'])
  delete modifiedHeaders['content-security-policy'];
if (modifiedHeaders['X-XSS-Protection'])
  delete modifiedHeaders['X-XSS-Protection'];
if (modifiedHeaders['x-xss-protection'])
  delete modifiedHeaders['x-xss-protection'];

let key = 'Set-Cookie';
let cookies = $response.headers[key];
if (!cookies) {
  key = 'set-cookie';
  cookies = $response.headers[key];
}
if (cookies) {
  cookies = cookies
    .replace(/HttpOnly/gi, '')
    .replace(/(Expires=.+?),/gi, '$1@')
    .split(', ');

  let _key = key;
  cookies.forEach((ck, i) => {
    // 利用空格设置多个 set-cookie
    _key += ' ';
    modifiedHeaders[_key] = ck.replace(/@/g, ',');
  });
}

if (notCache) {
  modifiedHeaders['Cache-Control'] = 'no-cache';
  modifiedHeaders[' Cache-Control'] = 'private';
}

if (!html.includes('</head>')) {
  $.done({ headers: modifiedHeaders });
}

const charset = (
  $response?.body?.match(/charset=("|')(.+?)("|')/)?.[2] || ''
)?.toLowerCase();

const contentType =
  modifiedHeaders['Content-Type'] || modifiedHeaders['content-type'] || '';
// 避免修改内容后 原gb2312乱码，另外需要删除html的mete
if (
  charset &&
  !/utf\-?8/.test(charset) &&
  !/utf\-?8/.test(contentType.toLowerCase()) &&
  $response.bodyBytes
) {
  // console.log($.toStr($response.bodyBytes));
  console.log(`html编码：${charset}\nContent-Type：${contentType}`);
  const decoder = new TextDecoder(charset);
  const bytes = new Uint8Array($response.bodyBytes);
  const text = decoder.decode(bytes);

  if (/div/.test(text)) html = text;

  // console.log(`test: ${/div/.test(text)}`);
  // console.log(html);
}

html = html.replace(/<!--[\s\S]*?-->/g, '');

// 去除html原有vconsole script标签
html = html.replace(/<script[^<]*vconsole(\.min)?\.js.*?<\/script>/gi, '');

// 提前点亮
if (
  $request.url.includes('.com/coupons/show.action') &&
  /"status":\d+,"togo/.test(html)
) {
  html = html.replace(/"status":\d+,"togo/, '"status":999,"togo');
}
if ($request.url.includes('.com/mall/active/') && /,"status":"\d"/.test(html)) {
  html = html.replace(/,"status":"\d"/g, ',"status":"0"');

  if (
    html.includes('hour_coupon_empty_in_this_time') ||
    html.includes('coupon_empty')
  ) {
    html = html.replace(
      /hour_coupon_empty_in_this_time|coupon_empty/g,
      'coupon_receive',
    );
  }
}

html = html.replace(
  /id="poster_status"\s+type="hidden"\s+value="0"/g,
  'id="poster_status" type="hidden" value="1"',
);

html = html.replace(/("|')render("|'):false/g, '$1render$2:true');

html = html.replace(/11:30:00/g, `00:00:00`);
html = html.replace(/10:00:00/g, `00:00:00`);

html = html.replace(/id="submitBtna"/g, `id="submitBtn"`);

// jd无货变有货
if (
  !/"StockState":33|"StockState":39|"StockState":40|"StockState":36/.test(html)
) {
  html = html.replace(/"StockState":\d+/g, '"StockState":33');
}

if ($request.url.includes('lovemojit')) {
  if (/ grey-btn/g.test(html)) {
    html = html.replace(
      / (data-task="[^"]+")/g,
      ' data-index="1" $1 data-method="get"',
    );
  }
  html = html.replace(/ over-btn/g, '');
  html = html.replace(/ grey-btn/g, ' get-btn');
}

// 去除input只能相机
html = html.replace(/capture=?/g, '');

html = html.replace(
  /opendate=\d+;openhours=\d+;gifthours=\d+/g,
  `opendate=${new Date().getDate()};openhours=0;gifthours=0`,
);
html = html.replace(/btn_yqw disable/g, `btn_q`);

if ($request.url.includes('/sqb.html')) {
  html = html.replace(/"status":\d,/, '"status":2,');
  html = html.replace(
    /"startTime":"\d{4}-\d{2}-\d{2} \d{2}:\d{2}",/,
    '"startTime":"2026-02-06 00:00",',
  );
  html = html.replace(/"\$startTime":\d+,/, '"$startTime":1770307200000,');
}
if ($request.url.includes('m=yunc_ticket&')) {
  html = html.replace(/gps:0,/, 'gps:1,');
  html = html.replace(/\(isMatch\)/, '(true)');
  html = html.replace(/opg:"1"/, 'opg:"0"');
  html = html.replace(/"open2":\d+/g, '"open2":0');
}

const couponId = html.match(/"batchId":"(\d+)"/)?.[1];

try {
  let cookies = [];
  $.getData('CookieJD') && cookies.push($.getData('CookieJD'));
  $.getData('CookieJD2') && cookies.push($.getData('CookieJD2'));

  const extraCookies = JSON.parse($.getData('CookiesJD') || '[]').map(
    (item) => item.cookie,
  );

  if ($.isJD) {
    cookies = Array.from(new Set([...cookies, ...extraCookies]));
  }

  let url = $request.url.replace(/&un_area=[\d_]+/g, '');
  let sku;
  let arr = [];
  if (/sku=\d+/.test(url)) {
    arr = url.match(/sku=(\d+)/);
  }
  if (/wareId=\d+/.test(url)) {
    arr = url.match(/wareId=(\d+)/);
  }
  if (/\/product(?:[\/\w]+)?\/(\d+)\.html/.test(url)) {
    arr = url.match(/\/.*\/(\d+)\.html/);
  }

  sku = arr.length != 0 ? arr[1] : '';

  const vx77 =
    url.includes('getcoupon') &&
    html.includes('handleCard') &&
    html.includes('jssdk');

  let cookieListDom = `<ul class="cks">`;

  // const isJD = url.includes('jd.com') || url.includes('jingxi.com');
  if (cookies.length > 0) {
    for (let index = 0; index < cookies.length; index++) {
      const cookie = cookies[index];
      const pin = decodeURI(cookie.match(/pt_pin=(.+?);/)[1]);
      cookieListDom += `<li data-cookie-index="${
        index + 1
      }" id="_${pin}" class="_${prefix}_id77_cookieDom" onclick="_${prefix}_id77_changeCookie('${cookie}')">${pin}</li>`;
    }
  }
  cookieListDom += `</ul>`;

  let tools = ``;
  tools =
    `
    <div id="_${prefix}_id77_btns">
      <div id="_${prefix}_top">
        <div id="cks" class="_${prefix}_id77_btn _${prefix}_id77_hide"></div>
        <div id="nextCookie" class="_${prefix}_id77_btn _${prefix}_id77_hide"></div>
        ` +
    `</div><div id="_${prefix}_bottom"><div id="clicker" class="_${prefix}_id77_btn _${prefix}_id77_hide"></div><div id="open_url" class="_${prefix}_id77_btn _${prefix}_id77_hide"></div>` +
    `<div id="reload" class="_${prefix}_id77_btn _${prefix}_id77_hide" onclick="location.reload()"></div>` +
    `<div id="id77_clear" class="_${prefix}_id77_btn _${prefix}_id77_hide" onclick="_${prefix}_id77_clearData()"></div></div></div>`;

  let copyObject = `<script ignore>
    // 复制一份
    if(window.localStorage) {
      window.localStorageCopy = window.localStorage
    }
    if(window.sessionStorage) {
      window.sessionStorageCopy = window.sessionStorage
    }
    const _${prefix}_id77_Map = Map;
  </script>`;

  let clickerDom = `<div id="id77_clicker" style="position: fixed; bottom: 0; width: 100%; display: none;">
    <div
      class="id77_clicker_header"
      style="
        background: #f2f2f2;
        padding: 10px;
        text-align: center;
        font-weight: bold;
        border-top: 1px solid #c5c5c5;
        border-bottom: 1px solid #c5c5c5;
        border-radius: 5px 5px 0 0;
      "
    >
      Id77 Clicker
    </div>
    <div
      class="id77_clicker_close"
      style="
        position: absolute;
        top: 0px;
        text-align: center;
        padding: 10px;
        right: 0;
        font-weight: bold;
        color: #2e85ed;
      "
    >
      完成
    </div>
    <div class="id77_clicker_main">
      <div class="id77_clicker_add">+</div>
      <div style="overflow: hidden">
        <p>频率（每秒点击次数）</p>
        <input type="number" id="id77_clicker_frequency_text" value="${clicker_frequency}"/>
        <input
          type="range"
          id="id77_clicker_frequency"
          name="volume"
          value="${clicker_frequency}"
          min="1"
          max="60"
        />
      </div>
      <div style="overflow: hidden">
        <p>结束条件</p>
        <input id="id77_clicker_conditionValue" value="86400" type="number" />
        <select id="id77_clicker_condition" name="type">
          <option selected="selected" value="time">持续时间(秒)</option>
          <option value="count">总次数</option>
        </select>
      </div>
      <div id="id77_timer" style="overflow: hidden">
        <p>定时执行</p>
        <input
          class="id77_float"
          type="checkbox"
          id="id77_clicker_timerFlag"
          name="timer"
        />
        <label class="id77_float" for="id77_clicker_timerFlag"
          >启用定时器</label
        >
        <input class="id77_float" id="id77_clicker_timerTime" type="time" />
        <input
          id="id77_clicker_timerBeforehandTime"
          class="id77_float"
          type="number"
          placeholder="可提前0-1000"
          min="0"
          max="1000"
          value="70"
        />
      </div>
      <div>
        <p>坐标系</p>
        <input
          type="radio"
          id="coordinate1"
          name="coordinate"
          value="1"
          checked
        />
        <label for="coordinate1">局部</label>
        <input type="radio" id="coordinate2" name="coordinate" value="2" />
        <label for="coordinate2">全局</label>
      </div>
    </div>
  </div>`;

  let scriptDoms = `<script ignore>
    (function() {
      window.VConsole = undefined;
      window.vConsole = undefined;
      window._${prefix}_id77_init_called = false;

      function safeInitVConsole() {
        if (window.VConsole && !window.vConsole) {
          // window.vConsole = new window.VConsole();
          if (typeof window._${prefix}_id77_init === 'function' && !window._${prefix}_id77_init_called) {
            window._${prefix}_id77_init();
            window._${prefix}_id77_init_called = true;
          }
        } else if (!window.VConsole) {
          // 等待vConsole脚本加载
          setTimeout(safeInitVConsole, 100);
        }
      }

      function injectVConsole() {
        if (!window.vConsole && !window.VConsole) {
          var script = document.createElement('script');
          script.src = 'https://unpkg.com/vconsole@3.14.7/dist/vconsole.min.js?v=id77';
          script.onload = safeInitVConsole;
          if (document.body) {
            document.body.appendChild(script);
          } else {
            window.addEventListener('DOMContentLoaded', function() {
              document.body.appendChild(script);
            });
          }
        } else {
          safeInitVConsole();
        }
      }

      injectVConsole();

      window.addEventListener('hashchange', function() {
        if (window.vConsole && window.vConsole.destroy) {
          window.vConsole.destroy();
          window.vConsole = null;
        }
        window._${prefix}_id77_init_called = false;
        setTimeout(injectVConsole, 300);
      });
    })();
  </script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/js-cookie/3.0.5/js.cookie.min.js?v=id77" ignore></script>`;

  // 创建验证码识别器函数
  function createCaptchaRecognizer(ocrPath, ocrRules) {
    const ocrRule =
      ocrRules.filter(
        (rule) => rule?.domain && $.domain.includes(rule?.domain),
      )?.[0] || null;
    return `<script ignore>
    // 验证码识别器
    (function() {
      // 只有配置了API URL才启用OCR功能
      const ocrPath = "${ocrPath}";
      if (!ocrPath) return;

      // 验证码识别器类
      class _${prefix}_id77_CaptchaRecognizer {
        constructor(options = {}) {
          this.options = Object.assign({
            ocrPath: ocrPath,
            ocrRule: ${JSON.stringify(ocrRule)},
            captchaSelectors: [
              'img[src*="captcha"]',
              'img[src*="verify"]',
              'img[alt*="验证码"]',
              'img[title*="验证码"]',
              'img[alt*="captcha"]',
              'img[id="captchaPic"]',
              '.validate-code img',
              'img[style="z-index: 2; position: absolute; bottom: -11px; left: 206px; width: 88px; height: 40px;"]',
              '.authcode img[id="authImage"]',
              'img[class="verification-img"]',
              'img[class*="verification"]',
              'img[name="imgCaptcha"]',
              'img[src*="code" i]',
              'div[class*=captcha] img',
              'img[data-role="captcha"]',
              'img[id*="captcha"]',
              'img[id*="verify"]',
              'img[class*="captcha"]',
              'img[src*="checkcode"]',
              'img[src*="seccode"]',
              '.valid-img img',
              '.verifyimg',
              '.security-code-img',
              '.captcha-container img',
              '.yanzhengma img',
              'img[data-type="captcha"]',
              'img.verifyimg',
              'img.captcha',
            ],
            inputSelectors: [
              "input[name*='captcha']",
              "input[name*='verify']",
              "input[id='authcode']",
              "input[placeholder*='验证码']:not([placeholder*='短信'])",
              "input[placeholder*='captcha']",
              "input[id*='captcha']",
              "input[id*='verify']",
              "input[class*='captcha']",
              "input[class*='verify']",
              "input[placeholder*='校验码']",
              "input[placeholder*='图形验证码']",
              "input[name*='authcode']",
              "input[name*='code']",
              "input[id*='code'][maxlength]",
              "input[aria-label*='验证码']",
              "input[data-type='captcha']",
              "input.captcha-input",
              "input.verify-input",
              "input.code-input",
              ".captcha-field input",
              ".verify-code input",
              ".auth-code input",
              ".validate-field input"
            ],
            autoRecognize: true,
            autoFill: true,
            copyToClipboard: true,
            debug: true
          }, options);

          this.captchaObserver = null;
          this.recognizing = false;
          this.lastRecognized = null;
          this._lastRecognizedText = null; // 最后识别的文本，用于手动复制
          this._hasInputField = false; // 是否找到了输入框
          this._srcChangeTimeout = null; // src变化防抖超时器
          
          this.addCaptchaButton();
          this.log("验证码识别器已初始化");

          // 设置图片点击事件监听
          this.setupImageClickListener();

          // 设置短信验证码重复填入检测
          this.setupSMSCodeDuplicateDetection();

          if (this.options.autoRecognize) {
            this.setupObserver();
            this.findAndRecognize();
          }
          
          
          // 添加页面卸载事件清理
          window.addEventListener('beforeunload', () => this.cleanup());

          // 监听单页面应用路由变化
          this.setupRouteObserver();

          // 超过2分钟，且没有验证码元素缓存，清理监听
          setInterval(() => {
            if (!this.captchaObserver) return;
            if (this._cachedImgs?.length > 0) return;
            if (Date.now() - (this._lastImgSearchTime || 0) > 120000) {
              this.log("超过2分钟没有检测到验证码图片，清理监听器");
              this.cleanup();
            }
          }, 60000);

          
        }
        
        // 设置图片点击事件监听
        setupImageClickListener() {
          this.log("设置图片点击事件监听");
          
          // 存储被监听的图片和它们的原始src
          this._monitoredImages = new Map();
          this._clickedImage = null; // 当前被点击的图片
          
          // 使用事件委托监听所有点击事件
          document.addEventListener('click', (event) => {
            if (event.target.tagName === 'IMG') {
              this.handleImageClick(event.target);
            } else {
              // 点击非图片元素时，清理验证码图片监听状态
              // this.handleNonImageClick();
            }
          }, true); // 使用捕获阶段确保能监听到事件
        }
        
        // 设置短信验证码重复填入检测
        setupSMSCodeDuplicateDetection() {
          this.log("设置短信验证码重复填入检测");
          
          // 监听所有输入框的input事件
          document.addEventListener('input', (event) => {
            const input = event.target;
            if (input.tagName !== 'INPUT') return;
            
            const value = input.value;
            console.log(\`输入框变化检测: \${value}\`);
            if (!value || value.length <= 6) return;
            
            // 只检查8位或12位的情况（常见的重复）
            if (value.length === 8 || value.length === 12) {
              // 检查是否是纯数字
              if (/^\\d+$/.test(value)) {
              
                const halfLength = value.length / 2;
                const firstHalf = value.substring(0, halfLength);
                const secondHalf = value.substring(halfLength);
                
                // 如果前半部分和后半部分相同，保留前半部分
                if (firstHalf === secondHalf) {
                  this.log("检测到重复短信验证码: " + value + " -> " + firstHalf);
                  
                  // 修正验证码
                  input.value = firstHalf;
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  
                  // 显示修正提示
                  this.showSMSFixNotification(value, firstHalf);
                }
              }
            }
          }, true);
        }
        
        // 显示短信验证码修正提示
        showSMSFixNotification(original, fixed) {
          const notification = document.createElement("div");
          notification.textContent = "已修正重复验证码: " + original + " → " + fixed;
          notification.style.position = "fixed";
          notification.style.bottom = "200px";
          notification.style.right = "10px";
          notification.style.padding = "10px 15px";
          notification.style.backgroundColor = "rgba(255, 152, 0, 0.8)";
          notification.style.color = "white";
          notification.style.borderRadius = "4px";
          notification.style.zIndex = "100000";
          notification.style.fontSize = "14px";
          notification.style.transition = "opacity 0.3s";
          notification.style.maxWidth = "250px";
          notification.style.wordBreak = "break-all";
          
          document.body.appendChild(notification);
          
          // 3秒后淡出并移除
          setTimeout(() => {
            notification.style.opacity = "0";
            setTimeout(() => {
              if (notification.parentNode) {
                document.body.removeChild(notification);
              }
            }, 300);
          }, 3000);
        }
        
        // 处理非图片元素点击事件
        handleNonImageClick() {
          // 如果有被点击的验证码图片正在监听，清理状态
          if (this._clickedImage) {
            this.log("检测到点击非图片元素，清理验证码图片监听状态");
            this.stopMonitoringImage(this._clickedImage);
            this._clickedImage = null;
            
            // 清除防抖超时器
            if (this._srcChangeTimeout) {
              clearTimeout(this._srcChangeTimeout);
              this._srcChangeTimeout = null;
            }
          }
        }
        
        // 处理图片点击事件
        handleImageClick(img) {
          this.log("检测到图片点击: " + (img.src || "无src"));
          
          // 如果图片没有src，跳过
          if (!img.src) return;
          
          // 如果之前有被点击的图片，且不是同一张图片，清理之前的监听状态
          if (this._clickedImage && this._clickedImage !== img && this.recognizing) {
            this.log("检测到点击了新图片，清理之前的监听状态");
            this.stopMonitoringImage(this._clickedImage);
            this._clickedImage = null;
            
            // 清除防抖超时器
            if (this._srcChangeTimeout) {
              clearTimeout(this._srcChangeTimeout);
              this._srcChangeTimeout = null;
            }
          }
          
          // 检查是否是已缓存的验证码图片
          const isCachedCaptcha = this._cachedImgs && this._cachedImgs.includes(img);
          
          if (isCachedCaptcha) {
            this.log("点击的是已缓存的验证码图片，跳过监听避免重复识别");
            // 记录被点击的图片，但不额外监听
            this._clickedImage = img;
            return;
          }
          
          // 记录被点击的图片
          this._clickedImage = img;
          
          // 开始监听该图片的src变化
          this.startMonitoringImage(img);
        }
        
        // 开始监听特定图片的src变化
        startMonitoringImage(img) {
          if (!img || this._monitoredImages.has(img)) return;
          
          const originalSrc = img.src;
          this._monitoredImages.set(img, {
            originalSrc: originalSrc,
            lastSrc: originalSrc,
            observer: null,
            timeoutId: null
          });
          
          this.log("开始监听图片src变化: " + originalSrc);
          
          // 创建专门的观察器监听该图片的src属性变化
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'attributes' && 
                  (mutation.attributeName === 'src' || mutation.attributeName === 'data-src')) {
                this.handleImageSrcChange(img);
              }
            });
          });
          
          // 监听图片的src属性变化
          observer.observe(img, {
            attributes: true,
            attributeFilter: ['src', 'data-src']
          });
          
          // 保存观察器引用
          const monitorData = this._monitoredImages.get(img);
          monitorData.observer = observer;
          
          // 定期检查src变化（作为备选方案）
          const checkInterval = setInterval(() => {
            if (!this._monitoredImages.has(img) || !img.isConnected) {
              clearInterval(checkInterval);
              return;
            }
            
            const currentSrc = img.src;
            const currentMonitorData = this._monitoredImages.get(img);
            
            if (currentSrc !== currentMonitorData.lastSrc) {
              this.handleImageSrcChange(img);
            }
          }, 500);
          
          // 30秒后自动停止监听该图片（防止内存泄漏和长期监听）
          const timeoutId = setTimeout(() => {
            this.log("图片监听超时，自动清理: " + (img.src || "无src"));
            this.stopMonitoringImage(img);
            clearInterval(checkInterval);
            
            // 如果这是当前被点击的图片，也清理点击状态
            if (this._clickedImage === img) {
              this._clickedImage = null;
            }
          }, 30000);
          
          // 保存超时ID
          monitorData.timeoutId = timeoutId;
        }
        
        // 处理图片src变化
        handleImageSrcChange(img) {
          if (!this._monitoredImages.has(img)) return;
          
          const monitorData = this._monitoredImages.get(img);
          const newSrc = img.src;
          
          // 如果src没有实际变化，跳过
          if (newSrc === monitorData.lastSrc) return;
          
          this.log("检测到图片src变化: " + monitorData.lastSrc + " -> " + newSrc);
          
          // 更新记录的src
          monitorData.lastSrc = newSrc;
          
          // 检查是否正在识别中，避免重复识别
          if (this.recognizing) {
            this.log("正在进行其他识别，跳过此次src变化识别");
            return;
          }
          
          // 如果这是被点击的图片，将其作为验证码图片处理
          if (this._clickedImage === img) {
            this.log("被点击的图片src已变化，将其识别为验证码图片");
            
            // 清除当前缓存，强制重新查找
            this._cachedImgs = null;
            
            // 添加防抖机制，避免短时间内多次变化导致重复识别
            if (this._srcChangeTimeout) {
              clearTimeout(this._srcChangeTimeout);
            }
            
            this._srcChangeTimeout = setTimeout(() => {
              // 等待图片加载完成后识别
              if (img.complete) {
                this.recognizeClickedImage(img);
              } else {
                img.onload = () => {
                  this.recognizeClickedImage(img);
                };
                img.onerror = () => {
                  this.log("被点击的图片加载失败");
                };
              }
            }, 300); // 300ms防抖延迟
          }
        }
        
        // 识别被点击的图片
        async recognizeClickedImage(img) {
          if (img.naturalWidth < img.naturalHeight || img.naturalWidth < 70 || img.naturalWidth > 200 || img.naturalHeight < 20 || img.naturalHeight > 100) {
            this.log("被点击的图片尺寸异常，可能不是验证码图片，跳过识别");
            return;
          }

          this.log("开始识别被点击的验证码图片");
          
          try {
            // 直接识别这张图片
            const text = await this.recognizeCaptcha(img);
            if (text) {
              this.log("成功识别被点击的验证码: " + text);
              
              // 识别成功后，停止监听该图片并清理点击状态
              this.stopMonitoringImage(img);
              this._clickedImage = null;
              this.log("验证码识别成功，已清理点击监听状态");
              
              // 尝试自动填充
              if (this.options.autoFill) {
                const filled = this.fillCaptcha(text, [img]);
                this._hasInputField = filled;
              }
              
              // 保存识别结果
              this._lastRecognizedText = text;
              
              // 如果没有找到输入框，显示复制按钮
              if (!this._hasInputField && this._copyButton) {
                this._copyButton.style.display = "block";
              }
              
              // 更新按钮位置
              this.updateCaptchaButtonPosition([img]);
            } else {
              this.log("识别被点击的图片失败，保持监听状态");
            }
          } catch (error) {
            this.log("识别被点击的图片失败: " + error.message + "，保持监听状态");
          }
        }
        
        // 停止监听特定图片
        stopMonitoringImage(img) {
          if (!this._monitoredImages.has(img)) return;
          
          const monitorData = this._monitoredImages.get(img);
          
          // 清理观察器
          if (monitorData.observer) {
            monitorData.observer.disconnect();
          }
          
          // 清理超时器
          if (monitorData.timeoutId) {
            clearTimeout(monitorData.timeoutId);
          }
          
          this._monitoredImages.delete(img);
          this.log("停止监听图片: " + (img.src || "无src"));
        }
        
        // 监听单页面应用的路由变化
        setupRouteObserver() {
          this.log("设置路由变化监听");
          
          // 记录当前URL，用于比较变化
          this._lastUrl = window.location.href;
          
          // 方法1: 监听popstate事件（浏览器前进/后退按钮触发）
          window.addEventListener('popstate', () => {
            this.onRouteChange();
          });
          
          // 方法2: 监听hashchange事件（hash路由模式）
          window.addEventListener('hashchange', () => {
            this.onRouteChange();
          });
          
          // 方法3: 拦截history API（history路由模式）
          const originalPushState = history.pushState;
          const originalReplaceState = history.replaceState;
          const self = this;
          
          history.pushState = function() {
            originalPushState.apply(this, arguments);
            self.onRouteChange();
          };
          
          history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            self.onRouteChange();
          };
          
          // 额外检测URL变化的轮询，以防其他方法失效
          this._urlCheckInterval = setInterval(() => {
            if (window.location.href !== this._lastUrl) {
              this._lastUrl = window.location.href;
              this.onRouteChange();
            }
          }, 1000);
        }
        
        // 路由变化处理
        onRouteChange() {
          this.log("检测到路由变化，重新扫描验证码");
          this._lastUrl = window.location.href;
          
          // 给DOM一些时间来更新
          setTimeout(() => {
            // 清除旧缓存
            this._cachedImgs = null;
            this._cachedInputs = null;
            
            // 清理图片监听
            if (this._monitoredImages) {
              this._monitoredImages.forEach((monitorData, img) => {
                if (monitorData.observer) {
                  monitorData.observer.disconnect();
                }
                if (monitorData.timeoutId) {
                  clearTimeout(monitorData.timeoutId);
                }
              });
              this._monitoredImages.clear();
              this._clickedImage = null;
            }
            
            // 重新设置DOM观察器，以确保能捕获新路由下的验证码元素
            this.setupObserver();
            
            // 等待元素加载后再识别验证码
            setTimeout(() => {
              // 重新扫描并识别验证码
              this.findAndRecognize();
            }, 300);
          }, 500);
        }
        
        // 清理资源
        cleanup() {       
          // 断开DOM观察器
          if (this.captchaObserver) {
            this.captchaObserver.disconnect();
            this.captchaObserver = null;
          }
          
          // 清理图片监听
          if (this._monitoredImages) {
            this._monitoredImages.forEach((monitorData, img) => {
              if (monitorData.observer) {
                monitorData.observer.disconnect();
              }
              if (monitorData.timeoutId) {
                clearTimeout(monitorData.timeoutId);
              }
            });
            this._monitoredImages.clear();
            this._clickedImage = null;
          }
          
          // 清除防抖超时器
          if (this._srcChangeTimeout) {
            clearTimeout(this._srcChangeTimeout);
            this._srcChangeTimeout = null;
          }
          
          // 清除URL检查间隔
          if (this._urlCheckInterval) {
            clearInterval(this._urlCheckInterval);
            this._urlCheckInterval = null;
          }
          
          // 清除缓存数据
          this._cachedImgs = null;
          this._cachedInputs = null;
          this._lastImgSearchTime = null;
          this._lastInputSearchTime = null;
          
          // 重置识别状态
          this.recognizing = false;
        }
        
        log(message) {
          if (this.options.debug) {
            console.log("[验证码识别] " + message);
          }
        }
        
        // 设置DOM观察器，监视验证码图片变化（支持 Shadow DOM）
        setupObserver() {
          // 如果已经存在观察器，先断开连接
          if (this.captchaObserver) {
            this.captchaObserver.disconnect();
            this.captchaObserver = null;
          }
          
          let observerThrottle = false;
          let pendingCheck = false;

          const delayedCheck = (nodes = []) => {
            if (pendingCheck) return;
            pendingCheck = true;

            setTimeout(() => {
              if (this.recognizing && this.lastRecognized) return;
              try {
                
                let captchaImgs = this.findCaptchaImages();

                if (captchaImgs.length === 0 && nodes.length > 0) {
                  for (const node of nodes) {
                    const imgs = this.findCaptchaImages(node);
                    captchaImgs = [...captchaImgs, ...imgs];
                  }
                }
                this.log("延迟检查找到" + captchaImgs.length + "个验证码图片");
                if (captchaImgs.length > 0) {
                  // 检查是否有点击图片正在等待识别，避免冲突
                  if (this._srcChangeTimeout) {
                    this.log("检测到点击图片等待识别，跳过延迟检查的识别");
                    return;
                  }
                  this.findAndRecognize(captchaImgs);
                }
              } catch (e) {
                this.log("延迟检查出错: " + e.message);
              } finally {
                pendingCheck = false;
              }
            }, 1000);
          };

          const callback = (mutations, observer) => {
            this.log("DOM变化检测到");
            if (this.recognizing || observerThrottle) return;

            let needsCheck = false;
            let nodes = [];
            this.log("开始检查验证码图片");

            for (const mutation of mutations) {
              if (mutation.type === "childList") {
                for (const node of mutation.addedNodes) {
                  if (node.nodeName === "IMG") {
                    this.log("检测到新增IMG元素");
                    needsCheck = true;
                    nodes.push(mutation.target.getRootNode());
                    break;
                  }

                  if (node.nodeType === 1) {
                    const imgs = node.querySelectorAll('img');
                    if (imgs.length > 0) {
                      this.log("检测到新增节点中包含IMG元素");
                      needsCheck = true;
                      nodes.push(mutation.target.getRootNode());
                      break;
                    }
                  }

                  // ⚡ 如果新增节点有 Shadow DOM，递归监听
                  if (node.shadowRoot) {
                    this.log("检测到新增 Shadow DOM 节点");
                    this.captchaObserver.observe(node.shadowRoot, {
                      childList: true,
                      subtree: true,
                      attributes: true,
                      attributeFilter: ["src", "data-src"]
                    });
                  }

                  // ⚡ 如果新增子树里有 shadowRoot，也递归进入
                  if (node.querySelectorAll) {
                    node.querySelectorAll("*").forEach(el => {
                      if (el.shadowRoot) {
                        this.log("检测到子树中的 Shadow DOM");
                        this.captchaObserver.observe(el.shadowRoot, {
                          childList: true,
                          subtree: true,
                          attributes: true,
                          attributeFilter: ["src", "data-src"]
                        });
                      }
                    });
                  }
                }
              }

              if (mutation.type === "attributes") {
                if (mutation.target.nodeName === "IMG" &&
                  (mutation.attributeName === "src" ||
                    mutation.attributeName === "data-src")) {
                  this.log("检测到IMG元素的" + mutation.attributeName + "属性变化");
                  needsCheck = true;
                  nodes.push(mutation.target.getRootNode());
                  break;
                }
              }

              if (needsCheck) break;
            }

            if (needsCheck) {
              observerThrottle = true;

              setTimeout(() => {
                try {
                  let captchaImgs = [];
                  if (nodes.length === 0) {
                    captchaImgs = this.findCaptchaImages();
                  } else {
                    for (const node of nodes) {
                      const imgs = this.findCaptchaImages(node);
                      captchaImgs = [...captchaImgs, ...imgs];
                    }
                  }
                  this.log("检测到变化，找到" + captchaImgs.length + "个验证码图片");
                  
                  if (captchaImgs.length > 0) {
                    // 找到验证码图片后，重新设置观察器，只监听这些图片
                    this._cachedImgs = captchaImgs;
                    this._lastImgSearchTime = Date.now();
                    
                    // 如果之前已经有全局监视器，先保存它的引用，然后断开连接
                    const oldGlobalObserver = this.captchaObserver;
                    oldGlobalObserver.disconnect();
                    
                    // 创建新的监听器，只监听验证码图片
                    const targetCallback = (mutations) => {
                      this.log("验证码图片元素发生变化");
                      if (this.recognizing) return;
                      
                      setTimeout(() => {
                        this.findAndRecognize(this._cachedImgs);
                      }, 300);
                    };
                    
                    this.captchaObserver = new MutationObserver(targetCallback);
                    
                    // 为每个验证码图片设置监听
                    captchaImgs.forEach(img => {
                      // 监听图片属性变化
                      this.captchaObserver.observe(img, {
                        attributes: true,
                        attributeFilter: ["src", "data-src"]
                      });
                      
                      // 监听父元素的子节点变化，以防图片被替换
                      if (img.parentElement) {
                        this.captchaObserver.observe(img.parentElement, {
                          childList: true
                        });
                      }
                    });
                    
                    this.log("已切换为仅监听" + captchaImgs.length + "个验证码图片元素");
                    
                    // 首次识别
                    setTimeout(() => {
                      // 检查是否有点击图片正在等待识别，避免冲突
                      if (this._srcChangeTimeout) {
                        this.log("检测到点击图片等待识别，跳过DOM观察器触发的识别");
                        return;
                      }
                      this.findAndRecognize(captchaImgs);
                    }, 300);
                  }

                  const currentDisplay = captchaImgs.length > 0;
                  this._captchaButton.style.display = currentDisplay === "none" ? "flex" : "none";
                } catch (e) {
                  this.log("检查验证码图片出错: " + e.message);
                } finally {
                  // setTimeout(() => {
                  //   observerThrottle = false;
                  //   delayedCheck(nodes);
                  // }, 5000);
                }
              }, 800);
            }
          };

          this.captchaObserver = new MutationObserver(callback);

          // 监听 document.body
          this.captchaObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["src", "data-src"]
          });

          // 递归绑定已有 Shadow DOM
          // 使用更高效的Shadow DOM处理
          const processedShadowRoots = new WeakSet();

          const bindShadow = (root) => {
            // 避免重复处理同一个shadow root
            if (!root || processedShadowRoots.has(root)) return;
            
            // 使用更高效的选择器查询，只查找可能包含shadowRoot的元素
            const potentialShadowHosts = root.querySelectorAll('custom-element, [is], [shadow]');
            potentialShadowHosts.forEach(el => {
              if (el.shadowRoot && !processedShadowRoots.has(el.shadowRoot)) {
                processedShadowRoots.add(el.shadowRoot);
                this.captchaObserver.observe(el.shadowRoot, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  attributeFilter: ["src", "data-src"]
                });
                bindShadow(el.shadowRoot); // 递归处理子阴影根
              }
            });
          };
          bindShadow(document);

          // 页面初次延迟检查
          // setTimeout(delayedCheck, 2000);
        }
        
        // 查找页面中的验证码图片
        // 优化查找逻辑，使用缓存和更高效的选择器
        findCaptchaImages(node) {
          // 缓存最近一次的查询结果
          if (this._cachedImgs && Date.now() - this._lastImgSearchTime < 777777) {
            return this._cachedImgs;
          }
          
          const rootNode = node || document;
          let captchaImgs = [];
          
          // 使用更高效的优先级查找策略
          // 1. 首先尝试自定义规则
          if (this.options.ocrRule?.captchaSelector) {
            captchaImgs = Array.from(rootNode.querySelectorAll(this.options.ocrRule.captchaSelector));
          }
          
          // 2. 如果没找到，使用合并后的选择器一次性查找
          if (captchaImgs.length === 0) {
            const allSelectors = this.options.captchaSelectors.join(', ');
            captchaImgs = Array.from(rootNode.querySelectorAll(allSelectors));
          }
          
          // 3. 如果还是没找到，先寻找验证码输入框，然后以输入框的父级父级为根节点启发式查找
          if (captchaImgs.length === 0) {
            this.log("常规选择器未找到验证码图片，尝试通过输入框定位");
            
            // 查找验证码输入框
            const inputSelectors = this.options.ocrRule?.inputSelector
              ? [this.options.ocrRule.inputSelector]
              : this.options.inputSelectors;
            
            const allInputSelectors = inputSelectors.join(', ');
            const captchaInputs = Array.from(rootNode.querySelectorAll(allInputSelectors));
            
            if (captchaInputs.length > 0) {
              this.log("找到" + captchaInputs.length + "个验证码输入框，以其父级父级为根节点搜索");
              
              for (const input of captchaInputs) {
                // 以输入框的父级父级为搜索根节点
                const grandParent = input.parentElement?.parentElement;
                if (grandParent) {
                  this.log("在输入框的父级父级中搜索验证码图片");
                  const nearbyImgs = Array.from(grandParent.querySelectorAll("img"));
                  
                  // 启发式过滤：尺寸符合验证码特征的图片
                  const candidateImgs = nearbyImgs.filter(img => 
                    img.width > 70 && img.width < 200 && img.height > 20 && img.height < 100
                  );
                  
                  if (candidateImgs.length > 0) {
                    this.log("在输入框附近找到" + candidateImgs.length + "个候选验证码图片");
                    captchaImgs = [...captchaImgs, ...candidateImgs];
                  }
                }
              }
            }
          }
          
          // 4. 如果通过输入框也没找到，最后使用全局启发式查找作为备选方案
          if (captchaImgs.length === 0) {
            this.log("通过输入框定位也未找到，使用全局启发式查找");
            const allImgs = rootNode.querySelectorAll("img");
            captchaImgs = Array.from(allImgs).filter(img => 
              img.width > 70 && img.width < 200 && img.height > 20 && img.height < 100
            );
          }
          
          // 高效过滤隐藏和未加载的图片
          captchaImgs = captchaImgs.filter(img => {
            if (!img.isConnected || !img.src) return false;
            
            // 使用 CSS 计算值进行可见性检查
            const style = window.getComputedStyle(img);
            const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && 
                              img.offsetParent !== null;
            
            return isVisible && (img.complete || img.src.startsWith('blob:') || img.src.startsWith('data:'));
          });
          
          // 缓存结果
          if (captchaImgs.length > 0) {
            this._cachedImgs = captchaImgs;
            this._lastImgSearchTime = Date.now();
          }
          
          return captchaImgs;
        }
        
        // 查找验证码输入框
        findCaptchaInputs(captchaImgs) {
          // 使用缓存
          if (this._cachedInputs && Date.now() - this._lastInputSearchTime < 777777) {
            return this._cachedInputs;
          }

          let inputs = [];
          const roots = captchaImgs?.map(img => img.getRootNode()) || [];

          // 选择器集合：优先自定义规则，否则使用默认 inputSelectors
          const selectors = this.options.ocrRule?.inputSelector
            ? [this.options.ocrRule.inputSelector]
            : this.options.inputSelectors;

          const allSelectors = selectors.join(', ');

          // 工具函数：在 document + 所有 ShadowRoot 中查询
          const queryAllInRoots = (selector) => {
            let results = Array.from(document.querySelectorAll(selector));
            for (const root of roots) {
              if (root instanceof ShadowRoot) {
                results.push(...root.querySelectorAll(selector));
              }
            }
            return results;
          };

          // 先尝试直接查询
          inputs.push(...queryAllInRoots(allSelectors));

          // 如果没找到，尝试查找图片附近的输入框
          if (inputs.length === 0) {
            const fallbackImgs = captchaImgs?.length ? captchaImgs : this.findCaptchaImages();
            for (const img of fallbackImgs) {
              const parent = img.parentElement;
              const grandParent = parent?.parentElement;

              // 父级同级元素中的 INPUT
              if (parent) {
                for (const sibling of parent.children) {
                  if (sibling.tagName === "INPUT") inputs.push(sibling);
                }
              }

              // 父级的同级元素下的 INPUT
              if (grandParent) {
                for (const sibling of grandParent.children) {
                  inputs.push(...sibling.querySelectorAll("input"));
                }
              }
            }
          }

          // 缓存结果
          if (inputs.length > 0) {
            this._cachedInputs = inputs;
            this._lastInputSearchTime = Date.now();
          }

          return inputs;
        }
        
        // 将图片转换为base64格式
        async imageToBase64(imgElement) {
          return new Promise((resolve, reject) => {
            try {
              // 如果图片不存在或无效，直接失败
              if (!imgElement || !imgElement.src) {
                reject(new Error("Invalid image element or source"));
                return;
              }

              // 如果图片已经是base64格式
              if (imgElement.src.startsWith("data:")) {
                try {
                  const base64Data = imgElement.src.split(",")[1];
                  if (base64Data) {
                    resolve(base64Data);
                  } else {
                    reject(new Error("Invalid base64 image data"));
                  }
                } catch (e) {
                  reject(new Error("Failed to process base64 image: " + e.message));
                }
                return;
              }

              // 首先尝试从已加载的图片中获取base64，不刷新验证码
              try {
                // 检查图片是否已经完全加载
                if (imgElement.complete && imgElement.naturalWidth > 0) {
                  this.log("尝试直接从已加载图片获取base64");
                  const canvas = document.createElement("canvas");
                  canvas.width = imgElement.naturalWidth || imgElement.width;
                  canvas.height = imgElement.naturalHeight || imgElement.height;
                  
                  if (canvas.width <= 0 || canvas.height <= 0) {
                    throw new Error("Invalid image dimensions");
                  }
                  
                  const ctx = canvas.getContext("2d");
                  ctx.drawImage(imgElement, 0, 0);
                  
                  try {
                    const dataURL = canvas.toDataURL("image/png");
                    const base64 = dataURL.replace(/^data:image\\/(png|jpg|jpeg);base64,/, "");
                    
                    if (base64) {
                      this.log("成功从已加载图片获取base64");
                      resolve(base64);
                      return;
                    }
                  } catch (canvasErr) {
                    this.log("从已加载图片获取base64失败: " + canvasErr.message);
                    // 不要返回，继续尝试其他方法
                  }
                } else {
                  this.log("图片未完全加载，无法直接获取base64");
                }
              } catch (directErr) {
                this.log("直接获取图片base64失败: " + directErr.message);
                // 继续尝试其他方法
              }
              
              // 针对blob URL的处理
              if (imgElement.src.startsWith("blob:")) {
                this.log("检测到Blob URL图片，尝试特殊处理");
                
                // 方法1：直接使用已渲染的图片进行绘制
                try {
                  const canvas = document.createElement("canvas");
                  canvas.width = imgElement.naturalWidth || imgElement.width;
                  canvas.height = imgElement.naturalHeight || imgElement.height;
                  
                  if (canvas.width <= 0 || canvas.height <= 0) {
                    throw new Error("Invalid image dimensions");
                  }
                  
                  const ctx = canvas.getContext("2d");
                  ctx.drawImage(imgElement, 0, 0);
                  
                  try {
                    const dataURL = canvas.toDataURL("image/png");
                    const base64 = dataURL.replace(/^data:image\\/(png|jpg|jpeg);base64,/, "");
                    
                    if (base64) {
                      resolve(base64);
                      return;
                    }
                  } catch (canvasErr) {
                    this.log("Canvas转换失败，尝试其他方法: " + canvasErr.message);
                  }
                } catch (e) {
                  this.log("直接绘制Blob图片失败: " + e.message);
                  // 继续尝试下一种方法
                }
              }
              
              // 通用方法：使用Image对象加载图片
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              
              const img = new Image();
              // 允许跨域访问
              img.crossOrigin = "Anonymous";
              
              // 设置超时
              const timeoutId = setTimeout(() => {
                img.src = ""; // 中断加载
                reject(new Error("Image loading timeout"));
              }, 5000);
              
              img.onload = () => {
                clearTimeout(timeoutId);
                
                try {
                  canvas.width = img.width;
                  canvas.height = img.height;
                  
                  if (canvas.width <= 0 || canvas.height <= 0) {
                    reject(new Error("Invalid image dimensions after load"));
                    return;
                  }
                  
                  // 绘制图像
                  ctx.drawImage(img, 0, 0);
                  
                  try {
                    // 获取base64数据
                    const dataURL = canvas.toDataURL("image/png");
                    const base64 = dataURL.replace(/^data:image\\/(png|jpg|jpeg);base64,/, "");
                    
                    if (base64) {
                      resolve(base64);
                    } else {
                      reject(new Error("Failed to convert image to base64"));
                    }
                  } catch (toDataUrlError) {
                    reject(new Error("Failed to call toDataURL: " + toDataUrlError.message));
                  }
                } catch (drawError) {
                  reject(new Error("Failed to draw image to canvas: " + drawError.message));
                }
              };
              
              img.onerror = (error) => {
                clearTimeout(timeoutId);
                this.log("图片加载失败: " + (error ? error.message : "未知错误"));
                reject(new Error("Failed to load image"));
              };
              
              // 避免缓存并添加随机参数
              const timestamp = new Date().getTime();
              const randomParam = Math.floor(Math.random() * 1000000);
              
              try {
                if (imgElement.src.includes("?")) {
                  img.src = imgElement.src + "&t=" + timestamp + "&r=" + randomParam;
                } else {
                  img.src = imgElement.src + "?t=" + timestamp + "&r=" + randomParam;
                }
              } catch (srcError) {
                reject(new Error("Failed to set image src: " + srcError.message));
              }
            } catch (error) {
              reject(new Error("Base64 conversion error: " + error.message));
            }
          });
        }
        
        // 通过API识别验证码
        async recognizeCaptcha(imgElement) {
          if (this.recognizing) {
            this.log("正在进行识别，请稍候");
            return null;
          }
          
          this.recognizing = true;
          this.log("开始识别验证码");
          
          try {
            // 添加重试逻辑
            const maxRetries = 2;
            let retryCount = 0;
            
            while (retryCount <= maxRetries) {
              try {
                // 如果是重试，添加日志
                if (retryCount > 0) {
                  this.log("尝试第" + retryCount + "次重试...");
                }
                
                // 转换图片为Base64
                let base64;
                try {
                  base64 = await this.imageToBase64(imgElement);
                  if (!base64) {
                    throw new Error("图片转Base64失败，结果为空");
                  }
                } catch (imgError) {
                  if (retryCount >= maxRetries) {
                    throw new Error("图片处理失败: " + imgError.message);
                  }
                  retryCount++;
                  this.log("图片处理失败，准备重试: " + imgError.message);
                  // 短暂等待后重试
                  await new Promise(resolve => setTimeout(resolve, 500));
                  continue;
                }
                
                // 请求OCR API
                this.log("发送OCR请求...");
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

                const data = { image: base64 };

                switch (this.options?.ocrRule?.type) {
                    case "数字":
                    // 处理数字类型的逻辑
                    data.charset_range = "0123456789";
                    break;

                  case "字母":
                    // 处理字母类型的逻辑
                    data.charset_range = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
                    break;
                  case "数字+字母":
                    // 处理数字和字母类型的逻辑
                    data.charset_range = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
                    break;
                  case "算术":
                    // 处理算术类型的逻辑
                    data.charset_range = "零一二三四五六七八九十百千万加减乘除0123456789+-*×xX/=";
                    data.type = "count";
                    break;

                  default:
                    break;
                }

                try {
                  const response = await fetch(this.options.ocrPath, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify(data),
                    signal: controller.signal
                  });
                  
                  clearTimeout(timeoutId);
                  
                  if (!response.ok) {
                    throw new Error(\`OCR API 请求失败: \${response.status} \${response.statusText}\`);
                  }
                  
                  const result = await response.json();
                  const text = result?.data?.text || result?.data || "";
                  
                  // 验证识别结果
                  if (!text || text.trim() === "") {
                    throw new Error("OCR识别结果为空");
                  }
                  
                  this.log("识别结果: " + text);
                  this.lastRecognized = text;
                  if (this.options.ocrRule?.regex) {
                    for (const rule of this.options.ocrRule.regex) {
                      const regex = new RegExp(rule.pattern, rule.flags || "");

                      this.lastRecognized = this.lastRecognized.replace(regex, rule.substitution)
                    }
                  }
                  
                  return this.lastRecognized;
                } catch (apiError) {
                  if (apiError.name === 'AbortError') {
                    throw new Error("OCR请求超时");
                  }
                  
                  if (retryCount >= maxRetries) {
                    throw apiError;
                  }
                  
                  retryCount++;
                  this.log("API请求失败，准备重试: " + apiError.message);
                  // 稍微长一点的等待时间后重试API请求
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              } catch (error) {
                if (retryCount >= maxRetries) {
                  this.log("识别失败，已达到最大重试次数: " + error.message);
                  return null;
                }
                
                retryCount++;
                this.log("发生错误，准备重试: " + error.message);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            return null;
          } catch (finalError) {
            this.log("识别最终失败: " + finalError.message);
            return null;
          } finally {
            // 确保无论成功失败都将标志恢复为false
            setTimeout(() => {
              this.recognizing = false;
              this.log("识别流程结束，可以进行下一次识别");
            }, 500);
          }
        }
        
        
        // 填充验证码到输入框
        fillCaptcha(text, captchaImgs) {
          if (!text) return false;

          const inputs = this.findCaptchaInputs(captchaImgs);
          let filled = false;
          
          // 如果没有找到输入框，直接返回false
          if (!inputs || inputs.length === 0) {
            this.log("未找到验证码输入框");
            return false;
          }
          
          for (const input of inputs) {
            input.value = text;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            filled = true;
            this.log("已填充验证码: " + text);
          }
          
          return filled;
        }
        
        // 复制到剪贴板
        copyTextToClipboard(text) {
          try {
            // 尝试使用现代API
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text)
                .then(() => this.log("已使用现代API复制到剪贴板: " + text))
                .catch(err => {
                  this.log("现代API复制失败，尝试传统方法: " + err);
                  this.copyWithFallback(text);
                });
              return true;
            }
            
            // 回退到传统方法
            return this.copyWithFallback(text);
          } catch (error) {
            this.log("复制到剪贴板失败: " + error.message);
            return false;
          }
        }
        
        // 传统复制方法作为备选
        copyWithFallback(text) {
          try {
            // 创建一个临时输入元素
            const input = document.createElement("textarea"); // 使用textarea更可靠
            input.style.position = "fixed";
            input.style.left = "-9999px"; // 放到屏幕外
            input.style.top = "0";
            input.value = text;
            
            // 添加到DOM
            document.body.appendChild(input);
            
            // 确保元素可见并选中
            input.setAttribute("readonly", "");
            input.focus();
            input.select();
            input.setSelectionRange(0, text.length); // 兼容移动设备
            
            // 执行复制
            const successful = document.execCommand("copy");
            
            // 清理
            document.body.removeChild(input);
            
            if (successful) {
              this.log("已通过传统方法复制到剪贴板: " + text);
              // 显示一个临时的复制成功提示
              this.showCopyNotification(text);
              return true;
            } else {
              this.log("传统复制方法失败");
              return false;
            }
          } catch (err) {
            this.log("复制回退方法失败: " + err.message);
            return false;
          }
        }
        
        // 显示复制成功的通知
        showCopyNotification(text) {
          const notification = document.createElement("div");
          notification.textContent = "验证码已复制: " + text;
          notification.style.position = "fixed";
          notification.style.bottom = "150px";
          notification.style.right = "10px";
          notification.style.padding = "10px 15px";
          notification.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
          notification.style.color = "white";
          notification.style.borderRadius = "4px";
          notification.style.zIndex = "100000";
          notification.style.fontSize = "14px";
          notification.style.transition = "opacity 0.3s";
          
          document.body.appendChild(notification);
          
          // 3秒后淡出并移除
          setTimeout(() => {
            notification.style.opacity = "0";
            setTimeout(() => {
              document.body.removeChild(notification);
            }, 300);
          }, 3000);
        }
        
        // 查找并识别验证码
        async findAndRecognize(captchaImgs) {
          this.lastRecognized = null;
          // 如果正在识别过程中，直接返回，避免重复操作
          if (this.recognizing) {
            this.log("正在识别中，跳过此次调用");
            return null;
          }

          if (!captchaImgs || captchaImgs.length === 0) {
            captchaImgs = this.findCaptchaImages();
          }
          if (captchaImgs.length === 0) {
            this.log("未找到验证码图片");
            return null;
          }
          
          // 更新验证码按钮位置，让它靠近验证码图片
          this.updateCaptchaButtonPosition(captchaImgs);
          
          // 保存图片src，用于避免重复识别相同图片
          const imgSrcs = new Set();
          const uniqueImgs = [];
          
          for (const img of captchaImgs) {
            // 跳过隐藏的图片
            if (img.offsetParent === null || 
                img.style.display === 'none' || 
                img.style.visibility === 'hidden') {
              continue;
            }
            
            const src = img.src || '';
            // 只处理未处理过的图片
            if (!imgSrcs.has(src) && src) {
              imgSrcs.add(src);
              uniqueImgs.push(img);
            }
          }
          
          this.log(\`找到 \${uniqueImgs.length} 个唯一验证码图片\`);
          
          // 确保验证码按钮可见（如果找到验证码）
          if (uniqueImgs.length > 0 && this._captchaButton && !_${prefix}_id77_needHideSwitch) {
            this._captchaButton.style.display = "flex";
          }
          
          for (const img of uniqueImgs) {
            const text = await this.recognizeCaptcha(img);
            if (text) {
              let inputsFilled = false;
              
              if (this.options.autoFill) {
                // 尝试填充到输入框
                inputsFilled = this.fillCaptcha(text, captchaImgs);
              }
              
              // 保存识别结果，但不自动复制
              // 记录是否有输入框，供复制按钮使用
              this._lastRecognizedText = text;
              this._hasInputField = inputsFilled;
              
              // 如果没有找到输入框，显示复制按钮
              if (!inputsFilled && this._copyButton) {
                this._copyButton.style.display = "block";
                this.log("未找到验证码输入框，可点击'复制验证码'按钮复制结果");
              }
              
              return text;
            }
          }
          
          return null;
        }
        
        // 添加验证码识别按钮
        addCaptchaButton() {
          // 创建按钮容器，用于统一管理和定位
          const container = document.createElement("div");
          container.style.position = "fixed";
          container.style.right = "10px";
          container.style.bottom = "100px";
          container.style.display = "none";
          container.style.flexDirection = "column";
          container.style.gap = "10px";
          container.style.zIndex = "9999";
          
          // 创建识别按钮
          const recognizeButton = document.createElement("div");
          recognizeButton.id = "ocr_recognize_btn_" + Math.random().toString(36).substr(2, 9);
          recognizeButton.innerText = "识别验证码";
          recognizeButton.style.backgroundColor = "rgba(0, 119, 255, 0.8)";
          recognizeButton.style.color = "white";
          recognizeButton.style.padding = "8px 12px";
          recognizeButton.style.borderRadius = "4px";
          recognizeButton.style.fontSize = "14px";
          recognizeButton.style.cursor = "pointer";
          recognizeButton.style.textAlign = "center";
          recognizeButton.style.display = "block";
          
          // 创建复制按钮
          const copyButton = document.createElement("div");
          copyButton.id = "ocr_copy_btn_" + Math.random().toString(36).substr(2, 9);
          copyButton.innerText = "复制验证码";
          copyButton.style.backgroundColor = "rgba(76, 175, 80, 0.8)";
          copyButton.style.color = "white";
          copyButton.style.padding = "8px 12px";
          copyButton.style.borderRadius = "4px";
          copyButton.style.fontSize = "14px";
          copyButton.style.cursor = "pointer";
          copyButton.style.textAlign = "center";
          copyButton.style.display = "none"; // 初始隐藏，有结果时才显示
          
          // 识别按钮点击事件
          recognizeButton.addEventListener("click", async () => {
            const result = await this.findAndRecognize();
            if (result) {
              // 有识别结果且没有输入框时，显示复制按钮
              if (!this._hasInputField) {
                copyButton.style.display = "block";
              }
            }
          });
          
          // 复制按钮点击事件
          copyButton.addEventListener("click", () => {
            if (this._lastRecognizedText) {
              this.copyTextToClipboard(this._lastRecognizedText);
              this.log("手动点击复制验证码: " + this._lastRecognizedText);
            } else {
              this.log("没有可复制的验证码结果");
            }
          });
          
          // 双击显示/隐藏按钮组
          // document.addEventListener("dblclick", () => {
          //   const currentDisplay = container.style.display;
          //   container.style.display = currentDisplay === "none" ? "flex" : "none";
          // });
          
          // 添加按钮到容器
          container.appendChild(recognizeButton);
          container.appendChild(copyButton);
          document.body.appendChild(container);
          
          // 保存引用以便后续更新位置
          this._captchaButton = container;
          this._recognizeButton = recognizeButton;
          this._copyButton = copyButton;
        }
        
        // 更新验证码按钮位置（放在验证码附近）
        updateCaptchaButtonPosition(captchaImgs) {
          if (!this._captchaButton || !captchaImgs || captchaImgs.length === 0) return;
          
          // 使用第一张验证码图片作为参考
          const img = captchaImgs[0];
          if (!img || !img.getBoundingClientRect) return;
          
          const rect = img.getBoundingClientRect();
          
          // 如果图片不在视口内，则使用默认位置
          if (rect.top < 0 || rect.bottom > window.innerHeight || 
              rect.left < 0 || rect.right > window.innerWidth) {
            // 恢复默认位置
            this._captchaButton.style.right = "10px";
            this._captchaButton.style.bottom = "100px";
            this._captchaButton.style.left = "";
            this._captchaButton.style.top = "";
            return;
          }
          
          // 根据图片位置放置按钮
          this._captchaButton.style.right = "";
          this._captchaButton.style.bottom = "";
          
          // 默认放在图片右侧
          this._captchaButton.style.left = (rect.right + 10) + "px";
          this._captchaButton.style.top = (rect.top + window.scrollY) + "px";
          
          // 如果图片靠近右边缘，则放在图片下方
          if (rect.right + 150 > window.innerWidth) {
            this._captchaButton.style.left = rect.left + "px";
            this._captchaButton.style.top = (rect.bottom + window.scrollY + 10) + "px";
          }
          
          // 如果有识别结果但没有输入框，显示复制按钮
          if (this._lastRecognizedText && this._copyButton && !this._hasInputField) {
            this._copyButton.style.display = "block";
          }
        }
      }

      // 页面加载完成后初始化验证码识别器
      window._${prefix}_id77_captchaRecognizer = null;
      function _${prefix}_id77_initCaptchaRecognizer() {
        if (!window._${prefix}_id77_captchaRecognizer && ocrPath) {
          window._${prefix}_id77_captchaRecognizer = new _${prefix}_id77_CaptchaRecognizer();
        }
      }

      // 等待页面加载完成
      if (document.readyState === 'complete') {
        _${prefix}_id77_initCaptchaRecognizer();
      } else {
        window.addEventListener('load', _${prefix}_id77_initCaptchaRecognizer);
      }
    })();
  </script>`;
  }
  // 创建验证码识别器
  let captchaScript =
    ocrApi && ocrPath ? createCaptchaRecognizer(ocrPath, ocrRules) : '';

  if (vx77) {
    html = html.replace(
      '{initJSSDK(initPage)},200);',
      '{initJSSDK(initPage)},0);',
    );
  }

  let mitmFixContent = `
  <script ignore>
    setTimeout(() => {
      const _id77_vzan_footer = document.querySelector('footer.goods_action_area');
      if (_id77_vzan_footer) {
        const _id77_vzan_fix = getComputedStyle(_id77_vzan_footer).getPropertyValue("padding-bottom");

        if (_id77_vzan_fix === "0px") {
          _id77_vzan_footer.style.setProperty('--sab', "80px");
        }
      }
    }, 300);

    if (
      ${vx77}
    ) {
      setTimeout(() => {
        if (window.handleCard) handleCard();
      }, 1);
    }

    if(${$.needReload}) {
      location.reload();
    }
  </script>`;

  let mitmContent = `<style>`;
  if (vx77) {
    mitmContent += `
      #cardBtn {
        width: 100%;
        height: 7.7rem;
      }
    `;
  }
  mitmContent += `
    :root {
      --sat: env(safe-area-inset-top);
      --sar: env(safe-area-inset-right);
      --sab: env(safe-area-inset-bottom);
      --sal: env(safe-area-inset-left);
    }
    /* 券隐藏变显示 */
    .free_coupon .coupon_receive {
      min-height: 100px;
    }

    footer.goods_action_area {
      padding-bottom: var(--sab);
    }
    div#__vconsole{
        display: block;
    }
    body > a {
        display: inline-block !important;
    }
    .vc-tab._${prefix}_id77_hide {
      display: none !important;
    }
    * {
      -webkit-user-select: auto !important;
      user-select: auto !important;
    }
    #cks {
      top: 0em;
      background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCI+PHBhdGggZD0iTTI0OS42MjIgOTUwLjUwNnMxNTYuNzY4LTcuODM1IDI2MC45NTMtOC43ODljMTE1Ljc1OS0xLjA1OSAzMDAuMTY0IDguNzkgMzAwLjE2NCA4Ljc5bDE5MS4zMTggMjEuNjMyUzcwMy4xNiA5ODkuODUgNTEwLjU3NSA5ODkuNzE2Yy0xODguODkzLS4xMzEtNDYzLjc2NC0xNy41NzctNDYzLjc2NC0xNy41Nzd6Ii8+PHBhdGggZmlsbD0iIzgzNTEwNCIgZD0iTTE3Ni40MTUgMTg1LjQ3M2MtMjcuMTEzIDg1LjQyNS0zOC45NTYgMTkyLjEzNy00MS45NzMgMjY3LjMzN2wtLjE3NSA0LjI4LTIuNDUyIDMuNTE0Yy01NS44NCA3OS45MDQtNjQuMjkgMTQ4LjQyNy01NS44NjMgMjE0Ljg1OSA3LjcxNSA2MC44MSA0My4zOTQgMTA3LjI4IDg2LjQ2IDE0Mi4zNDcgNDMuMTE3IDM1LjEwOSA5Mi41MjkgNTcuODQ4IDEyNS4xOCA3MS4xNSA1Mi45MDggMjEuNTU0IDE0NC42NjIgNDMuMDcgMjQ2LjMxIDQxLjkzOCAxMDEuNTg3LTEuMTMgMjExLjY1OC0yNC44NDggMzAyLjYwNy05Mi4yMDEgMTE4LjAzNy04Ny40MTIgMTMzLjAyOS0yNzIuMjgyIDQ0LjY1Mi0zNzcuMDRsLTMuMDQtMy42MDctLjM2My00LjcwMmMtMTMuNzk1LTE3OC43MTEtNTIuMDc4LTI3OS44LTkxLjQzMS0zMzQuNjYtMzkuMzE2LTU0LjgwNS03OC41ODItNjIuNDUzLTk2Ljc0NS01OS4wNjItNC44NS45MDctMTIuNzcgNS45NzctMjMuMTI4IDE4LjIyNy05LjgzOSAxMS42MzMtMjAuMDE1IDI3LjQ4MS0yOS44NjIgNDUuMzkzLTE5LjY1NSAzNS43NDYtMzYuOTMyIDc3LjcwNy00Ni43ODMgMTA1LjM4MWwtNC42MjggMTIuOTk5LTEzLjI0OC0zLjg2MmMtMjIuNTg2LTYuNTgzLTUxLjcyNi05LjgzNi03OS44MS0xMC41NTktMjguMDg3LS43Mi01My44NjMgMS4xMTgtNjkuNSA0LjEyMmwtMTIuMDg3IDIuMzItNC4zNTYtMTEuNTFjLTI2Ljk5Ni03MS4zNjYtNTIuMTE5LTExNS4xNzktNzIuMDI1LTE0MC44NzItOS45NTctMTIuODUtMTguMzgzLTIwLjg3OC0yNC44MTMtMjUuNTcxLTYuNDI4LTQuNjkzLTkuNzE3LTUuMjM3LTkuOTg5LTUuMjgxbC0uMDE0LS4wMDMtLjgwMi0uMDEyLS43OTYtLjA5NmMtMjYuNzY0LTMuMjkyLTQ5LjYxNCA4LjAwNy02OS45ODMgMzEuODczLTIwLjcxNCAyNC4yNzEtMzcuNzUzIDYwLjQ3Ny01MS4zNDMgMTAzLjI5OG0xMjQuMjIzLTE2NC4yOWMtMzguOTA0LTQuNTM2LTcwLjUyNSAxMy4xNjUtOTUuMTMzIDQyLTI0LjQgMjguNTk0LTQyLjg5NyA2OS4wNzctNTYuOTc1IDExMy40MzctMjcuNzA3IDg3LjMtMzkuODA4IDE5NC41My00My4xNDMgMjcwLjc2LTU4LjI1NCA4NS4wMjQtNjcuNTcyIDE1OS45MjItNTguNDU5IDIzMS43NjMgOC45ODggNzAuODQzIDUwLjQ5OCAxMjMuNDgzIDk3LjAxMSAxNjEuMzU2IDQ2LjQ2IDM3LjgzIDk5LjAxNSA2MS44NjcgMTMyLjYxNCA3NS41NTcgNTYuNjAxIDIzLjA2IDE1Mi4yMjUgNDUuMjcgMjU3LjY3NCA0NC4wOTYgMTA1LjUxNi0xLjE3MyAyMjIuMjYtMjUuNzkgMzE5LjY5NS05Ny45NDQgMTMwLjcyNy05Ni44MDkgMTQ4LjExOC0yOTcuOTkzIDUyLjY0My00MTUuNzQxLTE0LjMwNC0xNzguNTQ4LTUzLjA5Ni0yODQuMzc0LTk2LjQ2Ny0zNDQuODMtNDMuNzgzLTYxLjAzNy05My4zNDItNzYuODQ0LTEyNS44ODUtNzAuNzc0LTE1LjQyNyAyLjg4Mi0yOSAxNC45NzEtNDAuMSAyOC4wOTYtMTEuNjE3IDEzLjczNi0yMi44NjcgMzEuNDY5LTMzLjE1NyA1MC4xOS0xNy44MDUgMzIuMzgtMzMuNTYgNjkuMjE0LTQ0LjEwMiA5Ny4xMjMtMjMuMTQtNS4yMDgtNDkuNDU2LTcuNjgzLTczLjk4LTguMzEyLTIzLjQ2LS42MDMtNDYuMDc2LjQ2Mi02My41OTkgMi43MTgtMjYuMDctNjYuNy01MC44NzgtMTEwLjA4LTcxLjk5My0xMzcuMzMzLTExLjEzMi0xNC4zNjYtMjEuNDYtMjQuNTQ3LTMwLjY4Ny0zMS4yOC04LjUzOC02LjIzNC0xNy40NjctMTAuNDktMjUuOTU3LTEwLjg4MyIvPjxwYXRoIGZpbGw9IiNGRkYyREYiIGQ9Ik0zMDEuMzQ5IDQ5LjczN0MxNzIuNjQ2IDMzLjkzOCAxMzkuMDUzIDMwNS4yNzcgMTMzLjEyIDQ1Mi45NDQgNzYuNDE3IDUzMy45NSA2NC40MzYgNjA0LjMgNzMuMDU1IDY3Mi4wOThjMTYuMjg4IDEyOC4xOSAxNTAuNTYzIDE5Mi45OTggMjE1LjE4IDIxOS4yNzYgMTA2LjggNDMuNDQxIDM2NS41MDEgODUuMTUgNTQ5LjIzLTUwLjY4MiAxMjEuOTgtOTAuMTc5IDEzMy4wMi0yNzkuNjkyIDQxLjcxMi0zODcuNzQ4Qzg1Mi4wNyAxMDIuMzYyIDczNS41MyA0OS4yOTggNjg2LjA4IDU4LjUxNGMtMzkuNTYyIDcuMzczLTgyLjgzOSAxMjYuNTQtMTAyLjQgMTgxLjM5NS00Ny4zNTMtMTMuNzgtMTM3Ljk2OC0xNS44MTQtMTcxLjE1NC05LjQ1QzM1OS4yNSA4OS44NTcgMzEwLjYwNiA1MC44NzIgMzAxLjM0OSA0OS43MzciLz48cGF0aCBmaWxsPSIjNUEzNzAzIiBkPSJNNTczLjQ0OSA1OTIuMjA2YzAgMjEuNjU2LTI3LjI0MiA1Mi43My02MC44NDYgNTIuNzMtMzMuNjAyIDAtNjAuODQzLTMxLjA3NC02MC44NDMtNTIuNzMgMC0yMS42NTcgMjcuMjQtMzkuMjEgNjAuODQzLTM5LjIxczYwLjg0NiAxNy41NTMgNjAuODQ2IDM5LjIxIi8+PHBhdGggZmlsbD0iIzgzNTEwNCIgZD0iTTM2My4zMDMgNjQwLjk0OGExMS43MDMgMTEuNzAzIDAgMCAxIDE1LjM3OCA2LjEyYzIuNjg2IDYuMjQ0IDEwLjA3NiAxNy4xOSAyMS44NzMgMjQuNTEgMTEuMjUyIDYuOTgzIDI2Ljk0MyAxMC45ODggNDcuOTg3IDMuNTYzIDQ4LjkxOC0xNy4yNjggODguMTUtMTMuMTAyIDEyNy4yNTQtLjA2OCAxMy41OTkgNC41MzIgMzEuNDQzIDQuMzQ4IDQ2Ljc2OC0uNzYgMTUuNDQ1LTUuMTUgMjUuODEtMTQuMzE2IDI4LjgxLTI1LjYxOGExMS43MDMgMTEuNzAzIDAgMCAxIDIyLjYyNCA2LjAwNGMtNS43OSAyMS44MjMtMjQuNDk0IDM1LjMwNC00NC4wMzIgNDEuODE3LTE5LjY2MSA2LjU1NC00Mi43MTkgNy4wNDUtNjEuNTcyLjc2LTM1LjI1OC0xMS43NTItNjkuMDM4LTE1LjI1MS0xMTIuMDYzLS4wNjQtMjguMDc2IDkuOTA3LTUxLjE0NSA0Ljc4Ny02OC4xMi01Ljc0Ni0xNi40MjgtMTAuMTk2LTI2LjczLTI1LjE1OC0zMS4wMjctMzUuMTRhMTEuNzAzIDExLjcwMyAwIDAgMSA2LjEyLTE1LjM3OCIvPjxwYXRoIGZpbGw9IiM4MzUxMDQiIGQ9Ik01MTUuOTg4IDY2Mi41MzRjLTI4LjgwNyAwLTQ4Ljk3IDUuNzg3LTY0LjUyMSAxMC4yNTJsLTMuMTQ1Ljg5OGMtMTUuNjk0IDQuNDY0LTI0LjYyMyA2LjI0My0zNi41MTkgMi41MDRsLTE5LjI3Ny02LjA2Mi0zLjMwNyAxOS45MzZjLTQuMjg2IDI1Ljg0Ni0yLjcyIDY1LjY3MyAxMy44ODMgMTAwLjE4IDE3LjIzMiAzNS44MSA1MC42OCA2NS40NDIgMTA3LjAwOCA2Ni45NDMgMzMuNzc3Ljg5OCA2MC4yMTQtNy43IDgwLjIzOC0yMi42NjYgMTkuODM5LTE0LjgyNyAzMi4wMDEtMzQuODYgMzkuMjY5LTU0LjYyNiA3LjI0Ny0xOS43MTMgOS44NzctMzkuODA3IDEwLjMwMS01NS45OTUuMjEtOC4xMzQtLjEyOS0xNS40OTgtLjc5My0yMS41ODMtLjYxNC01LjYxMi0xLjY0MS0xMS40OTItMy40MDUtMTUuOTAxbC01LjU2LTEzLjktMTQuNjA0IDMuMjk3Yy0xNi45MjMgMy44Mi0zMi44IDEuMzkyLTQ5LjA5NC0yLjc2Mi00LjA4MS0xLjAzOS04LjA4NC0yLjE2LTEyLjE4NS0zLjMwNmwtLjItLjA1NmE0OTMgNDkzIDAgMCAwLTEyLjExMi0zLjI4Yy04LjA4LTIuMDQyLTE2Ljk5OC0zLjg3My0yNS45NzctMy44NzMiLz48cGF0aCBmaWxsPSIjRkNCMEEyIiBkPSJNNTE1Ljk4NSA3MTguMTY2Yy01My42NDMgMC05MS4yNjggMzAuNjQ3LTEwMy40MzYgNDggNC4wNTUgMjAuOTU2IDI3Ljg5NCA2OC42OSA5Mi42MTcgNzMuMDEgNjcuNjA0IDQuNTE4IDk2LjY3NC0zMi42NjUgMTA5LjUyLTY4LjQ5Ni0xMC4xNC0xNS41NDctNDIuNTkyLTUyLjUxNC05OC43MDEtNTIuNTE0Ii8+PHBhdGggZmlsbD0iI0Y3OUE5OSIgZD0iTTI5Ny42MjQgNjA1LjcyNWMzMi44NTYgMCA1OS40OTItMTMuMDEzIDU5LjQ5Mi0yOS4wNyAwLTE2LjA1My0yNi42MzYtMjkuMDctNTkuNDkyLTI5LjA3cy01OS40OTEgMTMuMDE3LTU5LjQ5MSAyOS4wN2MwIDE2LjA1NyAyNi42MzIgMjkuMDcgNTkuNDkxIDI5LjA3bTQyOS45NiAwYy0zMi44NTYgMC01OS40OTEtMTMuMDEzLTU5LjQ5MS0yOS4wNyAwLTE2LjA1MyAyNi42MzUtMjkuMDcgNTkuNDkxLTI5LjA3czU5LjQ5MiAxMy4wMTcgNTkuNDkyIDI5LjA3YzAgMTYuMDU3LTI2LjYzNiAyOS4wNy01OS40OTIgMjkuMDciLz48cGF0aCBmaWxsPSIjNUEzNzAzIiBkPSJNMzU1LjU3NCA1NjIuNDhjMjQuODkyLTQuNDA2IDQyLjc2NS0yMS4wMTggMzkuOTE4LTM3LjEwNy0yLjg0Ny0xNi4wODUtMjUuMzM2LTI1LjU1My01MC4yMzEtMjEuMTQ3LTI0Ljg5MiA0LjQwNy00Mi43NjYgMjEuMDE5LTM5LjkxNiAzNy4xMDcgMi44NDcgMTYuMDg2IDI1LjMzNCAyNS41NTMgNTAuMjI5IDIxLjE0N20zMDkuMDg0LS4wODdjLTIzLjQ5LTQuMTYtNDAuMzU3LTE5LjgzNy0zNy42NjktMzUuMDE4IDIuNjg2LTE1LjE3OSAyMy45MS0yNC4xMTQgNDcuNC0xOS45NTcgMjMuNDkzIDQuMTU4IDQwLjM2IDE5LjgzNyAzNy42NzEgMzUuMDE1LTIuNjg1IDE1LjE4Mi0yMy45MDkgMjQuMTE3LTQ3LjQwMiAxOS45NiIvPjxwYXRoIGZpbGw9IiNGRkYiIGQ9Ik00OTIuNjUgNTczLjcxNWMuODE2IDIuNDg0LTMuNDEgNi4xMDYtOS40MzYgOC4wOS02LjAzIDEuOTgzLTExLjU4IDEuNTgtMTIuMzk2LS45MDItLjgyLTIuNDgzIDMuNDA1LTYuMTA1IDkuNDM1LTguMDkgNi4wMy0xLjk4MyAxMS41OC0xLjU3OSAxMi4zOTYuOTAyIi8+PHBhdGggZmlsbD0iIzQ4MEQyMSIgZD0iTTUxNS4zMTIgNTM3LjQ2NWMtMzYuOTQzLS40ODItNzMuNTUgNC41OTctOTYuNjI4IDE0LjM5OGE4Ljc3NyA4Ljc3NyAwIDAgMS02Ljg2LTE2LjE1OWMyNi4yNzItMTEuMTU5IDY1LjY1My0xNi4yODcgMTAzLjcxNi0xNS43OSAzNy45NjcuNDk1IDc2LjY0IDYuNjE1IDEwMS4xODkgMTkuNDc0YTguNzc3IDguNzc3IDAgMSAxLTguMTQ1IDE1LjU1QzU4Ny43MDYgNTQ0IDU1Mi4zNSA1MzcuOTUgNTE1LjMxMiA1MzcuNDY1Ii8+PHBhdGggZmlsbD0iI0ZGRiIgZD0iTTM2Ny4yNTYgNTM4LjEyNGE4Ljc4NiA4Ljc4NiAwIDEgMCAwLTE3LjU3MiA4Ljc4NiA4Ljc4NiAwIDAgMCAwIDE3LjU3Mm0yODYuNjM4IDBhOC43ODYgOC43ODYgMCAxIDAgLjAwMy0xNy41NzUgOC43ODYgOC43ODYgMCAwIDAtLjAwMyAxNy41NzUiLz48cGF0aCBmaWxsPSIjRkZGMkRGIiBkPSJNMTUwLjkzNSA5NTUuMDQ0Yy0yMi41MzQgMTAuNTktNjcuNzQgMjAuMTQ2LTY4LjI4LTI2LjM2Ny0uNjc2LTU4LjE0IDI3LjA0Mi0xNjguMzM0IDE0NS4zNDktMTM3LjkxMnMxMzEuMTUgMTIxLjAxIDEyNS43NDEgMTM3LjkxMmMtNS40MDcgMTYuOTAyLTE2Ljg5OSA0MC41NjItNTQuNzU3IDI2LjM2Ny05LjI0IDIyLjUzNC0zNy41OSA1Ny4wNTctNzcuMDcgMTQuODcxLTE1LjA5NiAxMy4yOTgtNTAuNDMzIDI4LjkzNi03MC45ODMtMTQuODcxbTcyNS4wMzYgMGMyMi41MzMgMTAuNTkgNjcuNzM5IDIwLjE0NiA2OC4yOC0yNi4zNjcuNjc2LTU4LjE0LTI3LjA0Mi0xNjguMzM0LTE0NS4zNS0xMzcuOTEycy0xMzEuMTUgMTIxLjAxLTEyNS43NDQgMTM3LjkxMmM1LjQxIDE2LjkwMiAxNi45MDIgNDAuNTYyIDU0Ljc2IDI2LjM2NyA5LjI0IDIyLjUzNCAzNy41ODcgNTcuMDU3IDc3LjA3IDE0Ljg3MSAxNS4wOTcgMTMuMjk4IDUwLjQzMyAyOC45MzYgNzAuOTg0LTE0Ljg3MSIvPjxwYXRoIGZpbGw9IiM4MzUxMDQiIGQ9Ik05Ny4yOCA5MjguNTA4Yy0uMzE2LTI3LjQwOCA2LjE5NC02Ni4wNTQgMjUuNDI3LTkzLjYyNiA5LjQyMS0xMy41MDIgMjEuNjY4LTI0LjA3IDM3LjU2LTI5LjgyMiAxNS45MDgtNS43NiAzNi43NDUtNy4xNiA2NC4wOTEtLjEyNiA1NS41NjYgMTQuMjg2IDg1LjExOCA0Mi4yNDUgMTAwLjQwMiA2Ny40NDQgNy43MzkgMTIuNzU5IDExLjk0MyAyNS4wMTggMTMuOTE4IDM0Ljc5NS45ODkgNC44OTUgMS4zOTUgOS4wNDQgMS40NDUgMTIuMjAzLjA0NyAzLjE3OC0uMjcyIDQuNjctLjMwNyA0LjgzbC0uMDAzLjAxNWMtMi41ODMgOC4wNzgtNS43IDE0LjMxLTEwLjA5NCAxNy42MjgtMy4xMyAyLjM2NC05LjgyNCA1LjQxMi0yNS41OTctLjUwM2wtMTMuMjg2LTQuOTgzLTUuMzgzIDEzLjEzYy00LjAxMSA5Ljc4NC0xMS40OTggMjAuMDg5LTE5Ljg2NSAyNC4wMTItMy42NjYgMS43MTUtNy42MDEgMi4yOTQtMTIuMzE4Ljk2OS01LjAyLTEuNDA4LTEyLjAwMS01LjI4Ny0yMC42Ny0xNC41NTNsLTkuNjk5LTEwLjM2My0xMC42NSA5LjM4Yy02LjA0NyA1LjMyNS0xNS4zODggMTAuMjY2LTIzLjg4NSAxMC4zMjhhMTkuMSAxOS4xIDAgMCAxLTExLjQzLTMuNTVjLTMuODU3LTIuNjg4LTguNDM1LTcuNjctMTIuNzU3LTE2Ljg4NmwtNi4yMi0xMy4yNS0xMy4yNDcgNi4yMjVjLTEwLjE4OCA0Ljc5LTIzLjk5MSA4LjQ4NS0zNC4wMjMgNi45OTgtNC41OC0uNjc4LTcuMzczLTIuMjctOS4xNy00LjM3Ny0xLjgzMS0yLjE1My00LjEyOC02LjYxNS00LjIzNi0xNS45MTh6bTEzNC4zNjYtMTUxLjkxYy0zMS44MDItOC4xOC01OC44LTcuMjExLTgxLjM0Ljk1Mi0yMi41NTggOC4xNjgtMzkuMzggMjMuMDgtNTEuNTk1IDQwLjU5LTI0LjAzMiAzNC40NTctMzEuMDQyIDc5Ljk3NS0zMC42ODUgMTEwLjcwNy4xNjQgMTMuOTUzIDMuNzE4IDI1Ljc0IDExLjIxNyAzNC41NDcgNy41NCA4Ljg1IDE3LjU1NCAxMi45MjkgMjcuMTYgMTQuMzUgMTIuOTMxIDEuOTE3IDI2LjcyMy0uNjg3IDM4LjA2My00LjQyNiA0LjU5MyA2LjgzMSA5Ljg1NyAxMi4zIDE1Ljc0MyAxNi40MDFhNDguMzUgNDguMzUgMCAwIDAgMjguMzY4IDguODA0YzEyLjE0Mi0uMDg4IDIzLjI4OS00LjQxMiAzMi4wNDItOS42NTggOC4wODcgNi44MDggMTYuMzM1IDExLjQyIDI0Ljc0NiAxMy43NzcgMTEuOTkgMy4zNjUgMjMuMTIyIDEuODExIDMyLjYzNi0yLjY0NSAxMi44NDQtNi4wMTggMjIuMjgzLTE3LjAzNiAyOC41MzUtMjcuNDg3IDE2LjM3MiAzLjUwOCAzMC4wNTYuODEgNDAuODE0LTcuMzE0IDEyLjE3LTkuMTkgMTcuNTA3LTIzLjIzOSAyMC4zMy0zMi4wNiAyLjQ4Ny03Ljc3NCAyLjE0Mi0xOS41NS0uMzI0LTMxLjc1Ni0yLjYwNy0xMi45MS03Ljk5My0yOC4zNy0xNy41ODEtNDQuMTc1LTE5LjM2Mi0zMS45MjUtNTUuMzg3LTY0LjQ3NC0xMTguMTI5LTgwLjYwNm02OTcuOTc2IDE1MS45MWMuMzItMjcuNDA4LTYuMTktNjYuMDU0LTI1LjQyNC05My42MjYtOS40MTgtMTMuNTAyLTIxLjY3LTI0LjA3LTM3LjU2LTI5LjgyMi0xNS45MDgtNS43Ni0zNi43NDUtNy4xNi02NC4wOTQtLjEyNi01NS41NjIgMTQuMjg2LTg1LjExNSA0Mi4yNDUtMTAwLjM5OSA2Ny40NDQtNy43MzggMTIuNzU5LTExLjk0MyAyNS4wMTgtMTMuOTE4IDM0Ljc5NS0uOTg4IDQuODk1LTEuMzk1IDkuMDQ0LTEuNDQ1IDEyLjIwMy0uMDUgMy4xNzguMjcyIDQuNjcuMzA3IDQuODNsLjAwMy4wMTVjMi41ODQgOC4wNzggNS43IDE0LjMxIDEwLjA5NCAxNy42MjggMy4xMyAyLjM2NCA5LjgyNSA1LjQxMiAyNS41OTQtLjUwM2wxMy4yODktNC45ODMgNS4zODMgMTMuMTNjNC4wMTEgOS43ODQgMTEuNDk4IDIwLjA4OSAxOS44NjYgMjQuMDEyIDMuNjY2IDEuNzE1IDcuNiAyLjI5NCAxMi4zMi45NjkgNS4wMTctMS40MDggMTEuOTk4LTUuMjg3IDIwLjY2Ny0xNC41NTNsOS42OTktMTAuMzYzIDEwLjY1IDkuMzhjNi4wNDQgNS4zMjUgMTUuMzg2IDEwLjI2NiAyMy44ODUgMTAuMzI4YTE5LjEgMTkuMSAwIDAgMCAxMS40My0zLjU1YzMuODU3LTIuNjg4IDguNDM2LTcuNjcgMTIuNzU3LTE2Ljg4Nmw2LjIyLTEzLjI1IDEzLjI0OCA2LjIyNWMxMC4xODcgNC43OSAyMy45OSA4LjQ4NSAzNC4wMiA2Ljk5OCA0LjU4MS0uNjc4IDcuMzc1LTIuMjcgOS4xNzItNC4zNzcgMS44MzEtMi4xNTMgNC4xMjgtNi42MTUgNC4yMzYtMTUuOTE4TTc5NS4yNiA3NzYuNTk4YzMxLjgwNS04LjE4IDU4Ljc5OC03LjIxMSA4MS4zNC45NTIgMjIuNTYgOC4xNjggMzkuMzc4IDIzLjA4IDUxLjU5NiA0MC41OSAyNC4wMzEgMzQuNDU3IDMxLjA0MSA3OS45NzUgMzAuNjg0IDExMC43MDctLjE2MyAxMy45NTMtMy43MTggMjUuNzQtMTEuMjIgMzQuNTQ3LTcuNTM2IDguODUtMTcuNTUxIDEyLjkyOS0yNy4xNTYgMTQuMzUtMTIuOTMyIDEuOTE3LTI2LjcyNC0uNjg3LTM4LjA2LTQuNDI2LTQuNiA2LjgzMS05Ljg2IDEyLjMtMTUuNzQ3IDE2LjQwMWE0OC4zNSA0OC4zNSAwIDAgMS0yOC4zNjggOC44MDRjLTEyLjE0MS0uMDg4LTIzLjI4OC00LjQxMi0zMi4wNDItOS42NTgtOC4wODcgNi44MDgtMTYuMzM0IDExLjQyLTI0Ljc0NiAxMy43NzctMTEuOTkgMy4zNjUtMjMuMTIyIDEuODExLTMyLjYzNi0yLjY0NS0xMi44NDQtNi4wMTgtMjIuMjgyLTE3LjAzNi0yOC41MzUtMjcuNDg3LTE2LjM3MiAzLjUwOC0zMC4wNTUuODEtNDAuODEzLTcuMzE0LTEyLjE3MS05LjE5LTE3LjUwOC0yMy4yMzktMjAuMzMxLTMyLjA2LTIuNDg3LTcuNzc0LTIuMTQyLTE5LjU1LjMyNS0zMS43NTYgMi42MDYtMTIuOTEgNy45OTMtMjguMzcgMTcuNTgtNDQuMTc1IDE5LjM2My0zMS45MjUgNTUuMzg0LTY0LjQ3NCAxMTguMTI5LTgwLjYwNiIvPjxwYXRoIGZpbGw9IiNFQ0M0OEIiIGQ9Ik0yMDAuMDE0IDM3Ny45NzNjLTIxLjkxNyAxLjEyNCAxOC4wOC0yMzguNDQ2IDg5LjYzMi0yMzkuMDAyIDExLjc3Ni42OTcgNzQuMTQzIDc4LjMyOCA3MS42OCAxMDAuOTM4LTEuMzc4IDEyLjYzOS0zNy43MjcgMzkuODU0LTc3LjI5MiA2OS40Ny0zMS4yMDMgMjMuMzYtNjQuNCA0OC4yMS04NC4wMiA2OC41OTRtNjA4LjgzOCA3LjgzMmMyMS45MTMgMS4xMjQtMjEuOTY3LTI0MC40MjYtOTMuNTE1LTI0MC45ODItMTEuNzc2LjY5My03MC4yNiA4MC4zMDgtNjcuOCAxMDIuOTE4IDEuMzc4IDEyLjYzOSAzNy43MyAzOS44NTQgNzcuMjk0IDY5LjQ3IDMxLjIgMjMuMzU3IDY0LjQgNDguMjEgODQuMDIgNjguNTk0Ii8+PC9zdmc+) #FFF no-repeat 0.3571em/1.64em;
    }
    #nextCookie {
      top: 3em;
      background: url(data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cGF0aCBmaWxsPSIjMjQ4NmZmIiBkPSJNMTQ1LjY1OSw2OC45NDljLTUuMTAxLTUuMjA4LTEzLjM3Mi01LjIwOC0xOC40NzMsMEw5OS40NzksOTcuMjMzIEw3MS43NzIsNjguOTQ5Yy01LjEtNS4yMDgtMTMuMzcxLTUuMjA4LTE4LjQ3MywwYy01LjA5OSw1LjIwOC01LjA5OSwxMy42NDgsMCwxOC44NTdsNDYuMTgsNDcuMTRsNDYuMTgxLTQ3LjE0IEMxNTAuNzU5LDgyLjU5OCwxNTAuNzU5LDc0LjE1NywxNDUuNjU5LDY4Ljk0OXoiLz48L3N2Zz4NCg==) #FFF no-repeat 0.291em/1.74em;
    }
    #clicker {
      top: 0;
      background: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNjgxODg0MTU4NjEyIiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjE4ODEiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iNzIiIGhlaWdodD0iNzIiPjxwYXRoIGQ9Ik0zMDMuODcyIDM1MS4yNTMzMzNjMjEuMDc3MzMzLTYxLjAxMzMzMyA4OS43MjgtODggMTUzLjE5NDY2Ny02MC4zNzMzMzNsNDA1LjA1NiAxNzYuMjM0NjY3YTE0MC4zMDkzMzMgMTQwLjMwOTMzMyAwIDAgMSA3NC4yNCA3Ny4xNDEzMzNjMjUuMDI0IDY0LjM2MjY2Ny01LjAzNDY2NyAxMzEuNDEzMzMzLTY3LjA5MzMzNCAxNDkuNzgxMzMzbC0xMjEuMzg2NjY2IDM1Ljk2OC00OS42NjQgMTQ1LjQyOTMzNGExMDQuMTcwNjY3IDEwNC4xNzA2NjcgMCAwIDEtNjEuMTYyNjY3IDYzLjkzNmwtOC44NTMzMzMgMy4wMjkzMzNjLTYyLjE4NjY2NyAxOC4yNjEzMzMtMTMyLjY5MzMzMy0xOS4xNzg2NjctMTU3LjYxMDY2Ny04My42MDUzMzNMMzA2LjQxMDY2NyA0MzQuMzQ2NjY3YTEyMC45ODEzMzMgMTIwLjk4MTMzMyAwIDAgMS0yLjU2LTgzLjExNDY2N3ogbTgwLjk2LTI3NC4yODI2NjZjMTA5LjA1NiAwIDIwOCA1OS40OTg2NjcgMjYyLjc4NCAxNTQuMjRhNDcuOTU3MzMzIDQ3Ljk1NzMzMyAwIDAgMS04My4wMjkzMzMgNDhjLTM3Ljk3MzMzMy02NS42MjEzMzMtMTA1LjYtMTA2LjM2OC0xNzkuNzU0NjY3LTEwNi4zNjgtMTE1LjYyNjY2NyAwLTIxMC4xMzMzMzMgOTguMzY4LTIxMC4xMzMzMzMgMjIwLjY1MDY2NiAwIDY4Ljg0MjY2NyAzMC4xNDQgMTMyLjIwMjY2NyA4MC42MTg2NjYgMTczLjc2YTQ3Ljk1NzMzMyA0Ny45NTczMzMgMCAwIDEtNjAuOTcwNjY2IDc0LjAyNjY2N2MtNzIuNTMzMzMzLTU5LjczMzMzMy0xMTUuNTQxMzMzLTE1MC4xODY2NjctMTE1LjU0MTMzNC0yNDcuNzg2NjY3IDAtMTc0LjM3ODY2NyAxMzYuNTc2LTMxNi41MjI2NjcgMzA2LjAyNjY2Ny0zMTYuNTIyNjY2eiIgZmlsbD0iIzExOTZkYiIgcC1pZD0iMTg4MiI+PC9wYXRoPjwvc3ZnPg==) #FFF no-repeat 0.3571em/1.88em;
    }
    #open_url {
      top: 3em;
      background: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNjcyMDI0OTU1NzcxIiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9Ijk0ODkiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiPjxwYXRoIGQ9Ik02NjQuNTc2IDg5Ni40MjY2NjdsMTA4LjU4NjY2Ny0xMDguNTg2NjY3aC0zMDEuMDEzMzM0di01OS43MzMzMzNoMzAxLjY1MzMzNGwtMTA5LjIyNjY2Ny0xMDkuMjI2NjY3IDQyLjI0LTQyLjI0IDE4MC45OTIgMTgxLjAzNDY2N0w3MDYuODE2IDkzOC42NjY2Njd6TTQ3MS44OTMzMzMgOTM4LjY2NjY2N0gyMDAuMTQ5MzMzYTYzLjYxNiA2My42MTYgMCAwIDEtMjQuOTE3MzMzLTUuMDM0NjY3IDY0IDY0IDAgMCAxLTEwLjg4LTUuODg4IDY0LjI5ODY2NyA2NC4yOTg2NjcgMCAwIDEtOS40NzItNy44MDggNjQuODk2IDY0Ljg5NiAwIDAgMS03LjgwOC05LjQ3MiA2NCA2NCAwIDAgMS01Ljg4OC0xMC44OCA2My42NTg2NjcgNjMuNjU4NjY3IDAgMCAxLTUuMDM0NjY3LTI0LjkxNzMzM3YtNzI1LjMzMzMzNGE2My42NTg2NjcgNjMuNjU4NjY3IDAgMCAxIDUuMDM0NjY3LTI0LjkxNzMzMyA2NCA2NCAwIDAgMSA1Ljg4OC0xMC44OCA2NC4zODQgNjQuMzg0IDAgMCAxIDcuODA4LTkuNDcyIDY0IDY0IDAgMCAxIDkuNDcyLTcuODA4IDY0IDY0IDAgMCAxIDEwLjg4LTUuODg4QTYzLjYxNiA2My42MTYgMCAwIDEgMjAwLjE0OTMzMyA4NS4zMzMzMzNoNDA1LjMzMzMzNGwyMTMuMzMzMzMzIDIxMy4zMzMzMzR2MjM0LjY2NjY2NmgtNTkuNzMzMzMzVjM4NGgtMjM4LjkzMzMzNFYxNDUuMDY2NjY3aC0zMjQuMjY2NjY2djczMy44NjY2NjZoMjc2LjAxMDY2NlY5MzguNjY2NjY3eiBtMTA3Ljk4OTMzNC02MTQuNGgxNzkuMnYtMC43NjhsLTE3OS4yLTE3OS4yIDAuNzY4IDAuNzY4aC0wLjc2OHoiIHAtaWQ9Ijk0OTAiIGZpbGw9IiMxMjk2ZGIiPjwvcGF0aD48L3N2Zz4=) #FFF no-repeat 0.3571em/1.88em;
    }
    #reload {
      top: 6em;
      background: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNjgwNzU0MTA2MjQwIiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9Ijc4MTAiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiPjxwYXRoIGQ9Ik05NTAuMzcxMDcyIDUzMi43OTU2MjlsLTg0LjM5ODIwMi04NC4zOTMwODVjLTYuMTAxOTc1LTYuMDk2ODU4LTE0LjA5Mzk5Ni05LjE0NTI4Ny0yMi4wODcwNDEtOS4xNDMyNDEtNy45OTUwOTEtMC4wMDEwMjMtMTUuOTg4MTM2IDMuMDQ3NDA2LTIyLjA3OTg3OCA5LjE0ODM1N2wtODQuNTE5OTc1IDg0LjUzMDIwOWMtMTIuMjAwODggMTIuMTk1NzYzLTEyLjIwMDg4IDMxLjk3MTE1NiAwIDQ0LjE3MTAxMiA2LjA5OTkyOCA2LjA5NDgxMiAxNC4wOTE5NSA5LjE0NTI4NyAyMi4wODI5NDggOS4xNDUyODdzMTUuOTkzMjUzLTMuMDUwNDc2IDIyLjA4Mjk0OC05LjE1MDQwNGwzMy4xNzE0OTQtMzMuMTc1NTg3Yy0xNi4wMTk4NTkgMTc1LjMzMDIxNC0xNjMuODEzOTI2IDMxMy4xNDUtMzQzLjI1MDY2OCAzMTMuMTQ1LTE5MC4wOTY1MjMgMC0zNDQuNzQ5ODEyLTE1NC42NTMyODktMzQ0Ljc0OTgxMi0zNDQuNzQ5ODEyczE1NC42NTMyODktMzQ0Ljc1NDkyOCAzNDQuNzQ5ODEyLTM0NC43NTQ5MjhjOTIuMDg0MjU1IDAgMTc4LjY1ODAwNiAzNS44NTk3MTkgMjQzLjc3OTE2NiAxMDAuOTc1NzYyIDEyLjIwMDg4IDEyLjIwMDg4IDMxLjk2NjAzOSAxMi4yMDA4OCA0NC4xNjY5MTkgMCAxMi4yMDA4OC0xMi4xOTU3NjMgMTIuMjAwODgtMzEuOTcxMTU2IDAtNDQuMTY2OTE5LTc2LjkxNDc2NC03Ni45MTk4OC0xNzkuMTc2ODIyLTExOS4yNzY1Ny0yODcuOTQ2MDg1LTExOS4yNzY1Ny0yMjQuNTQzMDU2IDAtNDA3LjIxNzUzOSAxODIuNjc5NTk5LTQwNy4yMTc1MzkgNDA3LjIyMjY1NSAwIDIyNC41Mzc5MzkgMTgyLjY3NDQ4MyA0MDcuMjE3NTM5IDQwNy4yMTc1MzkgNDA3LjIxNzUzOSAyMTIuNjA0MTQyIDAgMzg3LjU3NDE1My0xNjMuODAwNjIzIDQwNS41OTE1MDUtMzcxLjgwODA3NGwyOS4yMzk5NTEgMjkuMjM4OTI4YzYuMDk5OTI4IDYuMDk0ODEyIDE0LjA5MTk1IDkuMTQ1Mjg3IDIyLjA4Mjk0OCA5LjE0NTI4NyA3Ljk5MDk5OCAwIDE1Ljk4MzAyLTMuMDUwNDc2IDIyLjA4Mjk0OC05LjE1MDQwNEM5NjIuNTcxOTUyIDU2NC43NzA4NzcgOTYyLjU3MTk1MiA1NDQuOTk1NDg1IDk1MC4zNzEwNzIgNTMyLjc5NTYyOXoiIGZpbGw9IiMxMTk2ZGIiIHAtaWQ9Ijc4MTEiPjwvcGF0aD48cGF0aCBkPSJNNDExLjI0NDI0OCA0MjkuMDk5OTE4bDIyLjA4Mjk0OC0yMi4wODI5NDhjMTIuMjAwODgtMTIuMTk1NzYzIDEyLjIwMDg4LTMxLjk3MTE1NiAwLTQ0LjE2NjkxOS0xMi4yMDA4OC0xMi4yMDA4OC0zMS45NjYwMzktMTIuMjAwODgtNDQuMTY2OTE5IDBsLTIyLjA4Mjk0OCAyMi4wODI5NDhjLTEyLjIwMDg4IDEyLjE5NTc2My0xMi4yMDA4OCAzMS45NzExNTYgMCA0NC4xNjY5MTkgNi4wOTk5MjggNi4wOTk5MjggMTQuMDkxOTUgOS4xNTA0MDQgMjIuMDgyOTQ4IDkuMTUwNDA0UzQwNS4xNDMyOTcgNDM1LjE5OTg0NyA0MTEuMjQ0MjQ4IDQyOS4wOTk5MTh6IiBmaWxsPSIjMTE5NmRiIiBwLWlkPSI3ODEyIj48L3BhdGg+PHBhdGggZD0iTTU2NS44NDYzNzIgNTM5LjUzNjE0NmwtMjIuMDgyOTQ4IDIyLjA4Mjk0OGMtMTIuMjAwODggMTIuMTk1NzYzLTEyLjIwMDg4IDMxLjk3MTE1NiAwIDQ0LjE2NjkxOSA2LjA5OTkyOCA2LjA5OTkyOCAxNC4wOTE5NSA5LjE1MDQwNCAyMi4wODI5NDggOS4xNTA0MDRzMTUuOTgzMDItMy4wNTA0NzYgMjIuMDgyOTQ4LTkuMTUwNDA0bDIyLjA4Mjk0OC0yMi4wODI5NDhjMTIuMjAwODgtMTIuMTk1NzYzIDEyLjIwMDg4LTMxLjk3MTE1NiAwLTQ0LjE2NTg5NkM1OTcuODEyNDExIDUyNy4zMzUyNjcgNTc4LjA0NzI1MiA1MjcuMzM1MjY3IDU2NS44NDYzNzIgNTM5LjUzNjE0NnoiIGZpbGw9IiMxMTk2ZGIiIHAtaWQ9Ijc4MTMiPjwvcGF0aD48cGF0aCBkPSJNMzM2LjQ1Mzg2OCA1MjEuMDkzMDk5Yy00Ljg2OTkxNCAyMC42Nzk5OTUtNC44MDk1MzkgNjMuOTk3NTcgMjYuMzczNjcxIDk1LjE3NTY2MyAyMi42NjMxNjIgMjIuNjU4MDQ2IDUxLjk0NDA0NiAyOS4wMzIyMiA3NC4xODA0OSAyOS4wMzIyMiA4LjE5NDYzNiAwIDE1LjQzMzUwNC0wLjg2ODc4NyAyMS4wMjU4NzItMi4xMDQ5NDEgMTYuNjk0MjE3LTMuNjkxMDY1IDI3LjExNTU2OC0yMC4wNzAxMDQgMjMuNjM4MzczLTM2LjgxMDM3MS0zLjQ3NzE5NC0xNi43MzAwMzMtMTkuOTY4Nzk3LTI3LjU3ODEwMi0zNi43NTQwODktMjQuMjU4NDk3LTAuMjUzNzggMC4wMzU4MTYtMjMuNTE2NiA0LjM3NjY4MS0zNy45MjM3MjgtMTAuMDMwNDQ3LTE0LjAxMDA4NS0xNC4wMjAzMTgtOS45NTM2OTktMzUuNTM5NDI0LTkuNjU4OTg3LTM3LjAwMzc3NSAzLjc0MTIwNy0xNi42NzM3NTEtNi42MzkyMTEtMzMuMzAyNDc3LTIzLjMxMjk2Mi0zNy4yMzE5NzNDMzU3LjI2NTg3IDQ5My44OTA1NSAzNDAuNDA4OTQ3IDUwNC4yOTY1NTEgMzM2LjQ1Mzg2OCA1MjEuMDkzMDk5eiIgZmlsbD0iIzExOTZkYiIgcC1pZD0iNzgxNCI+PC9wYXRoPjwvc3ZnPg==) #FFF no-repeat 0.3571em/1.88em;
    }

    #id77_clear {
      top: 9em;
      background: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNjgxNTc1MTYxODExIiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjE1MDIzIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ij48cGF0aCBkPSJNNjc4LjM1MTUxMyA5MTYuMjMwMjA0TDIzOC4zNDYwMzYgOTE1LjEwODU3NmMtMS40MDIwMzYgMC0yLjg1MDgwNiAwLTQuMjUyODQxLTAuMjMzNjczLTI2LjQwNTAwMi0zLjEzMTIxMy02Mi4yMDM2NDItMTcuNzEyMzgyLTc4LjUxMzk4OC00Mi41Mjg0MWE1MS43ODE4NDUgNTEuNzgxODQ1IDAgMCAxLTcuMTAzNjQ3LTQzLjg4MzcxMmMzLjIyNDY4Mi0xMC44ODkxNDIgMTAuMDQ3OTIxLTE5Ljk1NTYzOSAyMC4zMjk1MTUtMzMuNjk1NTg2IDI1LjA0OTcwMS0zMy40NjE5MTQgNzEuNjQ0MDE0LTk1LjcxMjI5MSA2Ny41MzEzNzctMTkyLjAzMjEzLTYuMDI4NzUzLTEzNy41ODY0MTggNzQuMzA3ODgyLTI1MS45NDU3ODEgMjA2Ljc1MzUwMy0yOTguMzUzMTU2VjE4NS43MjI5N2ExMTEuNjQ4NzYxIDExMS42NDg3NjEgMCAwIDEgMTA1LjQ3OTgwNC0xMTIuNzIzNjU1IDExMC4wNTk3ODcgMTEwLjA1OTc4NyAwIDAgMSA4MS43Mzg2NzEgMzAuNDcwOTA1IDExMS40MTUwODggMTExLjQxNTA4OCAwIDAgMSAzNC4zNDk4NjkgODAuMTk2NDMxdjEyMi4zOTc3YTMxNy4wMDAyMjggMzE3LjAwMDIyOCAwIDAgMSAyMDMuMTA4MjExIDI5NS4wMzUwMDVjMCAxMjkuMDM0MDAxLTU4LjgzODc1NyAyNDUuNzc2ODI0LTE1My40NzYxNTQgMzA0Ljc1NTc4NWE2OC4wNDU0NTcgNjguMDQ1NDU3IDAgMCAxLTM1LjkzODg0MyAxMC4zNzUwNjN6IG0tNDM3LjQzNTA3OC03NS44OTY4NTVsNDM1LjMzMjAyNSAxLjA3NDg5M2M3MC45NDI5OTctNDUuMDk4ODA5IDExNi44MzYyOTItMTM5LjE3NTM5MSAxMTYuODM2MjkyLTI0MC4zMDg4ODZBMjQxLjc1NzY1NiAyNDEuNzU3NjU2IDAgMCAwIDYxNy4xNzYwMyAzNjkuMjAyNjg0YTM3LjM4NzYxNCAzNy4zODc2MTQgMCAwIDEtMjcuMjkyOTU4LTM1Ljk4NTU3OHYtMTQ5LjU1MDQ1NWEzNi4wMzIzMTMgMzYuMDMyMzEzIDAgMCAwLTM3LjgwODIyNC0zNS45ODU1NzggMzcuMzg3NjE0IDM3LjM4NzYxNCAwIDAgMC0zNC4yMDk2NjYgMzguMDQxODk3VjMzMS44MTUwN2EzNy4zODc2MTQgMzcuMzg3NjE0IDAgMCAxLTI4LjA0MDcxIDM2LjE3MjUxNkMzOTkuNjczNTg5IDM5Mi4xMDI1OTcgMzA1LjE3NjM5NSA0NjUuNDI5MDU0IDMxMC45MjQ3NDEgNTk5LjUxMDM4M2M1LjE4NzUzMSAxMjAuNjY4NTIzLTUxLjY4ODM3NiAxOTkuMDQyMzA4LTgwLjcxMDUxMSAyMzcuODc4NjkxYTU0Ljg2NjMyMyA1NC44NjYzMjMgMCAwIDAgMTAuNzAyMjA1IDIuOTQ0Mjc1eiIgcC1pZD0iMTUwMjQiIGZpbGw9IiMxMTk2ZGIiPjwvcGF0aD48cGF0aCBkPSJNMjgyLjY1MDM1OCA1NTMuMzM2NjhoNTQ3LjcyODUzOHY3NC43NzUyMjdIMjgyLjY1MDM1OHoiIHAtaWQ9IjE1MDI1IiBmaWxsPSIjMTE5NmRiIj48L3BhdGg+PHBhdGggZD0iTTQzMy43NDMwNTEgNzY5LjI1MDE0OGEzNy4zODc2MTQgMzcuMzg3NjE0IDAgMCAxLTM3LjM4NzYxMy0zNy4zODc2MTN2LTE0MS4xMzgyNDFhMzcuMzg3NjE0IDM3LjM4NzYxNCAwIDAgMSA3NC43NzUyMjcgMHYxNDEuMTM4MjQxYTM3LjM4NzYxNCAzNy4zODc2MTQgMCAwIDEtMzcuMzg3NjE0IDM3LjM4NzYxM3pNNjI0LjY1MzU1MyA3MjUuMjcyOTY4YTM3LjM4NzYxNCAzNy4zODc2MTQgMCAwIDEtMzcuMzg3NjE0LTM3LjM4NzYxNFY1OTAuNzI0Mjk0YTM3LjM4NzYxNCAzNy4zODc2MTQgMCAwIDEgNzQuNzc1MjI4IDB2OTcuMTYxMDZhMzcuMzg3NjE0IDM3LjM4NzYxNCAwIDAgMS0zNy4zODc2MTQgMzcuMzg3NjE0eiIgcC1pZD0iMTUwMjYiIGZpbGw9IiMxMTk2ZGIiPjwvcGF0aD48L3N2Zz4=) #FFF no-repeat 0.3571em/1.88em;
    }
    .vc-panel {
      z-index: 100000 !important;
    }
    #_${prefix}_top {
      position: fixed;
      z-index: 99999;
      top: 22%;
      right: 0;
    }
    #_${prefix}_bottom {
      position: fixed;
      z-index: 99999;
      bottom: 32%;
      right: 0;
    }
    ._${prefix}_id77_btn, ._${prefix}_id77_btn_b {
      position: absolute;
      right: 0;
      box-sizing: content-box;
      width: 1.14em;
      height: 2.1429em;
      padding: 0 1.4286em 0 0;
      border: 1px solid rgba(255,255,255,0.8);
      background: #FFF;
      border-radius: 50px 0 0 50px;
      background-size: 80%;
      overflow: hidden;
    }
    ._${prefix}_id77_btn img, ._${prefix}_id77_btn_b img {
      box-sizing: content-box;
      max-width: 2.1429em !important;
      width: 2.1429em !important;
      height: 2.1429em !important;
      border: 1px solid rgba(255,255,255,0.8);
      background: #FFF;
      border-radius: 50px 0 0 50px;
    }
    .cks {
      padding: 1.1429em;
      list-style-type: decimal-leading-zero !important;
      margin-left: 2em;
    }
    .cks li {
      list-style-type: decimal-leading-zero !important;
      margin-bottom: 0.7143em;
      border: 0.0714em solid #ccc;
      padding: 0.3571em;
    }
    #_${prefix}_id77_btns { 
      font-size: 14px;
    }
    ._${prefix}_id77_btn._${prefix}_id77_hide {
      display: none !important;
    }
  </style>
  <script ignore>
    const _${prefix}_id77_cookies_tool = Cookies;
    const _${prefix}_id77_domain = window.location.origin;
    const _${prefix}_id77_currentPin = _${prefix}_id77_cookies_tool.get('pt_pin');
    const _${prefix}_id77_currentKey = _${prefix}_id77_cookies_tool.get('pt_key');
    const _${prefix}_id77_needHideSwitch = localStorage.getItem('vConsole_switch_hide') === 'Y';
    const _${prefix}_id77_btnsDom = \`${tools}\`;
    let _${prefix}_selectedDom;

    const _${prefix}_id77_cookies = ${JSON.stringify(cookies)};

    // ck同步最新
    if(_${prefix}_id77_currentPin && !"${url}".includes('/login')) {
      // console.log('_${prefix}_id77_currentPin', encodeURI(_${prefix}_id77_currentPin));
      for (const ck of _${prefix}_id77_cookies) {
        const _pin = ck.match(/pt_pin=(.+?);/)[1];
        const _key = ck.match(/pt_key=(.+?);/)[1];
        // console.log('_pin', _pin);
        
        if(_${prefix}_id77_currentKey && _pin === encodeURI(_${prefix}_id77_currentPin) && _key !== _${prefix}_id77_currentKey) {
          _${prefix}_id77_setCookie(ck);
          console.log('已同步 cookie');
        }
      }
    }

    function _${prefix}_id77_clearData() {
      sessionStorage.clear();
      localStorage.clear();

      const domains = [_${prefix}_id77_domain.match(/.*?([^\/]+\.[^.]+)\$/)?.[1]??'', _${prefix}_id77_domain.match(/[^.]+\.(com.cn|net.cn|org.cn|gov.cn|edu.cn)$/)?.[0] || (_${prefix}_id77_domain.match(/.*?([^\.]+.[^.]+)\$/)?.[1]??'')];

      Object.keys(_${prefix}_id77_cookies_tool.get()).forEach(function (cookieName) {
        _${prefix}_id77_cookies_tool.remove(cookieName, {
          expires: 'Thu, 01 Jan 1970 00:00:00 GMT',
        });
        _${prefix}_id77_cookies_tool.remove(cookieName, {
          path: '/',
          expires: 'Thu, 01 Jan 1970 00:00:00 GMT',
        });
        for (let j = domains.length - 1; j >= 0; j--) {
          _${prefix}_id77_cookies_tool.remove(cookieName, {
            domain: '.' + domains[j],
            path: '/',
            expires: 'Thu, 01 Jan 1970 00:00:00 GMT',
          });
        }
      });

    }
    
    function _${prefix}_id77_setCookie(cookie) {

      const domain = _${prefix}_id77_domain.match(/[^.]+\.(com.cn|net.cn|org.cn|gov.cn|edu.cn)\$/)?.[0] || (_${prefix}_id77_domain.match(/.*?([^\.]+.[^.]+)\$/)?.[1]??'');

      const other = { 
        path: '/',
        expires: 8/24,
        // SameSite: 'Strict',
        // secure: true
        domain
      };
      
      _${prefix}_id77_cookies_tool.set('pt_key', cookie.match(/pt_key=(.+?);/)[1], other);
      _${prefix}_id77_cookies_tool.set('pt_pin', decodeURI(cookie.match(/pt_pin=(.+?);/)[1]), other);

    }

    function _${prefix}_id77_changeCookie(cookie){
      _${prefix}_id77_clearData();
      _${prefix}_id77_setCookie(cookie);
      window.location.reload();
    }

    function _${prefix}_id77_nextCookie() {
      const cookieDomList = document.querySelectorAll("._${prefix}_id77_cookieDom"); 
      const cookieDom = document.querySelector("#_" + _${prefix}_id77_currentPin);

      const index = [].indexOf.call(cookieDomList, cookieDom);

      _${prefix}_id77_changeCookie(_${prefix}_id77_cookies[index + 1]);
    }

    // const _script = document.createElement('script');
    // _script.src = "https://unpkg.com/vconsole@3.12.0/dist/vconsole.min.js";
    // // _script.src = "https://unpkg.com/vconsole@latest/dist/vconsole.min.js";
    // // _script.doneState = { loaded: true, complete: true};
    // _script.onload = function() {
      
    // };

    // _${prefix}_id77_onReady(_${prefix}_id77_init);

    // function _${prefix}_id77_onReady(fn){
    //   try {
    //     const readyState = document.readyState;
    //     if(readyState === 'interactive' || readyState === 'complete') {
    //       fn()
    //     }else{
    //       window.addEventListener("DOMContentLoaded",fn);
    //     }
        
    //   } catch (error) {
    //     console.error(arguments.callee.name, error);
    //   }
    // }

    function _${prefix}_id77_changeBtns() {
      const \$btns = document.querySelectorAll('._${prefix}_id77_btn');
      Array.prototype.forEach.call(\$btns, function(el, i){
        if (el.classList.contains('_${prefix}_id77_hide')){
          el.classList.remove('_${prefix}_id77_hide');
        } else {
          el.classList.add('_${prefix}_id77_hide');
        }
      });
    }

    function _${prefix}_id77_changeTabs() {
      const \$tabs = document.querySelectorAll('.vc-tab');
      Array.prototype.forEach.call(\$tabs, function(el, i){
        if (i === 0 || i === 2 || i > 3) return;
        if (el.classList.contains('_${prefix}_id77_hide')){
          el.classList.remove('_${prefix}_id77_hide');
        } else {
          el.classList.add('_${prefix}_id77_hide');
        }
      });
    }

    function _${prefix}_id77_changeMitmUI() {
      const vcSwitch = document.querySelector('.vc-switch');
      if (vcSwitch.style.display == 'none') {
         _${prefix}_id77_vConsole.showSwitch();
        localStorage.setItem('vConsole_switch_hide', 'N')
      } else {
         _${prefix}_id77_vConsole.hideSwitch();
        localStorage.setItem('vConsole_switch_hide', 'Y')
      }

      _${prefix}_id77_changeBtns();
      // if (_${prefix}_id77_cookies.length > 0) _${prefix}_id77_changeBtns();

      if (window._${prefix}_id77_captchaRecognizer && window._${prefix}_id77_captchaRecognizer._cachedImgs) {
        const currentDisplay = window._${prefix}_id77_captchaRecognizer._captchaButton.style.display;
        window._${prefix}_id77_captchaRecognizer._captchaButton.style.display = currentDisplay === "none" ? "flex" : "none";
      }
      
    }

    document.addEventListener('click', function (e) {
      const excludeElement = document.getElementById('__vconsole'); // 要排除的元素

      // 判断点击的元素是否是排除元素本身或其子元素
      if (excludeElement && excludeElement.contains(event.target)) {
          return; // 直接返回，不执行后续逻辑
      }
      _${prefix}_selectedDom = e.target;
    });
    
    document.addEventListener('dblclick', function (e) {
      _${prefix}_id77_changeMitmUI();

      // 解锁input相册功能
      [].map.call(document.querySelectorAll('input[capture]'), item => {
        item.removeAttribute("capture");
      })

      if ('${$.hideDomClass}') {
        [].map.call(document.querySelectorAll('${$.hideDomClass}'), item => {
          item.style.display = 'none';
        })
      }

      // 解除按钮禁用
      [].map.call(document.querySelectorAll('button[disabled],[class*="disable" i]'), item => {
        item.style.cssText = item.style.cssText.replace('display: none;', '');
        item.className = item.className.replace('disable', '');
        item.removeAttribute("disabled");
      });

      [].map.call(document.querySelectorAll('[disabled]'), item => {
        item.removeAttribute("disabled");
      })
    });
    
    function _${prefix}_id77_init () {
      document.querySelector('body').insertAdjacentHTML('beforeend', _${prefix}_id77_btnsDom);

      const _${prefix}_id77_btnIDs = [
      ];
      
      if (_${prefix}_id77_btnIDs.length > 0) {
        for (const _btnID of _${prefix}_id77_btnIDs) {
          const _btn = document.querySelector('#' + _btnID);

          if (_btn) {
            _btn.addEventListener('click',() => {
              _${prefix}_id77_copyText('https://item.jd.com/${sku}.html?' + Math.random());
              window.location.href= _btnID + '://';
            })
          }
        }
      }

      try {

        if(!window.localStorage) {
          window.localStorage = window.localStorageCopy
        }
        if(!window.sessionStorage) {
          window.sessionStorage = window.sessionStorageCopy
        }

        // 券链接 展示
        __showCouponLink = false;
        function showCouponLink() {
           if (__showCouponLink) return;
           const \$jdCouponDoms = document.querySelectorAll('div[roleid]');
            if (\$jdCouponDoms.length > 0) {
              Array.prototype.forEach.call(\$jdCouponDoms, function(el, i){
                  el.insertAdjacentElement('afterend', createDom('https://coupon.m.jd.com/coupons/show.action?key='+ el.getAttribute("key") + '&roleId=' + el.getAttribute("roleid")));
              });
              __showCouponLink = true;
            }

            const \$jdlifeCouponDoms = document.querySelectorAll('.prodFavorableInfo-wrap-couponitem');
            if (\$jdlifeCouponDoms.length > 0) {
              Array.prototype.forEach.call(\$jdlifeCouponDoms, function(el, i){
                  const \$dom = el.querySelector('div[data-roleid]')
                  if (\$dom)
                    el.insertAdjacentElement('afterend', createDom('https://coupon.m.jd.com/coupons/show.action?key='+ \$dom.getAttribute("data-encryptedkey") + '&roleId=' + \$dom.getAttribute("data-roleid")));
              });
              __showCouponLink = true;
            }
        }

        showCouponLink();

        document.addEventListener('click', (e) => {
            showCouponLink();
        })

        const \$fPromoComb = document.querySelector('#fPromoComb');
        if (\$fPromoComb) {
           \$fPromoComb.addEventListener('click', (e) => {
            const \$jxCouponDoms = document.querySelectorAll('.jxcoupon-item');
            if (\$jxCouponDoms.length > 0 && window._ITEM_DATA && _ITEM_DATA.floors) {
              const couponInfo = _ITEM_DATA.floors.filter(o => o.fId === 'fPromoComb')[0].fData.coupon.couponInfo;
              Array.prototype.forEach.call(\$jxCouponDoms, function(el, i){
                  el.insertAdjacentElement('afterend', createDom('https://coupon.m.jd.com/coupons/show.action?key='+ couponInfo[i].encryptedKey + '&roleId=' + couponInfo[i].roleId));
              });
              __showCouponLink = true;
            }
          })
        }
        const  _${prefix}_id77_vConsoleOptions = {
          onReady: () => {
            setTimeout(() => {
              console.log("初始化成功${prefix}");
              console.info(window.location.href);
              if (${$.seckill}) {
                console.log('#seckill');
                let \$seckillSubDom;
                setInterval(() => { 
                  if (!\$seckillSubDom) \$seckillSubDom = document.querySelector('button.submit-btn');
                  if(\$seckillSubDom) {
                    \$seckillSubDom.click();
                    console.count('seckill');
                  }
                }, 600);
              }
            },3000);
          }
        }

        Map = _${prefix}_id77_Map;
        window._${prefix}_id77_vConsole = new VConsole(_${prefix}_id77_vConsoleOptions);
        if (_${prefix}_id77_needHideSwitch) {
           _${prefix}_id77_vConsole.hideSwitch(); 
        }
        console.log(window._${prefix}_id77_vConsole.version);
  
        const ID77Plugin = new VConsole.VConsolePlugin("id77_plugin", "工具");

        ID77Plugin.on('renderTab', function (callback) {
          const html = \`
                        ${cookieListDom}
                      \`;

          callback(html);
        });
        
        ID77Plugin.on("addTool", function (callback) {
         
          const toolList = [];
          toolList.push({
            name: "显隐图标",
            global: false,
            onClick: function (event) {
              _${prefix}_id77_vConsole.hide();
              _${prefix}_id77_changeBtns();
            },
          });
  
          toolList.push({
            name: "其他工具",
            global: true,
            onClick: function (event) {
              _${prefix}_id77_changeTabs();
            },
          });

          window._${prefix}_id77_submit = null;
          window._${prefix}_id77_submit2 = null;

          if (/jd\\.com\\/mall\\/active\\/(.+?)\\/index\\.html/.test(window.location.href)) {
            const id = window.location.href.match(/jd\\.com\\/mall\\/active\\/(.+?)\\/index\\.html/)?.[1];

            if (id) {
              toolList.push({
                name: "转",
                global: true,
                onClick: function (event) {
                  window.location.href = "https://h5static.m.jd.com/mall/active/" + id + "/index.html";
                }
              })
            }
          }
          
          if (/coupon\\.m\\.jd\\.com\\/coupons\\/show\\.action/.test(window.location.href)) {
            const id = ${couponId};

            if (id) {
              toolList.push({
                name: "转",
                global: true,
                onClick: function (event) {
                  window.location.href = "https://so.m.jd.com/list/couponSearch.action?couponbatch=" + id;
                }
              })
            }
          }
          toolList.push({
            name: "抢",
            global: true,
            onClick: function (event) {
              if (!window._${prefix}_id77_submit) {
                window._${prefix}_id77_submit = setInterval(() => {
                  let dom = document.querySelector('.confirm-button');
                  if (!dom) {
                    dom = document.querySelector('button.submit-btn');
                  }
                  if (!dom) {
                    dom = document.querySelector('.free_coupon a.coupon');
                    // document.querySelector('.free_coupon').click();
                  }
                  if (!dom) {
                    dom = document.querySelector('.coupon-get');
                  }
                  if (dom) dom.click();
                  //document.querySelector('.coupon-btns .btn').click();
                }, ${click_interval});
                _${prefix}_id77_vConsole.hide();
              } else {
                clearInterval(window._${prefix}_id77_submit);
                window._${prefix}_id77_submit = null;
              }

              if (!window._${prefix}_id77_submit2) {
                const dom2 = document.querySelector('.buyBtn2');
                const dom3 = document.querySelector('.van-toast');

                if (dom2) {
                  window._${prefix}_id77_submit2 = setInterval(()=>{
                      const flag = dom3.style.display === 'none';
                      console.log(flag)

                      if (!flag) {
                          dom2.disabled = 1;
                          dom2.style.backgroundColor = '#c2c2c2';
                      } else {
                          dom2.disabled = 0;
                          dom2.style.backgroundColor = '';
                      }
                      dom2.click();
                  }, ${click_interval});
                  _${prefix}_id77_vConsole.hide();
                }
              } else {
                clearInterval(window._${prefix}_id77_submit2);
                window._${prefix}_id77_submit2 = null;
              }

              if($) {
                $('.btn_q').removeClass('disable');

                $('.btn_q').on('click', function () {
                  var dates = new Date();
                  // 抢券后改变样式布局
                  if (dates.getHours() > gifthours) {
                    var rand = Math.floor(Math.random() * 100 + 1);
                    var _this = $(this);
                    var money = $(this).parent().data('mon');
                    $('.btn_q').addClass('qiang disable');
                    $('.btn_q').css({ color: '#fff', background: '#ddd' });
                    $('.btn_q').html('努力抢券');
                    if (rand % 2 != 0) {
                      $.ajax({
                        type: 'POST',
                        url: 'ajax.php',
                        data: { a: money },
                        dataType: 'json',
                        success: function (data) {
                          if (data.flag == 1) {
                            errorMsgShow($('.error-msg'), data.info);
                            _this.hide();
                            _this.parent().find('.xx').show();
                            _this.parent().find('.xx').html('已领取');
                            setTimeout(function () {
                              $('.btn_q').removeClass('qiang disable');
                              $('.btn_q').html('领取');
                              $('.btn_q').css({ color: '#f60401', background: '#ffe5e4' });
                            }, 9000);
                          } else if (data.flag == 2) {
                            errorMsgShow($('.error-msg'), data.info);
                            _this.hide();
                            _this.parent().find('.xx').html('!已抢完!');
                            _this.parent().find('.xx').show();
                            setTimeout(function () {
                              $('.btn_q').removeClass('qiang disable');
                              $('.btn_q').html('领取');
                              $('.btn_q').css({ color: '#f60401', background: '#ffe5e4' });
                            }, 9000);
                          } else if (data.flag == 3) {
                            errorMsgShow($('.error-msg'), data.info);
                            _this.hide();
                            _this.parent().find('.xx').html('已领取');
                            _this.parent().find('.xx').show();
                            setTimeout(function () {
                              $('.btn_q').removeClass('qiang disable');
                              $('.btn_q').html('领取');
                              $('.btn_q').css({ color: '#f60401', background: '#ffe5e4' });
                            }, 9000);
                          } else {
                            errorMsgShow($('.error-msg'), data.info);
                            setTimeout(function () {
                              $('.btn_q').removeClass('qiang disable');
                              $('.btn_q').html('领取');
                              $('.btn_q').css({ color: '#f60401', background: '#ffe5e4' });
                            }, 9000);
                          }
                        },
                        error: function () {
                          errorMsgShow($('.error-msg'), '活动太火爆，请稍后..');
                          setTimeout(function () {
                            $('.btn_q').removeClass('qiang disable');
                            $('.btn_q').html('领取');
                            $('.btn_q').css({ color: '#f60401', background: '#ffe5e4' });
                          }, 9000);
                        },
                      });
                    } else {
                      errorMsgShow($('.error-msg'), '活动太火爆，请稍后.');
                      setTimeout(function () {
                        $('.btn_q').removeClass('qiang disable');
                        $('.btn_q').html('领取');
                        $('.btn_q').css({ color: '#f60401', background: '#ffe5e4' });
                      }, 8000);
                    }
                  } else {
                    errorMsgShow($('.error-msg'), '活动还未开始');
                  }
                });

              }
            },
          });

          toolList.push({
            name: "改",
            global: true,
            onClick: function (event) {
              if (_${prefix}_selectedDom) {
                _${prefix}_selectedDom.contentEditable = true;
                _${prefix}_selectedDom.focus();

                _${prefix}_id77_vConsole.hide();
              }

            },
          });

          toolList.push({
            name: "隐",
            global: true,
            onClick: function (event) {
              if (_${prefix}_selectedDom) {
                let element = _${prefix}_selectedDom;

                while (element) {
                    const style = window.getComputedStyle(element);

                    // 获取 position 和 z-index
                    const position = style.position;
                    const zIndex = parseInt(style.zIndex, 10);

                    // 判断是否符合条件
                    if ((position === 'absolute' || position === 'fixed') && zIndex > 1) {
                        element.style.display = 'none'; // 隐藏符合条件的元素
                        break; // 结束循环
                    }

                    // 向上查找父级元素
                    element = element.parentElement;
                }
                _${prefix}_id77_vConsole.hide();

              }

            },
          });
  
          const cksDom = document.querySelector('#cks');
          cksDom.addEventListener('click', (e) => {
             _${prefix}_id77_vConsole.show();
             _${prefix}_id77_vConsole.showPlugin("id77_plugin");
            e.stopPropagation();
          })
          cksDom.addEventListener('dblclick', function (e) {
            _${prefix}_id77_changeCookie(_${prefix}_id77_cookies[0]);

            e.stopPropagation();
          });
  
          const nextCookieDom = document.querySelector('#nextCookie');
          nextCookieDom.addEventListener('click', (e) => {
            _${prefix}_id77_nextCookie();
            e.stopPropagation();
          })

          const clickerDom = document.querySelector('#clicker');
          if (clickerDom) {
            clickerDom.addEventListener('click', (e) => {
              document.querySelector('#id77_clicker').style.display = 'block';
              e.stopPropagation();
            });
          }

          const openUrlDom = document.querySelector('#open_url');
          if (openUrlDom) {
            openUrlDom.addEventListener('click', async (e) => {
              try {  
                const url = await navigator.clipboard.readText();
                if (url.includes('https://')) {
                  console.log(url);
                  const aDom = document.createElement('a');
                  aDom.setAttribute('href', url);
                  aDom.click();
                  e.stopPropagation();
                }
              } catch (error) {
                console.log(error);
              }
            });
          }

          // console.log('${skuCache} @ ${urlSku} @ ${msgOpts?.openUrl}')

          callback(toolList);
        });
        
        ID77Plugin.on('ready', function() {
          if (!_${prefix}_id77_needHideSwitch) {
            const \$btns = document.querySelectorAll('._${prefix}_id77_btn');
            Array.prototype.forEach.call(\$btns, function(el, i){
              el.classList.remove('_${prefix}_id77_hide');
            });
          }
  
          const fontSize = document.querySelector('#__vconsole').style.fontSize;
  
          if(fontSize) {
            document.querySelector('#_${prefix}_id77_btns').style.fontSize = fontSize;
          }
  
          const _currentCKDom = document.querySelector("#_" + _${prefix}_id77_currentPin);
  
          if (_${prefix}_id77_currentPin && _currentCKDom) {
            setTimeout(() => {
              _currentCKDom.style.background = '#238636';
            });
          }
          
        });
  
        function scrollTopToCKDom(reset) {
          const fontSize = document.querySelector('#__vconsole').style.fontSize;
  
          const _currentCKDom = document.querySelector("#_" + _${prefix}_id77_currentPin);
          const _VCcontext = document.querySelector('.vc-content');
  
          if (reset) {
            _VCcontext.scrollTop = 0;
            return;
          }
  
          let cookieIndex;
  
          if (_currentCKDom) {
            cookieIndex = _currentCKDom.dataset.cookieIndex - 1;
  
            if(_VCcontext && cookieIndex) {
              setTimeout(() => {
                _VCcontext.scrollTop  = cookieIndex * (fontSize || 16) * 2.5;
              }); 
            }
          }

          if(!window.localStorage) {
            window.localStorage = window.localStorageCopy
          }
          if(!window.sessionStorage) {
            window.sessionStorage = window.sessionStorageCopy
          }
        }
  
        ID77Plugin.on('show', scrollTopToCKDom);
        ID77Plugin.on('showConsole', scrollTopToCKDom);
        ID77Plugin.on('hideConsole', () => scrollTopToCKDom(true));
  
        // if (${$.isJD}) {
          // if (_${prefix}_id77_cookies.length > 0) {
             _${prefix}_id77_vConsole.addPlugin(ID77Plugin);
             _${prefix}_id77_vConsole.showPlugin("id77_plugin");
             _${prefix}_id77_changeTabs();
          // }
        // }

         _${prefix}_id77_vConsole.showPlugin("default");
  
        function createDom(str) {
          let newDiv = document.createElement("div");
          let newContent = document.createTextNode(str);
          newDiv.appendChild(newContent);
          newDiv.style.fontSize = "16px";
          newDiv.addEventListener('click', (e) => {
             _${prefix}_id77_copyText(str)
          })
          return newDiv;
        }
      } catch (err) {
        console.log(arguments.callee.name, err);
      }
    }

    function _${prefix}_id77_copyText(text) {
      const input = document.createElement('input');
      input.setAttribute('readonly', 'readonly');
      input.setAttribute('value', text);
      document.body.appendChild(input);
      input.setSelectionRange(0, input.value.length);
      if (document.execCommand('copy')) {
        document.execCommand('copy');
        console.log('复制成功');
      }
      document.body.removeChild(input);
    }
  </script>
  <style>
    [data-tippy-root] {
      z-index: ${clicker_off_zIndex} !important;
    }
    #id77_clicker {
      background: #fff;
      z-index: 8888;
      font-size:16px;
    }
    .id77_float {
      float: left;
      margin-right: 15px;
    }
    .tippy-box .el-tgl {
      display: none !important;
    }
    .id77_clicker_main p {
      font-weight: bold;
    }

    #id77_clicker_timerTime {
      font-size: 16px;
      width: 80px; 
    }
    #id77_clicker_timerBeforehandTime {
      font-size: 16px;
    }

    .id77_clicker_add {
      color: #fff;
      background: #0075ff;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      line-height: 50px;
      text-align: center;
      font-size: 30px;
      margin: 10px auto;
    }

    #id77_timer input[type="checkbox"] {
      /*
      display: none;这样会让tab键无法选取自定义的checkbox，所以使用下面的方法
      clip 属性剪裁绝对定位元素。
      */
      position: absolute;
      clip: rect(0, 0, 0, 0)
    }

    #id77_timer input[type="checkbox"] {
      display: inline-block;
      width: 48%;
      margin-top: 10px;
      margin-left: 5px;
      text-align: left;
      box-sizing: border-box;
    }

    #id77_timer label::before {
      content: '\\a0';
      display: inline-block;
      border: 1px solid silver;
      text-align: center;
      width: 20px;
      height: 20px;
      font-weight: bold;
    }
    
    #id77_timer input[type="checkbox"]:checked+label::before {
      content: '\\2713';
      color: #0075ff;
    }

    .id77_clicker_main input,
    .id77_clicker_main select {
      margin-bottom: 15px;
      font-size: 14px;
    }

    .id77_clicker_main {
      padding: 5px 16px;
      margin: 0 0 80px;
    }

    .id77_clicker_main input[type='number'],
    .id77_clicker_main input[type='time'],
    .id77_clicker_main select {
      border: 1px solid #e5e5e5 !important;
      border-radius: 5px;
      height: 36px;
      box-sizing: border-box;
      padding: 10px;
      float: left;
      margin-right: 15px;
    }

    /* ----------------*/
    .moveable-control-box {
      display: none !important;
      all: initial;
    }

    .tippy-box {
      max-width: min(350px, 90vw) !important;
    }

    .tippy-box:focus {
      outline: 0;
    }

    .tpa-tooltip-content-root {
      text-shadow: initial;
      margin: 0;
      padding: 8px;
      color: grey;
      background-color: white;
      border-color: lightgray;
      border-style: solid;
      border-width: 1px;
      border-radius: 8px;
      user-select: none;
    }

    .tpa-tooltip-options-container {
      display: flex;
      flex-direction: row;
      align-content: center;
      align-items: center;
    }

    .tpa-tooltip-options-container > * {
      all: initial;
    }

    .tpa-tooltip-content-root-arrow-icon {
      width: 30px;
      height: 30px;
      display: inline-block;
      line-height: 30px;
      -webkit-flex-shrink: 0;
      -ms-flex-negative: 0;
      flex-shrink: 0;
      color: white;
      vertical-align: middle;
    }

    .tpa-tooltip-content-root-arrow {
      background-color: transparent;
      border: 0;
      animation: tpa-tooltip-content-root-arrow-ani 500ms ease-in-out;
      animation-iteration-count: infinite;
      animation-direction: alternate-reverse;
    }

    .tpa-tooltip-content-root-options {
      font-family: initial;
      font-size: 16px !important;
    }

    .tpa-tooltip-content-root-drag {
      font-size: 16px !important;
      word-wrap: break-word !important;
    }

    .tpa-tooltip-content-root-drag strong {
      font: initial;
      font-size: 16px !important;
      font-weight: bold;
    }

    .tpa-tooltip-content-root span {
      color: #eb1313 !important;
    }

    .tpa-inner-clicker {
      filter: unset !important;
      box-shadow: unset !important;
      text-shadow: unset !important;
      float: left !important;
      /*position: static !important;*/
      border-radius: 50% !important;
      width: 48px !important;
      height: 48px !important;
      font-size: 30px;
    }

    .tpa-inner-clicker-error {
      padding-left: 3px;
    }

    div.tpa-click-effect {
      position: absolute !important;
      box-sizing: border-box !important;
      border-style: solid !important;
      border-radius: 50% !important;
      animation: tpa-click-effect-ani 200ms ease-out !important;
      border-width: 2px !important;
      /*border-color: #86d993;*/
      /*border-color: #7056ff;*/
      border-color: lightgray !important;
    }

    @keyframes tpa-tooltip-content-root-arrow-ani {
      0% {
        transform: none;
      }

      100% {
        transform: translateX(-30px);
      }
    }

    @keyframes tpa-click-effect-ani {
      0% {
        width: 9px;
        height: 9px;
        margin: -4.5px;
        opacity: 1;
      }

      100% {
        width: 48px;
        height: 48px;
        margin: -24px;
        opacity: 0.2;
      }
    }
  </style>
  <script ignore>
    function _${prefix}_id77_initClicker() {
      document
          .querySelector('#id77_clicker_frequency')
          .addEventListener('input', (e) => {
            document.querySelector('#id77_clicker_frequency_text').value =
              e.target.value;
          });
      document
          .querySelector('#id77_clicker_frequency_text')
          .addEventListener('input', (e) => {
            document.querySelector('#id77_clicker_frequency').value =
              e.target.value;
          });
      let id77_time = Date.now(),
      id77_date = new Date(id77_time + 60 * 1000),
      id77_hh =
        id77_date.getHours() < 10
          ? '0' + id77_date.getHours()
          : id77_date.getHours(),
      id77_mm =
        id77_date.getMinutes() < 10
          ? '0' + id77_date.getMinutes()
          : id77_date.getMinutes();
        document.querySelector('#id77_clicker_timerTime').value = id77_hh + ':' + id77_mm + ':00';
    }
    // 等待页面加载完成
    if (document.readyState === 'complete') {
      _${prefix}_id77_initClicker();
    } else {
      window.addEventListener('load', _${prefix}_id77_initClicker);
    }
  </script>
  `;

  let clickerScript = `<script src="https://fastly.jsdelivr.net/gh/id77/QuantumultX@master/Script/clicker.min.js?v=id77" ignore></script>`;

  // if (/<script.*v(C|c)onsole(\.min)?\.js.+?script>/i.test(html)) {
  //   html = html.replace(/<script.*v(C|c)onsole(\.min)?\.js.+?script>/i, ``);
  // }
  html = html.replace(/<!--\[if IE\]>.+?<!\[endif\]-->/g, '');
  // if (notCache)
  //   html.replace(
  //     /(<head>)/i,
  //     `$1<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  //     <meta http-equiv="Pragma" content="no-cache" />
  //     <meta http-equiv="Expires" content="0" />`
  //   );
  html = html.replace(/(<head>)/i, `$1<meta charset="utf-8" />`);
  if (/(<(?:style|link|script)[\s\S]+?<\/head>)/i.test(html)) {
    html = html.replace(
      /(<(?:style|link|script)[\s\S]+?<\/head>)/i,
      `${copyObject}${scriptDoms}${captchaScript}${mitmContent}$1`,
    );
  } else {
    html = html.replace(
      /(<\/head>|<script|<div)/i,
      `${copyObject}${scriptDoms}${captchaScript}${mitmContent}$1`,
    );
  }

  html = html.replace(
    /(<\/body>)(?![\s\S]*\1)/,
    `${clickerDom}${mitmFixContent}${clickerScript}$1`,
  );
  // html = html.slice() + ``;
} catch (error) {
  // console.error(arguments.callee.name, error);
  console.log(error);
}

if (/charset=("|').+?("|')/.test(html)) {
  html = html.replace(/charset=("|').+?("|')/g, 'charset="utf-8"');
}
$.done({
  body: html,
  // bodyBytes: encoder.encode(html),
  headers: modifiedHeaders,
});

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
        delete opts.headers['Host'];
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
      if (opts.body && opts.headers && !opts.headers['Content-Type']) {
        opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      if (opts.headers) {
        delete opts.headers['Host'];
        delete opts.headers['Content-Length'];
      };
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
