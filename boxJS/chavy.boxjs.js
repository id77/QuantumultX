const $ = new Env('BoxJs');

// 为 eval 准备的上下文环境
const $eval_env = {};

// $.version = '0.19.21';
$.version = '.iCloud';
$.versionType = 'beta';
$.needICloudHtml = true; // 是否需要 iCloud 的页面源码

// 发出的请求需要需要 Surge、QuanX 的 rewrite
$.isNeedRewrite = true;

/**
 * ===================================
 * 持久化属性: BoxJs 自有的数据结构
 * ===================================
 */

// 存储`用户偏好`
$.KEY_usercfgs = 'chavy_boxjs_userCfgs';
// 存储`应用会话`
$.KEY_sessions = 'chavy_boxjs_sessions';
// 存储`页面缓存`
$.KEY_web_cache = 'chavy_boxjs_web_cache';
// 存储`应用订阅缓存`
$.KEY_app_subCaches = 'chavy_boxjs_app_subCaches';
// 存储`全局备份` (弃用, 改用 `chavy_boxjs_backups`)
$.KEY_globalBaks = 'chavy_boxjs_globalBaks';
// 存储`备份索引`
$.KEY_backups = 'chavy_boxjs_backups';
// 存储`当前会话` (配合切换会话, 记录当前切换到哪个会话)
$.KEY_cursessions = 'chavy_boxjs_cur_sessions';

/**
 * ===================================
 * 持久化属性: BoxJs 公开的数据结构
 * ===================================
 */

// 存储用户访问`BoxJs`时使用的域名
$.KEY_boxjs_host = 'boxjs_host';

// 请求响应体 (返回至页面的结果)
$.json = $.name; // `接口`类请求的响应体
$.html = $.name; // `页面`类请求的响应体

// 页面源码地址
$.web = `https://cdn.jsdelivr.net/gh/chavyleung/scripts@${
  $.version
}/box/chavy.boxjs.html?_=${new Date().getTime()}`;
// 版本说明地址 (Release Note)
$.ver = `https://raw.githubusercontent.com/chavyleung/scripts/master/box/release/box.release.json`;

!(async () => {
  // 勿扰模式
  $.isMute = [true, 'true'].includes($.getData('@chavy_boxjs_userCfgs.isMute'));

  // 请求路径
  $.path = getPath($request.url);

  // 请求参数 /api/save?id=xx&name=xx => {id: 'xx', name: 'xx'}
  const [, query] = $.path.split('?');
  $.queries = query
    ? query.split('&').reduce((obj, cur) => {
        const [key, val] = cur.split('=');
        obj[key] = val;
        return obj;
      }, {})
    : {};

  // 请求类型: GET
  $.isGet = $request.method === 'GET';
  // 请求类型: POST
  $.isPost = $request.method === 'POST';
  // 请求类型: OPTIONS
  $.isOptions = $request.method === 'OPTIONS';

  // 请求类型: page、api、query
  $.type = 'page';
  // 查询请求: /query/xxx
  $.isQuery = $.isGet && /^\/query\/.*?/.test($.path);
  // 接口请求: /api/xxx
  $.isApi = $.isPost && /^\/api\/.*?/.test($.path);
  // 页面请求: /xxx
  $.isPage = $.isGet && !$.isQuery && !$.isApi;

  // 升级用户数据
  upgradeUserData();
  // 升级备份数据
  upgradeGlobalBaks();

  // 处理预检请求
  if ($.isOptions) {
    $.type = 'options';
    await handleOptions();
  }
  // 处理`页面`请求
  else if ($.isPage) {
    $.type = 'page';
    await handlePage();
  }
  // 处理`查询`请求
  else if ($.isQuery) {
    $.type = 'query';
    await handleQuery();
  }
  // 处理`接口`请求
  else if ($.isApi) {
    $.type = 'api';
    await handleApi();
  }
})()
  .catch((e) => $.logErr(e))
  .finally(() => doneBox());

/**
 * http://boxjs.com/ => `http://boxjs.com`
 * http://boxjs.com/app/jd => `http://boxjs.com`
 */
function getHost(url) {
  return url.slice(0, url.indexOf('/', 8));
}

/**
 * http://boxjs.com/ => ``
 * http://boxjs.com/api/getData => `/api/getData`
 */
function getPath(url) {
  // 如果以`/`结尾, 去掉最后一个`/`
  const end = url.lastIndexOf('/') === url.length - 1 ? -1 : undefined;
  // slice第二个参数传 undefined 会直接截到最后
  // indexOf第二个参数用来跳过前面的 "https://"
  return url.slice(url.indexOf('/', 8), end);
}

/**
 * ===================================
 * 处理前端请求
 * ===================================
 */

/**
 * 处理`页面`请求
 */
async function handlePage() {
  // 获取 BoxJs 数据
  const boxdata = getBoxData();
  boxdata.syscfgs.isDebugMode = false;

  // 调试模式: 是否每次都获取新的页面
  const isDebugWeb = [true, 'true'].includes(
    $.getData('@chavy_boxjs_userCfgs.isDebugWeb'),
  );
  const debugger_web = $.getData('@chavy_boxjs_userCfgs.debugger_web');
  const cache = $.getJson($.KEY_web_cache, null);

  // 如果没有开启调试模式，且当前版本与缓存版本一致，且直接取缓存
  if (
    !isDebugWeb &&
    cache &&
    cache.version === $.version &&
    !$.needICloudHtml
  ) {
    $.html = cache.cache;
  }
  // 如果开启了调试模式，并指定了 `debugger_web` 则从指定的地址获取页面
  else {
    if (isDebugWeb && debugger_web) {
      // 调试地址后面拼时间缀, 避免 GET 缓存
      const isQueryUrl = debugger_web.includes('?');
      $.web = `${debugger_web}${
        isQueryUrl ? '&' : '?'
      }_=${new Date().getTime()}`;
      boxdata.syscfgs.isDebugMode = true;
      console.log(`[WARN] 调试模式: $.web = : ${$.web}`);
    }
    // 如果调用这个方法来获取缓存, 且标记为`非调试模式`
    const getcache = () => {
      console.log(`[ERROR] 调试模式: 正在使用缓存的页面!`);
      boxdata.syscfgs.isDebugMode = false;
      return $.getJson($.KEY_web_cache).cache;
    };
    if ($.needICloudHtml) {
      const filePath = `chavy.boxjs.html`;
      $.html = await $.readFile(filePath);
      // const cache = { version: $.version, cache: $.html };
      // $.setJson(cache, $.KEY_web_cache);
    } else {
      await $.http.get($.web).then(
        (resp) => {
          if (/<title>BoxJs<\/title>/.test(resp.body)) {
            // 返回页面源码, 并马上存储到持久化仓库
            $.html = resp.body;
            const cache = { version: $.version, cache: $.html };
            $.setJson(cache, $.KEY_web_cache);
          } else {
            // 如果返回的页面源码不是预期的, 则从持久化仓库中获取
            $.html = getcache();
          }
        },
        // 如果获取页面源码失败, 则从持久化仓库中获取
        () => ($.html = getcache()),
      );
    }
  }
  // 根据偏好设置, 替换首屏颜色 (如果是`auto`则交由页面自适应)
  const theme = $.getData('@chavy_boxjs_userCfgs.theme');
  if (theme === 'light') {
    $.html = $.html.replace('#121212', '#fff');
  } else if (theme === 'dark') {
    $.html = $.html.replace('#fff', '#121212');
  }
  /**
   * 后端渲染数据, 感谢 https://t.me/eslint 提供帮助
   *
   * 如果直接渲染到 box: null 会出现双向绑定问题
   * 所以先渲染到 `boxServerData: null` 再由前端 `this.box = this.boxServerData` 实现双向绑定
   */
  $.html = $.html.replace(
    'boxServerData: null',
    'boxServerData:' + JSON.stringify(boxdata),
  );

  // 调试模式支持 vue Devtools (只有在同时开启调试模式和指定了调试地址才生效)
  // vue.min.js 生效时, 会导致 @click="window.open()" 报 "window" is not defined 错误
  if (isDebugWeb && debugger_web) {
    $.html = $.html.replace('vue.min.js', 'vue.js');
  }
}

/**
 * 处理`查询`请求
 */
async function handleQuery() {
  const referer = $request.headers.referer || $request.headers.Referer;
  if (!/^https?:\/\/(.+\.)?boxjs\.(com|net)\//.test(referer)) {
    const isMuteQueryAlert = [true, 'true'].includes(
      $.getData('@chavy_boxjs_userCfgs.isMuteQueryAlert'),
    );

    if (!isMuteQueryAlert) {
      // 关闭静默状态
      const _isMute = $.isMute;
      $.isMute = false;

      $.msg(
        $.name,
        '❗️发现有脚本或人正在读取你的数据',
        [
          '请注意数据安全, 你可以: ',
          '1. 在 BoxJs 的脚本日志中查看详情',
          '2. 在 BoxJs 的页面 (侧栏) 中 "不显示查询警告"',
        ].join('\n'),
      );

      // 还原静默状态
      $.isMute = _isMute;
    }

    $.log(
      [
        '',
        '❗️❗️❗️ 发现有脚本或人正在读取你的数据 ❗️❗️❗️',
        JSON.stringify($request),
        '',
      ].join('\n'),
    );
  }

  const [, query] = $.path.split('/query');
  if (/^\/boxdata/.test(query)) {
    $.json = getBoxData();
  } else if (/^\/baks/.test(query)) {
    const [, backupId] = query.split('/baks/');
    $.json = $.getJson(backupId);
  } else if (/^\/versions$/.test(query)) {
    await getVersions(true);
  } else if (/^\/data/.test(query)) {
    const [, dataKey] = query.split('/data/');
    $.json = {
      key: dataKey,
      val: $.getData(dataKey),
    };
  }
}

/**
 * 处理 API 请求
 */
async function handleApi() {
  const [, api] = $.path.split('/api');

  const apiHandlers = {
    '/save': apiSave,
    '/addAppSub': apiAddAppSub,
    '/deleteAppSub': apiDeleteAppSub,
    '/reloadAppSub': apiReloadAppSub,
    '/delGlobalBak': apiDelGlobalBak,
    '/updateGlobalBak': apiUpdateGlobalBak,
    '/saveGlobalBak': apiSaveGlobalBak,
    '/impGlobalBak': apiImpGlobalBak,
    '/revertGlobalBak': apiRevertGlobalBak,
    '/downloadFile': apiDownloadFile,
    '/runScript': apiRunScript,
    '/saveData': apiSaveData,
    '/surge': apiSurge,
    '/update': apiUpdate,
  };

  for (const [key, handler] of Object.entries(apiHandlers)) {
    if (api === key || api.startsWith(`${key}?`)) {
      await handler();
      break;
    }
  }
}

async function handleOptions() {}

/**
 * ===================================
 * 获取基础数据
 * ===================================
 */

function getBoxData() {
  const datas = {};

  const extraDatas =
    $.getData(`${$.KEY_usercfgs.replace('#', '@')}.gist_cache_key`) || [];

  extraDatas.forEach((key) => {
    datas[key] = $.getData(key);
  });

  const usercfgs = getUserCfgs();
  const sessions = getAppSessions();
  const curSessions = getCurSessions();
  const sysapps = getSystemApps();
  const syscfgs = getSystemCfgs();
  const appSubCaches = getAppSubCaches();
  const globalbaks = getGlobalBaks();

  // 把 `内置应用`和`订阅应用` 里需要持久化属性放到`datas`
  sysapps.forEach((app) => {
    const newDatas = getAppDatas(app);
    Object.assign(datas, newDatas);
  });
  usercfgs.appsubs.forEach((sub) => {
    const subcache = appSubCaches[sub.url];
    if (subcache && subcache.apps && Array.isArray(subcache.apps)) {
      subcache.apps.forEach((app) => {
        const newDatas = getAppDatas(app);
        Object.assign(datas, newDatas);
      });
    }
  });

  const box = {
    datas,
    usercfgs,
    sessions,
    curSessions,
    sysapps,
    syscfgs,
    appSubCaches,
    globalbaks,
  };

  return box;
}

/**
 * 获取系统配置
 */
function getSystemCfgs() {
  // prettier-ignore
  return {
    env: $.isStash() ? 'Stash' : $.isShadowrocket() ? 'Shadowrocket' : $.isLoon() ? 'Loon' : $.isQuanX() ? 'QuanX' : $.isSurge() ? 'Surge' : 'Node',
    version: $.version,
    versionType: $.versionType,
    envs: [
      { id: 'Surge', icons: ['https://raw.githubusercontent.com/Orz-3/mini/none/surge.png', 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/surge.png'] },
      { id: 'QuanX', icons: ['https://raw.githubusercontent.com/Orz-3/mini/none/quanX.png', 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/quantumultx.png'] },
      { id: 'Loon', icons: ['https://raw.githubusercontent.com/Orz-3/mini/none/loon.png', 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/loon.png'] },
      { id: 'Shadowrocket', icons: ['https://raw.githubusercontent.com/Orz-3/mini/master/Alpha/shadowrocket.png', 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/shadowrocket.png'] },
      { id: 'Stash', icons: ['https://raw.githubusercontent.com/Orz-3/mini/master/Alpha/stash.png', 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/stash.png'] }
    ],
    chavy: { id: 'ChavyLeung', icon: 'https://avatars3.githubusercontent.com/u/29748519', repo: 'https://github.com/chavyleung/scripts' },
    senku: { id: 'GideonSenku', icon: 'https://avatars1.githubusercontent.com/u/39037656', repo: 'https://github.com/GideonSenku' },
    id77: { id: 'id77', icon: 'https://avatars0.githubusercontent.com/u/9592236', repo: 'https://github.com/id77' },
    orz3: { id: 'Orz-3', icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/Orz-3.png', repo: 'https://github.com/Orz-3/' },
    boxjs: { id: 'BoxJs', show: false, icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/box.png', icons: ['https://raw.githubusercontent.com/Orz-3/mini/master/Alpha/box.png', 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/box.png'], repo: 'https://github.com/chavyleung/scripts' },
    defaultIcons: ['https://raw.githubusercontent.com/Orz-3/mini/master/Alpha/appstore.png', 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/appstore.png']
  }
}

/**
 * 获取内置应用
 */
function getSystemApps() {
  // prettier-ignore
  const sysapps = [
    {
      id: 'BoxSetting',
      name: '偏好设置',
      descs: ['可手动执行一些抹掉数据的脚本', '可设置明暗两种主题下的主色调', '可设置壁纸清单'],
      keys: [
        '@chavy_boxjs_userCfgs.httpapi',
        '@chavy_boxjs_userCfgs.bgimg',
        '@chavy_boxjs_userCfgs.http_backend',
        '@chavy_boxjs_userCfgs.color_dark_primary',
        '@chavy_boxjs_userCfgs.color_light_primary'
      ],
      settings: [
        { id: '@chavy_boxjs_userCfgs.httpapis', name: 'HTTP-API (Surge)', val: '', type: 'textarea', placeholder: ',examplekey@127.0.0.1:6166', autoGrow: true, rows: 2, persistentHint:true, desc: '示例: ,examplekey@127.0.0.1:6166! 注意: 以逗号开头, 逗号分隔多个地址, 可加回车' },
        { id: '@chavy_boxjs_userCfgs.httpapi_timeout', name: 'HTTP-API Timeout (Surge)', val: 20, type: 'number', persistentHint:true, desc: '如果脚本作者指定了超时时间, 会优先使用脚本指定的超时时间.' },
        { id: '@chavy_boxjs_userCfgs.http_backend', name: 'HTTP Backend (Quantumult X)', val: '', type: 'text',placeholder: 'http://127.0.0.1:9999', persistentHint:true, desc: '示例: http://127.0.0.1:9999 ! 注意: 必须是以 http 开头的完整路径, 不能是 / 结尾' },
        { id: '@chavy_boxjs_userCfgs.debugger_webs', name: '调试地址', val: 'Dev体验,https://raw.githubusercontent.com/chavyleung/scripts/boxjs.dev/box/chavy.boxjs.html', type: 'textarea', placeholder: '每行一个配置，用逗号分割每个配置的名字和链接：配置,url', persistentHint:true, autoGrow: true, rows: 2, desc: '逗号分隔名字和链接, 回车分隔多个地址' },
        { id: '@chavy_boxjs_userCfgs.bgimgs', name: '背景图片清单', val: '无,\n跟随系统,跟随系统\nlight,http://api.btstu.cn/sjbz/zsy.php\ndark,https://uploadbeta.com/api/pictures/random\n妹子,http://api.btstu.cn/sjbz/zsy.php', type: 'textarea', placeholder: '无,{回车} 跟随系统,跟随系统{回车} light,图片地址{回车} dark,图片地址{回车} 妹子,图片地址', persistentHint:true, autoGrow: true, rows: 2, desc: '逗号分隔名字和链接, 回车分隔多个地址' },
        { id: '@chavy_boxjs_userCfgs.bgimg', name: '背景图片', val: '', type: 'text', placeholder: 'http://api.btstu.cn/sjbz/zsy.php', persistentHint:true, desc: '输入背景图标的在线链接' },
        { id: '@chavy_boxjs_userCfgs.changeBgImgEnterDefault', name: '手势进入壁纸模式默认背景图片', val: '', type: 'text', placeholder: '填写上面背景图片清单的值', persistentHint:true, desc: '' },
        { id: '@chavy_boxjs_userCfgs.changeBgImgOutDefault', name: '手势退出壁纸模式默认背景图片', val: '', type: 'text', placeholder: '填写上面背景图片清单的值', persistentHint:true, desc: '' },
        { id: '@chavy_boxjs_userCfgs.color_light_primary', name: '明亮色调', canvas: true, val: '#F7BB0E', type: 'colorpicker', desc: '' },
        { id: '@chavy_boxjs_userCfgs.color_dark_primary', name: '暗黑色调', canvas: true, val: '#2196F3', type: 'colorpicker', desc: '' }
      ],
      scripts: [
        {
          name: "抹掉：所有缓存",
          script: "https://raw.githubusercontent.com/chavyleung/scripts/master/box/scripts/boxjs.revert.caches.js"
        },
        {
          name: "抹掉：收藏应用",
          script: "https://raw.githubusercontent.com/chavyleung/scripts/master/box/scripts/boxjs.revert.usercfgs.favapps.js"
        },
        {
          name: "抹掉：用户偏好",
          script: "https://raw.githubusercontent.com/chavyleung/scripts/master/box/scripts/boxjs.revert.usercfgs.js"
        },
        {
          name: "抹掉：所有会话",
          script: "https://raw.githubusercontent.com/chavyleung/scripts/master/box/scripts/boxjs.revert.usercfgs.sessions.js"
        },
        {
          name: "抹掉：所有备份",
          script: "https://raw.githubusercontent.com/chavyleung/scripts/master/box/scripts/boxjs.revert.baks.js"
        },
        {
          name: "抹掉：BoxJs (注意备份)",
          script: "https://raw.githubusercontent.com/chavyleung/scripts/master/box/scripts/boxjs.revert.boxjs.js"
        }
      ],
      author: '@chavyleung',
      repo: 'https://github.com/chavyleung/scripts/blob/master/box/switcher/box.switcher.js',
      icons: [
        'https://raw.githubusercontent.com/chavyleung/scripts/master/box/icons/BoxSetting.mini.png',
        'https://raw.githubusercontent.com/chavyleung/scripts/master/box/icons/BoxSetting.png'
      ]
    },
    {
      id: 'BoxSwitcher',
      name: '会话切换',
      desc: '打开静默运行后, 切换会话将不再发出系统通知 \n注: 不影响日志记录',
      keys: [],
      settings: [{ id: 'CFG_BoxSwitcher_isSilent', name: '静默运行', val: false, type: 'boolean', desc: '切换会话时不发出系统通知!' }],
      author: '@chavyleung',
      repo: 'https://github.com/chavyleung/scripts/blob/master/box/switcher/box.switcher.js',
      icons: [
        'https://raw.githubusercontent.com/chavyleung/scripts/master/box/icons/BoxSwitcher.mini.png',
        'https://raw.githubusercontent.com/chavyleung/scripts/master/box/icons/BoxSwitcher.png'
      ],
      script: 'https://raw.githubusercontent.com/chavyleung/scripts/master/box/switcher/box.switcher.js'
    },
    {
      id: "BoxGist",
      name: "Gist备份",
      keys: [
        "@gist.token",
        "@gist.username",
        "@gist.split",
        "@gist.revision_options",
        "@gist.backup_type"
      ],
      author: "@dompling",
      repo: "https://github.com/dompling/Script/tree/master/gist",
      icons: [
        "https://raw.githubusercontent.com/Former-Years/icon/master/github-bf.png",
        "https://raw.githubusercontent.com/Former-Years/icon/master/github-bf.png"
      ],
      descs_html: [
        "<h2>Token的获取方式</h2>",
        "<ol>头像菜单 -></ol>",
        "<ol>Settings -></ol>",
        "<ol>Developer settings -></ol>",
        "<ol>Personal access tokens -></ol>",
        "<ol>Generate new token -></ol>",
        "<ol>在里面找到 gist 勾选提交</ol>",
        "<h2>Gist Revision Id</h2>",
        "<ol>打开Gist项目</ol>",
        "<ol>默认为Code，选择Revisions</ol>",
        "<ol>找到需要恢复的版本文件</ol>",
        "<ol>点击右上角【...】>【View file】</ol>",
        "<ol>浏览器地址最后一串为 RevisionId</ol>"
      ],
      scripts: [
        {
          name: "备份 Gist",
          script: "https://raw.githubusercontent.com/dompling/Script/master/gist/backup.js"
        },
        {
          name: "从 Gist 恢复",
          script: "https://raw.githubusercontent.com/dompling/Script/master/gist/restore.js"
        },
        {
          name: "更新历史版本",
          script: "https://raw.githubusercontent.com/dompling/Script/master/gist/commit.js"
        }
      ],
      settings: [
        {
          id: "@gist.split",
          name: "用户数据分段",
          val: null,
          type: "number",
          placeholder: "用户数据过大时，请进行拆分防止内存警告⚠️",
          desc: "值为数字，拆分段数比如 2 就拆分成两个 datas."
        },
        {
          id: "@gist.revision_id",
          type: "modalSelects",
          name: "历史版本RevisionId",
          desc: "不填写时，默认获取最新，恢复后会自动清空。选择无内容时，请运行上方更新历史版本",
          items: "@gist.revision_options"
        },
        {
          id: "@gist.backup_type",
          name: "备份/恢复内容",
          val: "usercfgs,datas,sessions,curSessions,backups,appSubCaches",
          type: "checkboxes",
          items: [
            {
              key: "usercfgs",
              label: "用户偏好"
            },
            {
              key: "datas",
              label: "用户数据"
            },
            {
              key: "sessions",
              label: "应用会话"
            },
            {
              key: "curSessions",
              label: "当前会话"
            },
            {
              key: "backups",
              label: "备份索引"
            },
            {
              key: "appSubCaches",
              label: "应用订阅缓存"
            }
          ]
        },
        {
          id: "@gist.username",
          name: "用户名",
          val: null,
          type: "text",
          placeholder: "github 用户名",
          desc: "必填"
        },
        {
          id: "@gist.token",
          name: "Personal access tokens",
          val: null,
          type: "text",
          placeholder: "github personal access tokens",
          desc: "必填"
        }
      ]
    }
  ]
  return sysapps;
}

/**
 * 获取用户配置
 */
function getUserCfgs() {
  const defcfgs = {
    gist_cache_key: [],

    favapps: [],
    appsubs: [],
    viewkeys: [],
    isPinedSearchBar: true,
    httpapi: 'examplekey@127.0.0.1:6166',
    http_backend: '',
  };
  const usercfgs = Object.assign(defcfgs, $.getJson($.KEY_usercfgs, {}));

  // 处理异常数据：删除所有为 null 的订阅
  if (usercfgs.appsubs.includes(null)) {
    usercfgs.appsubs = usercfgs.appsubs.filter((sub) => sub);
    $.setJson(usercfgs, $.KEY_usercfgs);
  }

  return usercfgs;
}

/**
 * 获取`应用订阅`缓存
 */
function getAppSubCaches() {
  return $.getJson($.KEY_app_subCaches, {});
}

/**
 * 获取全局备份列表
 */
function getGlobalBaks() {
  let backups = $.getJson($.KEY_backups, []);

  // 处理异常数据：删除所有为 null 的备份
  if (backups.includes(null)) {
    backups = backups.filter((bak) => bak);
    $.setJson(backups, $.KEY_backups);
  }

  return backups;
}

/**
 * 获取版本清单
 */
function getVersions() {
  return $.http.get($.ver).then(
    (resp) => {
      try {
        $.json = $.toObj(resp.body);
      } catch {
        $.json = {};
      }
    },
    () => ($.json = {}),
  );
}

/**
 * 获取应用会话
 */
function getAppSessions() {
  return $.getJson($.KEY_sessions, []) || [];
}

/**
 * 获取当前切换到哪个会话
 */
function getCurSessions() {
  return $.getJson($.KEY_cursessions, {}) || {};
}

/**
 * ===================================
 * 接口类函数
 * ===================================
 */

function getAppDatas(app) {
  const datas = {};
  const nulls = [null, undefined, 'null', 'undefined'];
  if (app.keys && Array.isArray(app.keys)) {
    app.keys.forEach((key) => {
      const val = $.getData(key);
      datas[key] = nulls.includes(val) ? null : val;
    });
  }
  if (app.settings && Array.isArray(app.settings)) {
    app.settings.forEach((setting) => {
      const key = setting.id;
      const dataval = $.getData(key);
      datas[key] = nulls.includes(dataval) ? null : dataval;

      if (setting.type === 'boolean') {
        setting.val = nulls.includes(dataval)
          ? setting.val
          : dataval === 'true' || dataval === true;
      } else if (setting.type === 'int') {
        setting.val = dataval * 1 || setting.val;
      } else if (setting.type === 'checkboxes') {
        if (!nulls.includes(dataval) && typeof dataval === 'string') {
          setting.val = dataval ? dataval.split(',') : [];
        } else {
          setting.val = Array.isArray(setting.val)
            ? setting.val
            : setting.val.split(',');
        }
      } else {
        setting.val = dataval || setting.val;
      }

      if (setting.type === 'modalSelects') {
        setting.items = datas?.[setting.items] || [];
      }
    });
  }
  return datas;
}

function dealKey(str) {
  const [rootKey, delIndex] = str.split('.');
  if (rootKey && rootKey.indexOf('@') > -1 && delIndex !== undefined) {
    const key = rootKey.replace('@', '');
    const datas = JSON.parse($.getData(key));
    if (Array.isArray(datas) && delIndex <= datas.length - 1) {
      datas.splice(delIndex, 1);
      $.setData(JSON.stringify(datas), key);
    }
  }
}

async function apiSave() {
  const data = $.toObj($request.body);
  if (Array.isArray(data)) {
    data.forEach((dat) => {
      if (dat.val === null) {
        dealKey(dat.key);
      } else {
        $.setData(dat.val, dat.key);
      }
    });
  } else {
    if (data.val === null) {
      dealKey(data.key);
    } else {
      $.setData(data.val, data.key);
    }
  }

  const appId = $.queries['appid'];
  if (appId) {
    updateCurSesssions(appId, data);
  }

  $.json = getBoxData();
}

async function apiUpdate() {
  const data = $.toObj($request.body);
  const path = data.path.split('.');
  const val = data.val;
  const key = path.shift();
  if (data.val && path.join('.')) {
    switch (key) {
      case 'usercfgs':
        const usercfgs = getUserCfgs();
        update(usercfgs, path.join('.'), val);
        $.setJson(usercfgs, $.KEY_usercfgs);
        break;
      default:
        break;
    }
  }
  $.json = getBoxData();
}

async function apiAddAppSub() {
  const sub = $.toObj($request.body);
  // 添加订阅
  const usercfgs = getUserCfgs();
  usercfgs.appsubs.push(sub);
  $.setJson(usercfgs, $.KEY_usercfgs);
  // 加载订阅缓存
  await reloadAppSubCache(sub.url);
  $.json = getBoxData();
}

async function apiDeleteAppSub() {
  const sub = $.toObj($request.body);
  // 添加订阅
  const usercfgs = getUserCfgs();
  usercfgs.appsubs = usercfgs.appsubs.filter((e) => e.url !== sub.url);
  $.setJson(usercfgs, $.KEY_usercfgs);
  $.json = getBoxData();
}

async function apiReloadAppSub() {
  const sub = $.toObj($request.body);
  if (sub) {
    await reloadAppSubCache(sub.url);
  } else {
    await reloadAppSubCaches();
  }
  $.json = getBoxData();
}

async function apiDelGlobalBak() {
  const backup = $.toObj($request.body);
  const backups = $.getJson($.KEY_backups, []);
  const bakIdx = backups.findIndex((b) => b.id === backup.id);
  if (bakIdx > -1) {
    backups.splice(bakIdx, 1);
    $.setData('', backup.id);
    $.setJson(backups, $.KEY_backups);
  }
  $.json = getBoxData();
}

async function apiUpdateGlobalBak() {
  const { id: backupId, name: backupName } = $.toObj($request.body);
  const backups = $.getJson($.KEY_backups, []);
  const backup = backups.find((b) => b.id === backupId);
  if (backup) {
    backup.name = backupName;
    $.setJson(backups, $.KEY_backups);
  }
  $.json = getBoxData();
}

async function apiRevertGlobalBak() {
  const { id: bakcupId } = $.toObj($request.body);
  const backup = $.getJson(bakcupId);
  if (backup) {
    const {
      chavy_boxjs_sysCfgs,
      chavy_boxjs_sysApps,
      chavy_boxjs_sessions,
      chavy_boxjs_userCfgs,
      chavy_boxjs_cur_sessions,
      chavy_boxjs_app_subCaches,
      ...datas
    } = backup;
    $.setData(JSON.stringify(chavy_boxjs_sessions), $.KEY_sessions);
    $.setData(JSON.stringify(chavy_boxjs_userCfgs), $.KEY_usercfgs);
    $.setData(JSON.stringify(chavy_boxjs_cur_sessions), $.KEY_cursessions);
    $.setData(JSON.stringify(chavy_boxjs_app_subCaches), $.KEY_app_subCaches);
    const isNull = (val) =>
      [undefined, null, 'null', 'undefined', ''].includes(val);
    Object.keys(datas).forEach((datkey) =>
      $.setData(isNull(datas[datkey]) ? '' : `${datas[datkey]}`, datkey),
    );
  }
  const boxdata = getBoxData();
  $.json = boxdata;
}

async function apiSaveGlobalBak() {
  const backups = $.getJson($.KEY_backups, []);
  const boxdata = getBoxData();
  const backup = $.toObj($request.body);
  const backupData = {};
  backupData['chavy_boxjs_userCfgs'] = boxdata.usercfgs;
  backupData['chavy_boxjs_sessions'] = boxdata.sessions;
  backupData['chavy_boxjs_cur_sessions'] = boxdata.curSessions;
  backupData['chavy_boxjs_app_subCaches'] = boxdata.appSubCaches;
  Object.assign(backupData, boxdata.datas);
  backups.push(backup);
  $.setJson(backups, $.KEY_backups);
  $.setJson(backupData, backup.id);
  $.json = getBoxData();
}

async function apiImpGlobalBak() {
  const backups = $.getJson($.KEY_backups, []);
  const backup = $.toObj($request.body);
  const backupData = backup.bak;
  delete backup.bak;
  backups.push(backup);
  $.setJson(backups, $.KEY_backups);
  $.setJson(backupData, backup.id);
  $.json = getBoxData();
}

async function apiDownloadFile() {
  const opts = $.toObj($request.body);

  if (
    !opts.scripts ||
    !Array.isArray(opts.scripts) ||
    opts.scripts.length === 0
  ) {
    $.json = {
      success: false,
      message: '没有提供有效的脚本链接',
    };
    return;
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const scriptUrl of opts.scripts) {
    try {
      // 从URL中提取文件名
      const fileName = scriptUrl.split('/').pop();

      // 设置文件路径，默认保存到 Scripts 目录
      const filePath = opts.path
        ? `${opts.path}/${fileName}`
        : `../Scripts/${fileName}`;

      // 获取脚本内容
      await $.http.get(scriptUrl).then(
        (resp) => {
          if (resp.body) {
            // 写入文件到 iCloud
            const content = resp.body;
            const encoder = new TextEncoder();
            const writeUint8Array = encoder.encode(content);

            if ($iCloud.writeFile(writeUint8Array, filePath)) {
              successCount++;
              results.push({
                url: scriptUrl,
                fileName: fileName,
                path: filePath,
                success: true,
              });
              console.log(`成功下载脚本到: ${filePath}`);
            } else {
              failCount++;
              results.push({
                url: scriptUrl,
                fileName: fileName,
                path: filePath,
                success: false,
                error: '写入文件失败',
              });
              console.log(`写入文件失败: ${filePath}`);
            }
          } else {
            failCount++;
            results.push({
              url: scriptUrl,
              fileName: fileName,
              success: false,
              error: '获取脚本内容为空',
            });
          }
        },
        (error) => {
          failCount++;
          results.push({
            url: scriptUrl,
            fileName: fileName,
            success: false,
            error: `请求失败: ${error}`,
          });
        },
      );
    } catch (err) {
      failCount++;
      results.push({
        url: scriptUrl,
        success: false,
        error: `处理脚本出错: ${err.message || err}`,
      });
      console.log(`下载脚本时发生错误: ${err}`);
    }
  }

  $.json = {
    success: true,
    totalCount: opts.scripts.length,
    successCount,
    failCount,
    results,
  };
}

async function apiRunScript() {
  // 取消勿扰模式
  $.isMute = false;
  const opts = $.toObj($request.body);
  const httpapi = $.getData('@chavy_boxjs_userCfgs.httpapi');
  const ishttpapi = /.*?@.*?:[0-9]+/.test(httpapi);
  let script_text = null;
  if (opts.isICloud) {
    const filePath = `../Scripts/${opts.url}`;

    try {
      script_text = await $.readFile(filePath);
      // console.log(`读取文件成功：${filePath}, ${script_text}`);
    } catch (e) {
      $eval_env.cached_logs.push(e);
    }
  } else if (opts.isRemote) {
    await $.getScript(opts.url).then((script) => (script_text = script));
  } else {
    script_text = opts.script;
  }
  if (opts.argument && script_text) {
    script_text = `globalThis.$argument=\`${opts.argument}\`;${script_text}`;
  }

  if (
    $.isSurge() &&
    !$.isLoon() &&
    !$.isShadowrocket() &&
    !$.isStash() &&
    ishttpapi
  ) {
    const runOpts = { timeout: opts.timeout };
    await $.runScript(script_text, runOpts).then(
      (resp) => ($.json = JSON.parse(resp)),
    );
  } else {
    const result = await new Promise((resolve) => {
      $eval_env.resolve = resolve;
      // 避免被执行脚本误认为是 rewrite 环境
      // 所以需要 `$request = undefined`
      $eval_env.request = $request;
      $request = undefined;
      // 重写 console.log, 把日志记录到 $eval_env.cached_logs
      $eval_env.cached_logs = [];
      console.cloned_log = console.log;
      console.log = (l) => {
        console.cloned_log(l);
        $eval_env.cached_logs.push(l);
      };
      // 重写脚本内的 $done, 调用 $done() 即是调用 $eval_env.resolve()
      if (script_text) {
        script_text = script_text.replace(/\$done/g, '$eval_env.resolve');
        script_text = script_text.replace(/\$\.done/g, '$eval_env.resolve');
        try {
          eval(script_text);
        } catch (e) {
          $eval_env.cached_logs.push(e);
          resolve();
        }
      } else {
        $eval_env.cached_logs.push(
          `获取脚本失败，访问  ${opts.url} 获取结果失败，请检查脚本地址是否正确，或文件是否存在。`,
        );
        resolve();
      }
    });
    // 还原 console.log
    console.log = console.cloned_log;
    // 还原 $request
    $request = $eval_env.request;
    // 返回数据
    $.json = {
      result,
      output: $eval_env.cached_logs.join('\n'),
    };
  }
}

async function apiSurge() {
  const opts = $.toObj($request.body);
  const httpapi = $.getData('@chavy_boxjs_userCfgs.httpapi');
  const ishttpapi = /.*?@.*?:[0-9]+/.test(httpapi);
  if (
    $.isSurge() &&
    !$.isLoon() &&
    !$.isShadowrocket() &&
    !$.isStash() &&
    ishttpapi
  ) {
    const [key, prefix] = httpapi.split('@');
    opts.url = `http://${prefix}/${opts.url}`;
    opts.headers = {
      'X-Key': key,
      Accept: 'application/json, text/plain, */*',
    };
    await new Promise((resolve) => {
      $[opts.method.toLowerCase()](opts, (_, __, resp) => {
        $.json = JSON.parse(resp);
        resolve($.json);
      });
    });
  }
}

async function apiSaveData() {
  const { key: dataKey, val: dataVal } = $.toObj($request.body);
  $.setData(dataVal, dataKey);
  $.json = {
    key: dataKey,
    val: $.getData(dataKey),
  };
}

/**
 * ===================================
 * 工具类函数
 * ===================================
 */

function reloadAppSubCache(url) {
  // 地址后面拼时间缀, 避免 GET 缓存
  const requrl = `${url}${
    url.includes('?') ? '&' : '?'
  }_=${new Date().getTime()}`;
  return $.http.get(requrl).then((resp) => {
    try {
      const subcaches = getAppSubCaches();
      subcaches[url] = $.toObj(resp.body);
      subcaches[url].updateTime = new Date();
      // 仅缓存存在 id 的订阅
      Object.keys(subcaches).forEach((key) => {
        if (!subcaches[key].hasOwnProperty('id')) {
          delete subcaches[key];
        }
      });
      $.setJson(subcaches, $.KEY_app_subCaches);
      $.log(`更新订阅, 成功! ${url}`);
    } catch (e) {
      $.logErr(e);
      $.log(`更新订阅, 失败! ${url}`);
    }
  });
}

function update(obj, path, value) {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
}

// 自定义并发控制函数
async function limitConcurrency(tasks, limit) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const promise = task(); // 执行任务
    results.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }

    executing.push(promise);
    promise
      .then(() => {
        const index = executing.indexOf(promise);
        if (index !== -1) executing.splice(index, 1);
      })
      .catch(() => {
        const index = executing.indexOf(promise);
        if (index !== -1) executing.splice(index, 1);
      });
  }

  return Promise.all(results);
}

async function reloadAppSubCaches() {
  $.msg($.name, '更新订阅: 开始!');
  const reloadActs = [];
  const usercfgs = getUserCfgs();

  // 收集所有任务（函数形式）
  usercfgs.appsubs.forEach((sub) => {
    reloadActs.push(() => reloadAppSubCache(sub.url)); // 存储函数而不是立即执行的 Promise
  });

  // 使用并发限制执行任务
  await limitConcurrency(reloadActs, 20); // 限制并发数为 20

  $.log(`全部订阅, 完成!`);
  const endTime = new Date().getTime();
  const costTime = (endTime - $.startTime) / 1000;
  $.msg($.name, `更新订阅: 完成! 🕛 ${costTime} 秒`);
}

function upgradeUserData() {
  const usercfgs = getUserCfgs();
  // 如果存在`usercfgs.appsubCaches`则需要升级数据
  const isNeedUpgrade = !!usercfgs.appsubCaches;
  if (isNeedUpgrade) {
    // 迁移订阅缓存至独立的持久化空间
    $.setJson(usercfgs.appsubCaches, $.KEY_app_subCaches);
    // 移除用户偏好中的订阅缓存
    delete usercfgs.appsubCaches;
    usercfgs.appsubs.forEach((sub) => {
      delete sub._raw;
      delete sub.apps;
      delete sub.isErr;
      delete sub.updateTime;
    });
  }
  if (isNeedUpgrade) {
    $.setJson(usercfgs, $.KEY_usercfgs);
  }
}

/**
 * 升级备份数据
 *
 * 升级前: 把所有备份都存到一个持久化空间
 * 升级后: 把每个备份都独立存到一个空间, `$.KEY_backups` 仅记录必要的数据索引
 */
function upgradeGlobalBaks() {
  let oldbaks = $.getData($.KEY_globalBaks);
  let newbaks = $.getJson($.KEY_backups, []);
  const isEmpty = (bak) => [undefined, null, ''].includes(bak);
  const isExistsInNew = (backupId) =>
    newbaks.find((bak) => bak.id === backupId);

  // 存在旧备份数据时, 升级备份数据格式
  if (!isEmpty(oldbaks)) {
    oldbaks = JSON.parse(oldbaks);
    oldbaks.forEach((bak) => {
      if (isEmpty(bak)) return;
      if (isEmpty(bak.bak)) return;
      if (isExistsInNew(bak.id)) return;

      console.log(`正在迁移: ${bak.name}`);
      const backupId = bak.id;
      const backupData = bak.bak;

      // 删除旧的备份数据, 仅保留索引信息
      delete bak.bak;
      newbaks.push(bak);

      // 提取旧备份数据, 存入独立的持久化空间
      $.setJson(backupData, backupId);
    });
    $.setJson(newbaks, $.KEY_backups);
  }

  // 清空所有旧备份的数据
  $.setData('', $.KEY_globalBaks);
}

function updateCurSesssions(appId, data) {
  if (!appId) {
    console.log(`[updateCurSesssions] 跳过! 没有指定 appId!`);
    return;
  }

  const curSessions = getCurSessions();
  const curSessionId = curSessions[appId];
  if (!curSessionId) {
    console.log(
      `[updateCurSesssions] 跳过! 应用 [${appId}] 找不到当前会话, 请先应用会话!`,
    );
    return;
  }

  const sessions = getAppSessions();
  const session = sessions.find((session) => session.id === curSessionId);
  if (!session) {
    console.log(
      `[updateCurSesssions] 跳过! 应用 [${appId}] 找不到当前会话, 请先应用会话!`,
    );
    return;
  }

  session.datas = data;
  $.setJson(sessions, $.KEY_sessions);
}

/**
 * ===================================
 * 结束类函数
 * ===================================
 */
function doneBox() {
  // 记录当前使用哪个域名访问
  $.setData(getHost($request.url), $.KEY_boxjs_host);
  if ($.isOptions) doneOptions();
  else if ($.isPage) donePage();
  else if ($.isQuery) doneQuery();
  else if ($.isApi) doneApi();
  else $.done();
}

function getBaseDoneHeaders(mixHeaders = {}) {
  return Object.assign(
    {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,GET,OPTIONS,PUT,DELETE',
      'Access-Control-Allow-Headers':
        'Origin, X-Requested-With, Content-Type, Accept',
    },
    mixHeaders,
  );
}

function getHtmlDoneHeaders() {
  return getBaseDoneHeaders({
    'Content-Type': 'text/html;charset=UTF-8',
  });
}
function getJsonDoneHeaders() {
  return getBaseDoneHeaders({
    'Content-Type': 'application/json; charset=utf-8',
  });
}

function doneOptions() {
  const headers = getBaseDoneHeaders();
  if ($.isQuanX()) $.done({ headers });
  else $.done({ response: { headers } });
}

function donePage() {
  const headers = getHtmlDoneHeaders();
  if ($.isQuanX()) $.done({ status: 'HTTP/1.1 200', headers, body: $.html });
  else $.done({ response: { status: 200, headers, body: $.html } });
}

function doneQuery() {
  $.json = $.toStr($.json);
  const headers = getJsonDoneHeaders();
  if ($.isQuanX()) $.done({ status: 'HTTP/1.1 200', headers, body: $.json });
  else $.done({ response: { status: 200, headers, body: $.json } });
}

function doneApi() {
  $.json = $.toStr($.json);
  const headers = getJsonDoneHeaders();
  if ($.isQuanX()) $.done({ status: 'HTTP/1.1 200', headers, body: $.json });
  else $.done({ response: { status: 200, headers, body: $.json } });
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
