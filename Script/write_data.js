const CONFIG = {
  // Key 前缀
  keyPrefix: 'id77_p_',

  // 验证码正则表达式（可根据实际情况调整）
  codePattern:
    /(?:验证码|code|CODE|验证码为|验证码是)[：:\s]*([0-9]{4,8})|([0-9]{4,8})\s*(?:为您的验证码)/i,

  // 手机号正则表达式
  phonePattern: /1[3-9]\d{9}/,

  // 短信内容中的手机号匹配模式（支持带星号的格式）
  // 匹配类似：副号:157****7706、手机号：138****1234 等格式
  contentPhonePattern: /(?:副号|手机号|号码)[：:]*\s*(1[3-9]\d[\d*]{7}\d)/i,

  simPhonePattern: /SIM\d_.+?_(?:\+86)?(\d{11})/i,
};

// 支持 GET 和 POST 两种方式提交数据
let params = {};

// 处理 GET 请求参数
if ($request.url.includes('?')) {
  const queryString = $request.url.split('?')[1];
  queryString.split('&').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  });
}

// 处理 POST 请求体（如果存在，POST 数据会覆盖同名的 GET 参数）
if ($request.body) {
  try {
    const body = JSON.parse($request.body);
    params = { ...params, ...body };
  } catch (e) {
    // 如果 body 不是 JSON，尝试作为 URL 编码参数解析
    $request.body.split('&').forEach((pair) => {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    });
  }
}

// 保存参数
Object.keys(params).forEach((key) => {
  let val =
    typeof params[key] === 'string' ? params[key] : JSON.stringify(params[key]);

  if (key === 'sms' && CONFIG.simPhonePattern.test(val)) {
    // 【南京运享通信息科技】验证码是370208【中国移动 和多号副号:157****9323】
    // SIM1_中国电信_18027766772
    // 2026-01-20 21:12:24
    // HONOR 20

    const code = extractVerificationCode(val);
    // 优先使用 短信内 字段作为手机号
    let phoneNumber = null;

    // 尝试从内容或发送者中提取;
    phoneNumber = extractPhoneNumber(val);

    if (!phoneNumber) {
      const simMatch = val.match(CONFIG.simPhonePattern);
      if (simMatch && simMatch[1]) {
        phoneNumber = simMatch[1];
        console.log(`从 SIM 信息中提取到手机号: ${phoneNumber}`);
      }
    }

    if (code && phoneNumber) {
      const key = CONFIG.keyPrefix + phoneNumber;
      console.log(`Key: ${key}, Value: ${code}`);

      $prefs.setValueForKey(code, key);
      console.log(`提取到验证码: ${code}`);
    }
  } else $prefs.setValueForKey(val, key);
});

$done({
  status: 'HTTP/1.1 200',
  headers: {
    'Content-Type': 'application/json;charset=utf-8',
  },
  body: JSON.stringify({
    success: true,
    keys: Object.keys(params),
    method: $request.method || 'unknown',
  }),
});

/**
 * 从短信内容中提取验证码
 */
function extractVerificationCode(content) {
  const match = content.match(CONFIG.codePattern);
  if (match) {
    // 返回第一个匹配的数字组
    return match[1] || match[2];
  }
  return null;
}

/**
 * 从短信中提取手机号
 * 优先从短信内容中提取（如副号、手机号等）
 */
function extractPhoneNumber(content = '') {
  // 首先尝试从短信内容中提取手机号
  if (content) {
    const contentMatch = content.match(CONFIG.contentPhonePattern);
    if (contentMatch && contentMatch[1]) {
      let phone = contentMatch[1];
      // 如果包含星号，尝试保留原始格式或清理
      // 157****7706 -> 保持原样，因为这是部分隐藏的号码
      log(`从短信内容中提取到手机号: ${phone}`);
      return phone;
    }
  }
  // 如果内容中没有，返回空
  return;
}
