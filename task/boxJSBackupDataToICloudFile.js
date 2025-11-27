const $ = new Env('BoxJS数据备份到iCloud');

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

(async () => {
  const boxdata = getBoxData();
  const backupData = {};
  backupData['chavy_boxjs_userCfgs'] = boxdata.usercfgs;
  backupData['chavy_boxjs_sessions'] = boxdata.sessions;
  backupData['chavy_boxjs_cur_sessions'] = boxdata.curSessions;
  backupData['chavy_boxjs_app_subCaches'] = boxdata.appSubCaches;
  Object.assign(backupData, boxdata.datas);

  // 写入 iCloud
  await $.writeFile(
    JSON.stringify(backupData, null, 2),
    `../boxjs/boxjs_${new Date().getDate()}.json`
  );

  $.log('✅ BoxJS 数据已备份到 iCloud 云盘的 QX boxjs 目录下');
  $.msg('BoxJS 数据备份到 iCloud', '', '✅ 备份成功');
})()
  .catch((e) => $.logErr(e))
  .finally(() => $.done());

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
    () => ($.json = {})
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
 * 获取系统配置
 */
function getSystemCfgs() {
  // prettier-ignore
  return {
    env: $.isShadowrocket() ? 'Shadowrocket' : $.isLoon() ? 'Loon' : $.isQuanX() ? 'QuanX' : $.isSurge() ? 'Surge' : 'Node',
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
      // if (opts.body && opts.headers && !opts.headers['Content-Type']) {
      //   opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      // }
      if (opts.headers) {
        delete opts.headers['Host'];
        delete opts.headers['Content-Length'];
      }
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
    }
  })(name, opts);
}
