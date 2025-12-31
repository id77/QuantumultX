### 自用boxJS

仅支持QuantumultX，需要开启 iCloud
cache.js 放 Scripts 文件夹
chavy.boxjs.js 放 Scripts 文件夹
chavy.boxjs.html 放 Data 文件夹

```
hostname = boxjs.com, boxjs.net, *.boxjs.com, *.boxjs.net, cdn.jsdelivr.net, fonts.googleapis.com, 
^https?:\/\/(.+\.)?boxjs\.(com|net) url script-analyze-echo-response chavy.boxjs.js
cdn.jsdelivr.net.+v=id77$ url script-analyze-echo-response cache.js
fonts.googleapis.com.+v=id77$ url script-analyze-echo-response cache.js
```
