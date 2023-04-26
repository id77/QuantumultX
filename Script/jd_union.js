/* 
[rewrite_local]
# 京东联盟
https:\/\/union\.jd\.com\/proManager\/index\?pageNo=1&keywords=\d+ url script-response-body jd_union.js
# 京东联盟短链接
https:\/\/union\.jd\.com\/api\/receivecode\/getCode url script-response-body jd_union.js
[mitm]
hostname = *.jd.com, 
*/

let body = $response.body;
let url = $request.url.replace(/https?:\/\/|\?.*/g, '');

if (url.includes('/api/receivecode/getCode')) {
  body = JSON.parse(body);

  if (body.code !== 200) {
    console.log(`转链失败：${body.message}`);
  }
  const { shortCode, rqCode } = body.data.data;
  $notify('京东联盟', '', `转链成功：${shortCode}`, {
    'open-url': shortCode,
    'media-url': rqCode,
  });

  $done();
}

if (url.includes('/proManager/index')) {
  html = body;
  html =
    html.replace(/(<\/html>)/g, '') +
    `
  <script>
    setTimeout(() => {
        $('#first_sku_btn').click();
        $('.app-wrapper')[0].scrollTop = 230

        setTimeout(() => {
            $('[aria-label="生成推广链接"] .el-button--default').click();
        }, 1000);

     }, 1200);
  </script>
</html>
`;

  $done({ body: html });
}
