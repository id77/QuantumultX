/* 
登陆时写入OCR&翻译无限制次数权限
已不再维护，使用微软家的 Translator
[rewrite_local]
# 白描
^https:\/\/baimiao\.uzero\.cn\/api\/v2\.user\/(logout|appLaunchWithUser|loginByWeixin) url script-response-body https://raw.githubusercontent.com/id77/QuantumultX/master/Script/baimiao.js

[mitm]
hostname = api.xiaolanben.com
*/

let obj = JSON.parse($response.body);
obj.value.vip = true;
obj.value.recognize.remainBatch = -100;
obj.value.recognize.remainNormal = -100;
obj.value.recognize.remainTranslate = -100;
obj.value.recognize.recognizeTranslateAll = 1;

$done({ body: JSON.stringify(obj) });
