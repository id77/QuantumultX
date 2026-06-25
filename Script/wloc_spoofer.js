// QuantumultX WLOC Spoofer (based on proxypin_wloc_compat_v2.js v5.3.0)

/**

^https?:\/\/(gs-loc-cn|gs-loc)\.apple\.com\/clls\/wloc url script-response-body wloc_spoofer.js

hostname = gs-loc-cn.apple.com, gs-loc.apple.com


https://boxjs.my/write?id77_wloc_longitude=*&id77_wloc_latitude=*
*/

// Set target location by editing TARGET_LONGITUDE / TARGET_LATITUDE below.
const pako = initPako();

console.log(`🔍$request keys: ${Object.keys($request).join(', ')}`);

const request = {
  host: $request.headers.Host,
  path: $request.path,
};

console.log('WLOC request host: ' + request.host + ', path: ' + request.path);

var VERSION = '5.3.0';
var TARGET_LONGITUDE = 113.94114;
var TARGET_LATITUDE = 22.544577;
var TARGET_ACCURACY = 25;

if ($prefs.valueForKey('id77_wloc_longitude')) {
  TARGET_LONGITUDE = parseFloat($prefs.valueForKey('id77_wloc_longitude'));
}
if ($prefs.valueForKey('id77_wloc_latitude')) {
  TARGET_LATITUDE = parseFloat($prefs.valueForKey('id77_wloc_latitude'));
}

function isWloc(request) {
  var host = String(request.host || '').toLowerCase();
  var path = String(request.path || '').split('?', 1)[0];
  return (
    (host === 'gs-loc-cn.apple.com' || host === 'gs-loc.apple.com') &&
    path.includes('/clls/wloc')
  );
}

function byteArray(value) {
  if (typeof value.length !== 'number') return [];
  var out = [];
  for (var i = 0; i < value.length; i++) out.push(value[i] & 255);
  return out;
}

function concat(parts) {
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    for (var j = 0; j < parts[i].length; j++) out.push(parts[i][j] & 255);
  }
  return out;
}

function hexByte(n) {
  var s = (n & 255).toString(16);
  return s.length < 2 ? '0' + s : s;
}

function hexPreview(data, count) {
  var n = Math.min(data.length, count);
  var out = [];
  for (var i = 0; i < n; i++) out.push(hexByte(data[i]));
  return out.join('');
}

function frameLenAt(data, offset) {
  if (!data || data.length < offset + 2) return -1;
  return ((data[offset] & 255) << 8) | (data[offset + 1] & 255);
}

function logFrameHex(label, data) {
  var lenAt8 = frameLenAt(data, 8);
  console.log(
    label +
      ' len=' +
      data.length +
      ' head16=' +
      hexPreview(data, 16) +
      ' frameLen@8=' +
      lenAt8,
  );
}

function readVarint(data, offset) {
  var value = 0;
  var shift = 0;
  for (var i = 0; i < 10; i++) {
    if (offset >= data.length) throw new Error('truncated varint');
    var b = data[offset++] & 255;
    // JS number is precise up to 53 bits; for larger varints we still parse
    // boundaries correctly and only keep the lower precise portion in `value`.
    if (shift < 53) value += (b & 127) * Math.pow(2, shift);
    if ((b & 128) === 0) return [value, offset];
    shift += 7;
  }
  throw new Error('varint is too long at ' + offset);
}

function writeVarint(value) {
  var v = Math.floor(value);
  if (v < 0) throw new Error('negative varint is not supported');
  var out = [];
  while (v >= 128) {
    out.push((v % 128) | 128);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return out;
}

function skipValue(data, offset, wireType) {
  if (wireType === 0) return readVarint(data, offset)[1];
  if (wireType === 1) return offset + 8;
  if (wireType === 2) {
    var lenResult = readVarint(data, offset);
    return lenResult[1] + lenResult[0];
  }
  if (wireType === 5) return offset + 4;
  throw new Error('unsupported wire type ' + wireType);
}

function parseFields(data) {
  var out = [];
  var offset = 0;
  while (offset < data.length) {
    var start = offset;
    var tagResult = readVarint(data, offset);
    var tag = tagResult[0];
    offset = tagResult[1];
    var fieldNo = Math.floor(tag / 8);
    var wireType = tag & 7;
    if (fieldNo === 0) throw new Error('invalid protobuf field 0 at ' + start);

    var valueStart = offset;
    var value;
    if (wireType === 0) {
      var valueResult = readVarint(data, offset);
      value = valueResult[0];
      offset = valueResult[1];
    } else if (wireType === 1) {
      offset = skipValue(data, offset, wireType);
      value = data.slice(valueStart, offset);
    } else if (wireType === 2) {
      var lenResult = readVarint(data, offset);
      var length = lenResult[0];
      offset = lenResult[1];
      value = data.slice(offset, offset + length);
      offset += length;
    } else if (wireType === 5) {
      offset = skipValue(data, offset, wireType);
      value = data.slice(valueStart, offset);
    } else {
      throw new Error('unsupported wire type ' + wireType);
    }
    out.push({
      fieldNo: fieldNo,
      wireType: wireType,
      value: value,
      raw: data.slice(start, offset),
    });
  }
  return out;
}

function safeParseFields(data, stats, stage) {
  try {
    return parseFields(data);
  } catch (error) {
    if (stats) {
      stats.parseErrors = (stats.parseErrors || 0) + 1;
      stats.skipped = (stats.skipped || 0) + 1;
      if ((stats.parseLogs || 0) < 3) {
        console.log(
          'WLOC parse fallback at ' +
            stage +
            ': ' +
            errorMessage(error) +
            ', len=' +
            (data ? data.length : 0),
        );
        stats.parseLogs = (stats.parseLogs || 0) + 1;
      }
    }
    return null;
  }
}

function encodeField(fieldNo, wireType, value) {
  var head = writeVarint(fieldNo * 8 + wireType);
  if (wireType === 0) return concat([head, writeVarint(value)]);
  if (wireType === 1 || wireType === 5) return concat([head, value]);
  if (wireType === 2) return concat([head, writeVarint(value.length), value]);
  throw new Error('cannot encode wire type ' + wireType);
}

function patchLocationMessage(data, stats) {
  var fields = safeParseFields(data, stats, 'location');
  if (!fields) return data;
  var hasLat = false;
  var hasLon = false;
  for (var i = 0; i < fields.length; i++) {
    if (fields[i].fieldNo === 1 && fields[i].wireType === 0) hasLat = true;
    if (fields[i].fieldNo === 2 && fields[i].wireType === 0) hasLon = true;
  }
  if (!hasLat || !hasLon) return data;

  var parts = [];
  for (var j = 0; j < fields.length; j++) {
    var f = fields[j];
    if (f.fieldNo === 1 && f.wireType === 0) {
      parts.push(encodeField(1, 0, Math.round(TARGET_LATITUDE * 100000000)));
      if (stats.locationLogs < 1) {
        console.log('WLOC patched latitude: ' + TARGET_LATITUDE);
      }
    } else if (f.fieldNo === 2 && f.wireType === 0) {
      parts.push(encodeField(2, 0, Math.round(TARGET_LONGITUDE * 100000000)));
      if (stats.locationLogs < 1) {
        console.log('WLOC patched longitude: ' + TARGET_LONGITUDE);
        stats.locationLogs += 1;
      }
    } else if (f.fieldNo === 3 && f.wireType === 0) {
      parts.push(encodeField(3, 0, TARGET_ACCURACY));
    } else {
      parts.push(f.raw);
    }
  }
  stats.locations += 1;
  return concat(parts);
}

function patchWifiDevice(data, stats) {
  var fields = safeParseFields(data, stats, 'wifi');
  if (!fields) return data;
  var looksLikeWifi = false;
  for (var b = 0; b < fields.length; b++) {
    if (fields[b].fieldNo === 1 && fields[b].wireType === 2) {
      var s = '';
      for (var c = 0; c < fields[b].value.length; c++)
        s += String.fromCharCode(fields[b].value[c] & 255);
      looksLikeWifi = /^[0-9a-fA-F]{1,2}(:[0-9a-fA-F]{1,2}){5}$/.test(s);
    }
  }
  if (!looksLikeWifi) return data;

  var changed = false;
  var parts = [];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (f.fieldNo === 2 && f.wireType === 2) {
      try {
        var patchedLocation = patchLocationMessage(f.value, stats);
        changed =
          changed ||
          patchedLocation.length !== f.value.length ||
          patchedLocation.join(',') !== f.value.join(',');
        parts.push(encodeField(f.fieldNo, f.wireType, patchedLocation));
      } catch (error) {
        stats.skipped += 1;
        parts.push(f.raw);
      }
    } else {
      parts.push(f.raw);
    }
  }
  if (changed) stats.wifi += 1;
  return concat(parts);
}

function patchCellTower(data, stats) {
  var fields = safeParseFields(data, stats, 'cell');
  if (!fields) return data;
  var changed = false;
  var parts = [];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (f.fieldNo === 5 && f.wireType === 2) {
      try {
        var patchedLocation = patchLocationMessage(f.value, stats);
        changed =
          changed ||
          patchedLocation.length !== f.value.length ||
          patchedLocation.join(',') !== f.value.join(',');
        parts.push(encodeField(f.fieldNo, f.wireType, patchedLocation));
      } catch (error) {
        stats.skipped += 1;
        parts.push(f.raw);
      }
    } else {
      parts.push(f.raw);
    }
  }
  if (changed) stats.cell += 1;
  return concat(parts);
}

function patchPayload(payload, stats) {
  var fields = safeParseFields(payload, stats, 'payload');
  if (!fields) {
    stats.payloadFallback = (stats.payloadFallback || 0) + 1;
    return payload;
  }
  var parts = [];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (f.wireType === 2 && f.fieldNo === 2) {
      try {
        parts.push(
          encodeField(f.fieldNo, f.wireType, patchWifiDevice(f.value, stats)),
        );
      } catch (error) {
        stats.skipped += 1;
        parts.push(f.raw);
      }
    } else if (f.wireType === 2 && (f.fieldNo === 22 || f.fieldNo === 24)) {
      try {
        parts.push(
          encodeField(f.fieldNo, f.wireType, patchCellTower(f.value, stats)),
        );
      } catch (error) {
        stats.skipped += 1;
        parts.push(f.raw);
      }
    } else {
      parts.push(f.raw);
    }
  }
  return concat(parts);
}

function patchFrame(body, stats) {
  if (body.length < 10) throw new Error('body too short: ' + body.length);
  var payloadLen = ((body[8] & 255) << 8) | (body[9] & 255);
  if (payloadLen + 10 > body.length)
    throw new Error(
      'invalid frame length ' + payloadLen + ' for ' + body.length,
    );
  var prefix = body.slice(0, 8);
  var payload = body.slice(10, 10 + payloadLen);
  var suffix = body.slice(10 + payloadLen);
  var patchedPayload = patchPayload(payload, stats);
  if (patchedPayload.length > 65535)
    throw new Error('patched payload too large: ' + patchedPayload.length);
  return concat([
    prefix,
    [(patchedPayload.length >> 8) & 255, patchedPayload.length & 255],
    patchedPayload,
    suffix,
  ]);
}

function errorMessage(error) {
  return String(error && error.message ? error.message : error);
}

function patchFrameOrThrow(body, stats) {
  try {
    return patchFrame(body, stats);
  } catch (error) {
    console.log('error patching frame: ' + errorMessage(error));
    throw error;
  }
}

function responseBody(response) {
  try {
    if (response.rawBody && typeof response.rawBody.length === 'number')
      return byteArray(response.rawBody);

    if (response.bodyBytes && typeof response.bodyBytes.length === 'number')
      return byteArray(response.bodyBytes);

    if (response.bodyBytes && ArrayBuffer !== 'undefined') {
      if (response.bodyBytes instanceof ArrayBuffer)
        return Array.from(new Uint8Array(response.bodyBytes));
      if (ArrayBuffer.isView && ArrayBuffer.isView(response.bodyBytes))
        return Array.from(
          new Uint8Array(
            response.bodyBytes.buffer,
            response.bodyBytes.byteOffset,
            response.bodyBytes.byteLength,
          ),
        );
    }

    if (response.body && ArrayBuffer !== 'undefined') {
      if (response.body instanceof ArrayBuffer)
        return Array.from(new Uint8Array(response.body));
      if (ArrayBuffer.isView && ArrayBuffer.isView(response.body))
        return Array.from(
          new Uint8Array(
            response.body.buffer,
            response.body.byteOffset,
            response.body.byteLength,
          ),
        );
    }

    if (
      response.body &&
      typeof response.body.length === 'number' &&
      typeof response.body !== 'string'
    )
      return byteArray(response.body);

    if (typeof response.body === 'string') {
      var out = [];
      for (var i = 0; i < response.body.length; i++)
        out.push(response.body.charCodeAt(i) & 255);
      return out;
    }
  } catch (error) {
    console.log('error reading response body: ' + JSON.stringify(error));
  }

  return [];
}

function decodedBody(body, stats) {
  if (body.length >= 2 && body[0] === 31 && body[1] === 139) {
    stats.gzip = true;
    var root = (function () {
      return this;
    })();
    var lib =
      (typeof pako !== 'undefined' && pako) ||
      (typeof globalThis !== 'undefined' && globalThis.pako) ||
      (typeof self !== 'undefined' && self.pako) ||
      (root && root.pako);
    if (!lib || typeof lib.ungzip !== 'function') {
      throw new Error('gzip response but pako.ungzip is unavailable');
    }
    return byteArray(lib.ungzip(new Uint8Array(body)));
  }
  return body;
}

function toArrayBuffer(value) {
  if (!value || typeof ArrayBuffer === 'undefined') return null;
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView && ArrayBuffer.isView(value)) {
    return value.buffer.slice(
      value.byteOffset,
      value.byteOffset + value.byteLength,
    );
  }
  return null;
}

function normalizeQXResponseBody(response) {
  if (!response) return;

  var bodyBuffer = toArrayBuffer(response.body);
  if (bodyBuffer) {
    response.bodyBytes = bodyBuffer;
    response.body = undefined;
  } else {
    var bodyBytesBuffer = toArrayBuffer(response.bodyBytes);
    if (bodyBytesBuffer) response.bodyBytes = bodyBytesBuffer;
  }
}

if (!isWloc(request)) {
  console.log('WLOC skip: non-matching request');
  $done({});
  return;
}

var stats = {
  wifi: 0,
  cell: 0,
  locations: 0,
  skipped: 0,
  parseErrors: 0,
  payloadFallback: 0,
  gzip: false,
  locationLogs: 0,
  parseLogs: 0,
};
const modifiedHeaders = $response.headers;
modifiedHeaders['X-WLOC-ProxyPin'] = 'v' + VERSION;
modifiedHeaders['X-WLOC-Mode'] = 'patch-original-response';
modifiedHeaders['X-WLOC-Origin-Status'] = $response.statusCode || '';

const response = {};

try {
  var body = responseBody($response);
  logFrameHex('WLOC input', body);
  modifiedHeaders['X-WLOC-Input-Len'] = body.length;
  var decoded = decodedBody(body, stats);
  logFrameHex('WLOC decoded', decoded);
  console.log(
    'WLOC original body length: ' +
      body.length +
      ', decoded length: ' +
      decoded.length,
  );
  modifiedHeaders['X-WLOC-Decoded-Len'] = decoded.length;
  var patched = patchFrameOrThrow(decoded, stats);
  logFrameHex('WLOC patched', patched);
  console.log('WLOC patched body length: ' + patched.length);
  modifiedHeaders['X-WLOC-Patched-Locations'] = stats.locations;
  modifiedHeaders['X-WLOC-Patched-Wifi'] = stats.wifi;
  modifiedHeaders['X-WLOC-Patched-Cell'] = stats.cell;
  modifiedHeaders['X-WLOC-Skipped'] = stats.skipped;
  modifiedHeaders['X-WLOC-Parse-Errors'] = stats.parseErrors;
  modifiedHeaders['X-WLOC-Payload-Fallback'] = stats.payloadFallback;
  modifiedHeaders['X-WLOC-Gzip'] = stats.gzip ? '1' : '0';
  modifiedHeaders['X-WLOC-Target'] = TARGET_LONGITUDE + ',' + TARGET_LATITUDE;
  console.log(
    'WLOC summary: locations=' +
      stats.locations +
      ', wifi=' +
      stats.wifi +
      ', cell=' +
      stats.cell +
      ', skipped=' +
      stats.skipped +
      ', parseErrors=' +
      stats.parseErrors +
      ', payloadFallback=' +
      stats.payloadFallback,
  );
  modifiedHeaders['Content-Length'] = String(patched.length);
  delete modifiedHeaders['Content-Encoding'];
  delete modifiedHeaders['content-encoding'];
  delete modifiedHeaders['Transfer-Encoding'];
  delete modifiedHeaders['transfer-encoding'];
  response.statusCode = Number($response.statusCode || 200);
  response.status = 'HTTP/1.1 200 OK';
  response.headers = modifiedHeaders;
  response.body = new Uint8Array(patched);
} catch (error) {
  console.log('WLOC patch error: ' + errorMessage(error));
  modifiedHeaders['X-WLOC-Gzip'] = stats.gzip ? '1' : '0';
  modifiedHeaders['X-WLOC-Error'] = errorMessage(error);
  modifiedHeaders['X-WLOC-Parse-Errors'] = stats.parseErrors;
  modifiedHeaders['X-WLOC-Payload-Fallback'] = stats.payloadFallback;
  response.statusCode = Number($response.statusCode || 200);
  response.status = 'HTTP/1.1 ' + String(response.statusCode) + ' OK';
  response.headers = modifiedHeaders;
  if ($response.bodyBytes) {
    response.bodyBytes =
      toArrayBuffer($response.bodyBytes) || $response.bodyBytes;
  } else if ($response.body) {
    response.body = $response.body;
  }
}

normalizeQXResponseBody(response);

$done(response);

// prettier-ignore
function initPako(){const t={};return function(t){"use strict";function e(t){let e=t.length;for(;--e>=0;)t[e]=0}function a(t,e,a,i,n){this.static_tree=t,this.extra_bits=e,this.extra_base=a,this.elems=i,this.max_length=n,this.has_stree=t&&t.length}function i(t,e){this.dyn_tree=t,this.max_code=0,this.stat_desc=e}function n(t,e,a,i,n){this.good_length=t,this.max_lazy=e,this.nice_length=a,this.max_chain=i,this.func=n}function s(){this.strm=null,this.status=0,this.pending_buf=null,this.pending_buf_size=0,this.pending_out=0,this.pending=0,this.wrap=0,this.gzhead=null,this.gzindex=0,this.method=re,this.last_flush=-1,this.w_size=0,this.w_bits=0,this.w_mask=0,this.window=null,this.window_size=0,this.prev=null,this.head=null,this.ins_h=0,this.hash_size=0,this.hash_bits=0,this.hash_mask=0,this.hash_shift=0,this.block_start=0,this.match_length=0,this.prev_match=0,this.match_available=0,this.strstart=0,this.match_start=0,this.lookahead=0,this.prev_length=0,this.max_chain_length=0,this.max_lazy_match=0,this.level=0,this.strategy=0,this.good_match=0,this.nice_match=0,this.dyn_ltree=new Uint16Array(2*we),this.dyn_dtree=new Uint16Array(2*(2*ue+1)),this.bl_tree=new Uint16Array(2*(2*ce+1)),Le(this.dyn_ltree),Le(this.dyn_dtree),Le(this.bl_tree),this.l_desc=null,this.d_desc=null,this.bl_desc=null,this.bl_count=new Uint16Array(be+1),this.heap=new Uint16Array(2*fe+1),Le(this.heap),this.heap_len=0,this.heap_max=0,this.depth=new Uint16Array(2*fe+1),Le(this.depth),this.sym_buf=0,this.lit_bufsize=0,this.sym_next=0,this.sym_end=0,this.opt_len=0,this.static_len=0,this.matches=0,this.insert=0,this.bi_buf=0,this.bi_valid=0}function r(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=2,this.adler=0}function o(t){this.options=ya.assign({level:Ba,method:Ma,chunkSize:16384,windowBits:15,memLevel:8,strategy:Ca},t||{});let e=this.options;e.raw&&e.windowBits>0?e.windowBits=-e.windowBits:e.gzip&&e.windowBits>0&&e.windowBits<16&&(e.windowBits+=16),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new Sa,this.strm.avail_out=0;let a=ga.deflateInit2(this.strm,e.level,e.method,e.windowBits,e.memLevel,e.strategy);if(a!==La)throw new Error(Lt[a]);if(e.header&&ga.deflateSetHeader(this.strm,e.header),e.dictionary){let t;if(t="string"==typeof e.dictionary?Ua.string2buf(e.dictionary):"[object ArrayBuffer]"===Da.call(e.dictionary)?new Uint8Array(e.dictionary):e.dictionary,a=ga.deflateSetDictionary(this.strm,t),a!==La)throw new Error(Lt[a]);this._dict_set=!0}}function l(t,e){const a=new o(e);if(a.push(t,!0),a.err)throw a.msg||Lt[a.err];return a.result}function h(t,e){return e=e||{},e.raw=!0,l(t,e)}function d(t,e){return e=e||{},e.gzip=!0,l(t,e)}function _(){this.strm=null,this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new Uint16Array(320),this.work=new Uint16Array(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}function f(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name="",this.comment="",this.hcrc=0,this.done=!1}function u(t){this.options=ya.assign({chunkSize:65536,windowBits:15,to:""},t||{});const e=this.options;e.raw&&e.windowBits>=0&&e.windowBits<16&&(e.windowBits=-e.windowBits,0===e.windowBits&&(e.windowBits=-15)),!(e.windowBits>=0&&e.windowBits<16)||t&&t.windowBits||(e.windowBits+=32),e.windowBits>15&&e.windowBits<48&&0==(15&e.windowBits)&&(e.windowBits|=15),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new Sa,this.strm.avail_out=0;let a=Dn.inflateInit2(this.strm,e.windowBits);if(a!==Ln)throw new Error(Lt[a]);if(this.header=new Tn,Dn.inflateGetHeader(this.strm,this.header),e.dictionary&&("string"==typeof e.dictionary?e.dictionary=Ua.string2buf(e.dictionary):"[object ArrayBuffer]"===On.call(e.dictionary)&&(e.dictionary=new Uint8Array(e.dictionary)),e.raw&&(a=Dn.inflateSetDictionary(this.strm,e.dictionary),a!==Ln)))throw new Error(Lt[a])}function c(t,e){const a=new u(e);if(a.push(t),a.err)throw a.msg||Lt[a.err];return a.result}function w(t,e){return e=e||{},e.raw=!0,c(t,e)}const b=4,m=0,g=1,p=2,k=0,v=1,y=2,x=3,z=258,A=29,E=256,R=E+1+A,Z=30,U=19,S=2*R+1,D=15,T=16,O=7,I=256,F=16,L=17,N=18,B=new Uint8Array([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0]),C=new Uint8Array([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13]),M=new Uint8Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7]),H=new Uint8Array([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),j=512,K=new Array(2*(R+2));e(K);const P=new Array(2*Z);e(P);const Y=new Array(j);e(Y);const G=new Array(z-x+1);e(G);const X=new Array(A);e(X);const W=new Array(Z);let q,J,Q;e(W);const V=t=>t<256?Y[t]:Y[256+(t>>>7)],$=(t,e)=>{t.pending_buf[t.pending++]=255&e,t.pending_buf[t.pending++]=e>>>8&255},tt=(t,e,a)=>{t.bi_valid>T-a?(t.bi_buf|=e<<t.bi_valid&65535,$(t,t.bi_buf),t.bi_buf=e>>T-t.bi_valid,t.bi_valid+=a-T):(t.bi_buf|=e<<t.bi_valid&65535,t.bi_valid+=a)},et=(t,e,a)=>{tt(t,a[2*e],a[2*e+1])},at=(t,e)=>{let a=0;do{a|=1&t,t>>>=1,a<<=1}while(--e>0);return a>>>1},it=t=>{16===t.bi_valid?($(t,t.bi_buf),t.bi_buf=0,t.bi_valid=0):t.bi_valid>=8&&(t.pending_buf[t.pending++]=255&t.bi_buf,t.bi_buf>>=8,t.bi_valid-=8)},nt=(t,e)=>{const a=e.dyn_tree,i=e.max_code,n=e.stat_desc.static_tree,s=e.stat_desc.has_stree,r=e.stat_desc.extra_bits,o=e.stat_desc.extra_base,l=e.stat_desc.max_length;let h,d,_,f,u,c,w=0;for(f=0;f<=D;f++)t.bl_count[f]=0;for(a[2*t.heap[t.heap_max]+1]=0,h=t.heap_max+1;h<S;h++)d=t.heap[h],f=a[2*a[2*d+1]+1]+1,f>l&&(f=l,w++),a[2*d+1]=f,d>i||(t.bl_count[f]++,u=0,d>=o&&(u=r[d-o]),c=a[2*d],t.opt_len+=c*(f+u),s&&(t.static_len+=c*(n[2*d+1]+u)));if(0!==w){do{for(f=l-1;0===t.bl_count[f];)f--;t.bl_count[f]--,t.bl_count[f+1]+=2,t.bl_count[l]--,w-=2}while(w>0);for(f=l;0!==f;f--)for(d=t.bl_count[f];0!==d;)_=t.heap[--h],_>i||(a[2*_+1]!==f&&(t.opt_len+=(f-a[2*_+1])*a[2*_],a[2*_+1]=f),d--)}},st=(t,e,a)=>{const i=new Array(D+1);let n,s,r=0;for(n=1;n<=D;n++)r=r+a[n-1]<<1,i[n]=r;for(s=0;s<=e;s++){let e=t[2*s+1];0!==e&&(t[2*s]=at(i[e]++,e))}},rt=()=>{let t,e,i,n,s;const r=new Array(D+1);for(i=0,n=0;n<A-1;n++)for(X[n]=i,t=0;t<1<<B[n];t++)G[i++]=n;for(G[i-1]=n,s=0,n=0;n<16;n++)for(W[n]=s,t=0;t<1<<C[n];t++)Y[s++]=n;for(s>>=7;n<Z;n++)for(W[n]=s<<7,t=0;t<1<<C[n]-7;t++)Y[256+s++]=n;for(e=0;e<=D;e++)r[e]=0;for(t=0;t<=143;)K[2*t+1]=8,t++,r[8]++;for(;t<=255;)K[2*t+1]=9,t++,r[9]++;for(;t<=279;)K[2*t+1]=7,t++,r[7]++;for(;t<=287;)K[2*t+1]=8,t++,r[8]++;for(st(K,R+1,r),t=0;t<Z;t++)P[2*t+1]=5,P[2*t]=at(t,5);q=new a(K,B,E+1,R,D),J=new a(P,C,0,Z,D),Q=new a(new Array(0),M,0,U,O)},ot=t=>{let e;for(e=0;e<R;e++)t.dyn_ltree[2*e]=0;for(e=0;e<Z;e++)t.dyn_dtree[2*e]=0;for(e=0;e<U;e++)t.bl_tree[2*e]=0;t.dyn_ltree[2*I]=1,t.opt_len=t.static_len=0,t.sym_next=t.matches=0},lt=t=>{t.bi_valid>8?$(t,t.bi_buf):t.bi_valid>0&&(t.pending_buf[t.pending++]=t.bi_buf),t.bi_buf=0,t.bi_valid=0},ht=(t,e,a,i)=>{const n=2*e,s=2*a;return t[n]<t[s]||t[n]===t[s]&&i[e]<=i[a]},dt=(t,e,a)=>{const i=t.heap[a];let n=a<<1;for(;n<=t.heap_len&&(n<t.heap_len&&ht(e,t.heap[n+1],t.heap[n],t.depth)&&n++,!ht(e,i,t.heap[n],t.depth));)t.heap[a]=t.heap[n],a=n,n<<=1;t.heap[a]=i},_t=(t,e,a)=>{let i,n,s,r,o=0;if(0!==t.sym_next)do{i=255&t.pending_buf[t.sym_buf+o++],i+=(255&t.pending_buf[t.sym_buf+o++])<<8,n=t.pending_buf[t.sym_buf+o++],0===i?et(t,n,e):(s=G[n],et(t,s+E+1,e),r=B[s],0!==r&&(n-=X[s],tt(t,n,r)),i--,s=V(i),et(t,s,a),r=C[s],0!==r&&(i-=W[s],tt(t,i,r)))}while(o<t.sym_next);et(t,I,e)},ft=(t,e)=>{const a=e.dyn_tree,i=e.stat_desc.static_tree,n=e.stat_desc.has_stree,s=e.stat_desc.elems;let r,o,l,h=-1;for(t.heap_len=0,t.heap_max=S,r=0;r<s;r++)0!==a[2*r]?(t.heap[++t.heap_len]=h=r,t.depth[r]=0):a[2*r+1]=0;for(;t.heap_len<2;)l=t.heap[++t.heap_len]=h<2?++h:0,a[2*l]=1,t.depth[l]=0,t.opt_len--,n&&(t.static_len-=i[2*l+1]);for(e.max_code=h,r=t.heap_len>>1;r>=1;r--)dt(t,a,r);l=s;do{r=t.heap[1],t.heap[1]=t.heap[t.heap_len--],dt(t,a,1),o=t.heap[1],t.heap[--t.heap_max]=r,t.heap[--t.heap_max]=o,a[2*l]=a[2*r]+a[2*o],t.depth[l]=(t.depth[r]>=t.depth[o]?t.depth[r]:t.depth[o])+1,a[2*r+1]=a[2*o+1]=l,t.heap[1]=l++,dt(t,a,1)}while(t.heap_len>=2);t.heap[--t.heap_max]=t.heap[1],nt(t,e),st(a,h,t.bl_count)},ut=(t,e,a)=>{let i,n,s=-1,r=e[1],o=0,l=7,h=4;for(0===r&&(l=138,h=3),e[2*(a+1)+1]=65535,i=0;i<=a;i++)n=r,r=e[2*(i+1)+1],++o<l&&n===r||(o<h?t.bl_tree[2*n]+=o:0!==n?(n!==s&&t.bl_tree[2*n]++,t.bl_tree[2*F]++):o<=10?t.bl_tree[2*L]++:t.bl_tree[2*N]++,o=0,s=n,0===r?(l=138,h=3):n===r?(l=6,h=3):(l=7,h=4))},ct=(t,e,a)=>{let i,n,s=-1,r=e[1],o=0,l=7,h=4;for(0===r&&(l=138,h=3),i=0;i<=a;i++)if(n=r,r=e[2*(i+1)+1],!(++o<l&&n===r)){if(o<h)do{et(t,n,t.bl_tree)}while(0!=--o);else 0!==n?(n!==s&&(et(t,n,t.bl_tree),o--),et(t,F,t.bl_tree),tt(t,o-3,2)):o<=10?(et(t,L,t.bl_tree),tt(t,o-3,3)):(et(t,N,t.bl_tree),tt(t,o-11,7));o=0,s=n,0===r?(l=138,h=3):n===r?(l=6,h=3):(l=7,h=4)}},wt=t=>{let e;for(ut(t,t.dyn_ltree,t.l_desc.max_code),ut(t,t.dyn_dtree,t.d_desc.max_code),ft(t,t.bl_desc),e=U-1;e>=3&&0===t.bl_tree[2*H[e]+1];e--);return t.opt_len+=3*(e+1)+5+5+4,e},bt=(t,e,a,i)=>{let n;for(tt(t,e-257,5),tt(t,a-1,5),tt(t,i-4,4),n=0;n<i;n++)tt(t,t.bl_tree[2*H[n]+1],3);ct(t,t.dyn_ltree,e-1),ct(t,t.dyn_dtree,a-1)},mt=t=>{let e,a=4093624447;for(e=0;e<=31;e++,a>>>=1)if(1&a&&0!==t.dyn_ltree[2*e])return m;if(0!==t.dyn_ltree[18]||0!==t.dyn_ltree[20]||0!==t.dyn_ltree[26])return g;for(e=32;e<E;e++)if(0!==t.dyn_ltree[2*e])return g;return m};let gt=!1;const pt=t=>{gt||(rt(),gt=!0),t.l_desc=new i(t.dyn_ltree,q),t.d_desc=new i(t.dyn_dtree,J),t.bl_desc=new i(t.bl_tree,Q),t.bi_buf=0,t.bi_valid=0,ot(t)},kt=(t,e,a,i)=>{tt(t,(k<<1)+(i?1:0),3),lt(t),$(t,a),$(t,~a),a&&t.pending_buf.set(t.window.subarray(e,e+a),t.pending),t.pending+=a},vt=t=>{tt(t,v<<1,3),et(t,I,K),it(t)},yt=(t,e,a,i)=>{let n,s,r=0;t.level>0?(t.strm.data_type===p&&(t.strm.data_type=mt(t)),ft(t,t.l_desc),ft(t,t.d_desc),r=wt(t),n=t.opt_len+3+7>>>3,s=t.static_len+3+7>>>3,s<=n&&(n=s)):n=s=a+5,a+4<=n&&-1!==e?kt(t,e,a,i):t.strategy===b||s===n?(tt(t,(v<<1)+(i?1:0),3),_t(t,K,P)):(tt(t,(y<<1)+(i?1:0),3),bt(t,t.l_desc.max_code+1,t.d_desc.max_code+1,r+1),_t(t,t.dyn_ltree,t.dyn_dtree)),ot(t),i&&lt(t)},xt=(t,e,a)=>(t.pending_buf[t.sym_buf+t.sym_next++]=e,t.pending_buf[t.sym_buf+t.sym_next++]=e>>8,t.pending_buf[t.sym_buf+t.sym_next++]=a,0===e?t.dyn_ltree[2*a]++:(t.matches++,e--,t.dyn_ltree[2*(G[a]+E+1)]++,t.dyn_dtree[2*V(e)]++),t.sym_next===t.sym_end);var zt=pt,At=kt,Et=yt,Rt=xt,Zt=vt,Ut={_tr_init:zt,_tr_stored_block:At,_tr_flush_block:Et,_tr_tally:Rt,_tr_align:Zt};const St=(t,e,a,i)=>{let n=65535&t|0,s=t>>>16&65535|0,r=0;for(;0!==a;){r=a>2e3?2e3:a,a-=r;do{n=n+e[i++]|0,s=s+n|0}while(--r);n%=65521,s%=65521}return n|s<<16|0};var Dt=St;const Tt=()=>{let t,e=[];for(var a=0;a<256;a++){t=a;for(var i=0;i<8;i++)t=1&t?3988292384^t>>>1:t>>>1;e[a]=t}return e},Ot=new Uint32Array(Tt()),It=(t,e,a,i)=>{const n=Ot,s=i+a;t^=-1;for(let a=i;a<s;a++)t=t>>>8^n[255&(t^e[a])];return-1^t};var Ft=It,Lt={2:"need dictionary",1:"stream end",0:"","-1":"file error","-2":"stream error","-3":"data error","-4":"insufficient memory","-5":"buffer error","-6":"incompatible version"},Nt={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_MEM_ERROR:-4,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8};const{_tr_init:Bt,_tr_stored_block:Ct,_tr_flush_block:Mt,_tr_tally:Ht,_tr_align:jt}=Ut,{Z_NO_FLUSH:Kt,Z_PARTIAL_FLUSH:Pt,Z_FULL_FLUSH:Yt,Z_FINISH:Gt,Z_BLOCK:Xt,Z_OK:Wt,Z_STREAM_END:qt,Z_STREAM_ERROR:Jt,Z_DATA_ERROR:Qt,Z_BUF_ERROR:Vt,Z_DEFAULT_COMPRESSION:$t,Z_FILTERED:te,Z_HUFFMAN_ONLY:ee,Z_RLE:ae,Z_FIXED:ie,Z_DEFAULT_STRATEGY:ne,Z_UNKNOWN:se,Z_DEFLATED:re}=Nt,oe=9,le=15,he=8,de=29,_e=256,fe=_e+1+de,ue=30,ce=19,we=2*fe+1,be=15,me=3,ge=258,pe=ge+me+1,ke=32,ve=42,ye=57,xe=69,ze=73,Ae=91,Ee=103,Re=113,Ze=666,Ue=1,Se=2,De=3,Te=4,Oe=3,Ie=(t,e)=>(t.msg=Lt[e],e),Fe=t=>2*t-(t>4?9:0),Le=t=>{let e=t.length;for(;--e>=0;)t[e]=0},Ne=t=>{let e,a,i,n=t.w_size;e=t.hash_size,i=e;do{a=t.head[--i],t.head[i]=a>=n?a-n:0}while(--e);e=n,i=e;do{a=t.prev[--i],t.prev[i]=a>=n?a-n:0}while(--e)};let Be=(t,e,a)=>(e<<t.hash_shift^a)&t.hash_mask,Ce=Be;const Me=t=>{const e=t.state;let a=e.pending;a>t.avail_out&&(a=t.avail_out),0!==a&&(t.output.set(e.pending_buf.subarray(e.pending_out,e.pending_out+a),t.next_out),t.next_out+=a,e.pending_out+=a,t.total_out+=a,t.avail_out-=a,e.pending-=a,0===e.pending&&(e.pending_out=0))},He=(t,e)=>{Mt(t,t.block_start>=0?t.block_start:-1,t.strstart-t.block_start,e),t.block_start=t.strstart,Me(t.strm)},je=(t,e)=>{t.pending_buf[t.pending++]=e},Ke=(t,e)=>{t.pending_buf[t.pending++]=e>>>8&255,t.pending_buf[t.pending++]=255&e},Pe=(t,e,a,i)=>{let n=t.avail_in;return n>i&&(n=i),0===n?0:(t.avail_in-=n,e.set(t.input.subarray(t.next_in,t.next_in+n),a),1===t.state.wrap?t.adler=Dt(t.adler,e,n,a):2===t.state.wrap&&(t.adler=Ft(t.adler,e,n,a)),t.next_in+=n,t.total_in+=n,n)},Ye=(t,e)=>{let a,i,n=t.max_chain_length,s=t.strstart,r=t.prev_length,o=t.nice_match;const l=t.strstart>t.w_size-pe?t.strstart-(t.w_size-pe):0,h=t.window,d=t.w_mask,_=t.prev,f=t.strstart+ge;let u=h[s+r-1],c=h[s+r];t.prev_length>=t.good_match&&(n>>=2),o>t.lookahead&&(o=t.lookahead);do{if(a=e,h[a+r]===c&&h[a+r-1]===u&&h[a]===h[s]&&h[++a]===h[s+1]){s+=2,a++;do{}while(h[++s]===h[++a]&&h[++s]===h[++a]&&h[++s]===h[++a]&&h[++s]===h[++a]&&h[++s]===h[++a]&&h[++s]===h[++a]&&h[++s]===h[++a]&&h[++s]===h[++a]&&s<f);if(i=ge-(f-s),s=f-ge,i>r){if(t.match_start=e,r=i,i>=o)break;u=h[s+r-1],c=h[s+r]}}}while((e=_[e&d])>l&&0!=--n);return r<=t.lookahead?r:t.lookahead},Ge=t=>{const e=t.w_size;let a,i,n;do{if(i=t.window_size-t.lookahead-t.strstart,t.strstart>=e+(e-pe)&&(t.window.set(t.window.subarray(e,e+e-i),0),t.match_start-=e,t.strstart-=e,t.block_start-=e,t.insert>t.strstart&&(t.insert=t.strstart),Ne(t),i+=e),0===t.strm.avail_in)break;if(a=Pe(t.strm,t.window,t.strstart+t.lookahead,i),t.lookahead+=a,t.lookahead+t.insert>=me)for(n=t.strstart-t.insert,t.ins_h=t.window[n],t.ins_h=Ce(t,t.ins_h,t.window[n+1]);t.insert&&(t.ins_h=Ce(t,t.ins_h,t.window[n+me-1]),t.prev[n&t.w_mask]=t.head[t.ins_h],t.head[t.ins_h]=n,n++,t.insert--,!(t.lookahead+t.insert<me)););}while(t.lookahead<pe&&0!==t.strm.avail_in)},Xe=(t,e)=>{let a,i,n,s=t.pending_buf_size-5>t.w_size?t.w_size:t.pending_buf_size-5,r=0,o=t.strm.avail_in;do{if(a=65535,n=t.bi_valid+42>>3,t.strm.avail_out<n)break;if(n=t.strm.avail_out-n,i=t.strstart-t.block_start,a>i+t.strm.avail_in&&(a=i+t.strm.avail_in),a>n&&(a=n),a<s&&(0===a&&e!==Gt||e===Kt||a!==i+t.strm.avail_in))break;r=e===Gt&&a===i+t.strm.avail_in?1:0,Ct(t,0,0,r),t.pending_buf[t.pending-4]=a,t.pending_buf[t.pending-3]=a>>8,t.pending_buf[t.pending-2]=~a,t.pending_buf[t.pending-1]=~a>>8,Me(t.strm),i&&(i>a&&(i=a),t.strm.output.set(t.window.subarray(t.block_start,t.block_start+i),t.strm.next_out),t.strm.next_out+=i,t.strm.avail_out-=i,t.strm.total_out+=i,t.block_start+=i,a-=i),a&&(Pe(t.strm,t.strm.output,t.strm.next_out,a),t.strm.next_out+=a,t.strm.avail_out-=a,t.strm.total_out+=a)}while(0===r);return o-=t.strm.avail_in,o&&(o>=t.w_size?(t.matches=2,t.window.set(t.strm.input.subarray(t.strm.next_in-t.w_size,t.strm.next_in),0),t.strstart=t.w_size,t.insert=t.strstart):(t.window_size-t.strstart<=o&&(t.strstart-=t.w_size,t.window.set(t.window.subarray(t.w_size,t.w_size+t.strstart),0),t.matches<2&&t.matches++,t.insert>t.strstart&&(t.insert=t.strstart)),t.window.set(t.strm.input.subarray(t.strm.next_in-o,t.strm.next_in),t.strstart),t.strstart+=o,t.insert+=o>t.w_size-t.insert?t.w_size-t.insert:o),t.block_start=t.strstart),t.high_water<t.strstart&&(t.high_water=t.strstart),r?Te:e!==Kt&&e!==Gt&&0===t.strm.avail_in&&t.strstart===t.block_start?Se:(n=t.window_size-t.strstart,t.strm.avail_in>n&&t.block_start>=t.w_size&&(t.block_start-=t.w_size,t.strstart-=t.w_size,t.window.set(t.window.subarray(t.w_size,t.w_size+t.strstart),0),t.matches<2&&t.matches++,n+=t.w_size,t.insert>t.strstart&&(t.insert=t.strstart)),n>t.strm.avail_in&&(n=t.strm.avail_in),n&&(Pe(t.strm,t.window,t.strstart,n),t.strstart+=n,t.insert+=n>t.w_size-t.insert?t.w_size-t.insert:n),t.high_water<t.strstart&&(t.high_water=t.strstart),n=t.bi_valid+42>>3,n=t.pending_buf_size-n>65535?65535:t.pending_buf_size-n,s=n>t.w_size?t.w_size:n,i=t.strstart-t.block_start,(i>=s||(i||e===Gt)&&e!==Kt&&0===t.strm.avail_in&&i<=n)&&(a=i>n?n:i,r=e===Gt&&0===t.strm.avail_in&&a===i?1:0,Ct(t,t.block_start,a,r),t.block_start+=a,Me(t.strm)),r?De:Ue)},We=(t,e)=>{let a,i;for(;;){if(t.lookahead<pe){if(Ge(t),t.lookahead<pe&&e===Kt)return Ue;if(0===t.lookahead)break}if(a=0,t.lookahead>=me&&(t.ins_h=Ce(t,t.ins_h,t.window[t.strstart+me-1]),a=t.prev[t.strstart&t.w_mask]=t.head[t.ins_h],t.head[t.ins_h]=t.strstart),0!==a&&t.strstart-a<=t.w_size-pe&&(t.match_length=Ye(t,a)),t.match_length>=me)if(i=Ht(t,t.strstart-t.match_start,t.match_length-me),t.lookahead-=t.match_length,t.match_length<=t.max_lazy_match&&t.lookahead>=me){t.match_length--;do{t.strstart++,t.ins_h=Ce(t,t.ins_h,t.window[t.strstart+me-1]),a=t.prev[t.strstart&t.w_mask]=t.head[t.ins_h],t.head[t.ins_h]=t.strstart}while(0!=--t.match_length);t.strstart++}else t.strstart+=t.match_length,t.match_length=0,t.ins_h=t.window[t.strstart],t.ins_h=Ce(t,t.ins_h,t.window[t.strstart+1]);else i=Ht(t,0,t.window[t.strstart]),t.lookahead--,t.strstart++;if(i&&(He(t,!1),0===t.strm.avail_out))return Ue}return t.insert=t.strstart<me-1?t.strstart:me-1,e===Gt?(He(t,!0),0===t.strm.avail_out?De:Te):t.sym_next&&(He(t,!1),0===t.strm.avail_out)?Ue:Se},qe=(t,e)=>{let a,i,n;for(;;){if(t.lookahead<pe){if(Ge(t),t.lookahead<pe&&e===Kt)return Ue;if(0===t.lookahead)break}if(a=0,t.lookahead>=me&&(t.ins_h=Ce(t,t.ins_h,t.window[t.strstart+me-1]),a=t.prev[t.strstart&t.w_mask]=t.head[t.ins_h],t.head[t.ins_h]=t.strstart),t.prev_length=t.match_length,t.prev_match=t.match_start,t.match_length=me-1,0!==a&&t.prev_length<t.max_lazy_match&&t.strstart-a<=t.w_size-pe&&(t.match_length=Ye(t,a),t.match_length<=5&&(t.strategy===te||t.match_length===me&&t.strstart-t.match_start>4096)&&(t.match_length=me-1)),t.prev_length>=me&&t.match_length<=t.prev_length){n=t.strstart+t.lookahead-me,i=Ht(t,t.strstart-1-t.prev_match,t.prev_length-me),t.lookahead-=t.prev_length-1,t.prev_length-=2;do{++t.strstart<=n&&(t.ins_h=Ce(t,t.ins_h,t.window[t.strstart+me-1]),a=t.prev[t.strstart&t.w_mask]=t.head[t.ins_h],t.head[t.ins_h]=t.strstart)}while(0!=--t.prev_length);if(t.match_available=0,t.match_length=me-1,t.strstart++,i&&(He(t,!1),0===t.strm.avail_out))return Ue}else if(t.match_available){if(i=Ht(t,0,t.window[t.strstart-1]),i&&He(t,!1),t.strstart++,t.lookahead--,0===t.strm.avail_out)return Ue}else t.match_available=1,t.strstart++,t.lookahead--}return t.match_available&&(i=Ht(t,0,t.window[t.strstart-1]),t.match_available=0),t.insert=t.strstart<me-1?t.strstart:me-1,e===Gt?(He(t,!0),0===t.strm.avail_out?De:Te):t.sym_next&&(He(t,!1),0===t.strm.avail_out)?Ue:Se},Je=(t,e)=>{let a,i,n,s;const r=t.window;for(;;){if(t.lookahead<=ge){if(Ge(t),t.lookahead<=ge&&e===Kt)return Ue;if(0===t.lookahead)break}if(t.match_length=0,t.lookahead>=me&&t.strstart>0&&(n=t.strstart-1,i=r[n],i===r[++n]&&i===r[++n]&&i===r[++n])){s=t.strstart+ge;do{}while(i===r[++n]&&i===r[++n]&&i===r[++n]&&i===r[++n]&&i===r[++n]&&i===r[++n]&&i===r[++n]&&i===r[++n]&&n<s);t.match_length=ge-(s-n),t.match_length>t.lookahead&&(t.match_length=t.lookahead)}if(t.match_length>=me?(a=Ht(t,1,t.match_length-me),t.lookahead-=t.match_length,t.strstart+=t.match_length,t.match_length=0):(a=Ht(t,0,t.window[t.strstart]),t.lookahead--,t.strstart++),a&&(He(t,!1),0===t.strm.avail_out))return Ue}return t.insert=0,e===Gt?(He(t,!0),0===t.strm.avail_out?De:Te):t.sym_next&&(He(t,!1),0===t.strm.avail_out)?Ue:Se},Qe=(t,e)=>{let a;for(;;){if(0===t.lookahead&&(Ge(t),0===t.lookahead)){if(e===Kt)return Ue;break}if(t.match_length=0,a=Ht(t,0,t.window[t.strstart]),t.lookahead--,t.strstart++,a&&(He(t,!1),0===t.strm.avail_out))return Ue}return t.insert=0,e===Gt?(He(t,!0),0===t.strm.avail_out?De:Te):t.sym_next&&(He(t,!1),0===t.strm.avail_out)?Ue:Se},Ve=[new n(0,0,0,0,Xe),new n(4,4,8,4,We),new n(4,5,16,8,We),new n(4,6,32,32,We),new n(4,4,16,16,qe),new n(8,16,32,32,qe),new n(8,16,128,128,qe),new n(8,32,128,256,qe),new n(32,128,258,1024,qe),new n(32,258,258,4096,qe)],$e=t=>{t.window_size=2*t.w_size,Le(t.head),t.max_lazy_match=Ve[t.level].max_lazy,t.good_match=Ve[t.level].good_length,t.nice_match=Ve[t.level].nice_length,t.max_chain_length=Ve[t.level].max_chain,t.strstart=0,t.block_start=0,t.lookahead=0,t.insert=0,t.match_length=t.prev_length=me-1,t.match_available=0,t.ins_h=0},ta=t=>{if(!t)return 1;const e=t.state;return!e||e.strm!==t||e.status!==ve&&e.status!==ye&&e.status!==xe&&e.status!==ze&&e.status!==Ae&&e.status!==Ee&&e.status!==Re&&e.status!==Ze?1:0},ea=t=>{if(ta(t))return Ie(t,Jt);t.total_in=t.total_out=0,t.data_type=se;const e=t.state;return e.pending=0,e.pending_out=0,e.wrap<0&&(e.wrap=-e.wrap),e.status=2===e.wrap?ye:e.wrap?ve:Re,t.adler=2===e.wrap?0:1,e.last_flush=-2,Bt(e),Wt},aa=t=>{const e=ea(t);return e===Wt&&$e(t.state),e},ia=(t,e)=>ta(t)||2!==t.state.wrap?Jt:(t.state.gzhead=e,Wt),na=(t,e,a,i,n,r)=>{if(!t)return Jt;let o=1;if(e===$t&&(e=6),i<0?(o=0,i=-i):i>15&&(o=2,i-=16),n<1||n>oe||a!==re||i<8||i>15||e<0||e>9||r<0||r>ie||8===i&&1!==o)return Ie(t,Jt);8===i&&(i=9);const l=new s;return t.state=l,l.strm=t,l.status=ve,l.wrap=o,l.gzhead=null,l.w_bits=i,l.w_size=1<<l.w_bits,l.w_mask=l.w_size-1,l.hash_bits=n+7,l.hash_size=1<<l.hash_bits,l.hash_mask=l.hash_size-1,l.hash_shift=~~((l.hash_bits+me-1)/me),l.window=new Uint8Array(2*l.w_size),l.head=new Uint16Array(l.hash_size),l.prev=new Uint16Array(l.w_size),l.lit_bufsize=1<<n+6,l.pending_buf_size=4*l.lit_bufsize,l.pending_buf=new Uint8Array(l.pending_buf_size),l.sym_buf=l.lit_bufsize,l.sym_end=3*(l.lit_bufsize-1),l.level=e,l.strategy=r,l.method=a,aa(t)},sa=(t,e)=>na(t,e,re,le,he,ne),ra=(t,e)=>{if(ta(t)||e>Xt||e<0)return t?Ie(t,Jt):Jt;const a=t.state;if(!t.output||0!==t.avail_in&&!t.input||a.status===Ze&&e!==Gt)return Ie(t,0===t.avail_out?Vt:Jt);const i=a.last_flush;if(a.last_flush=e,0!==a.pending){if(Me(t),0===t.avail_out)return a.last_flush=-1,Wt}else if(0===t.avail_in&&Fe(e)<=Fe(i)&&e!==Gt)return Ie(t,Vt);if(a.status===Ze&&0!==t.avail_in)return Ie(t,Vt);if(a.status===ve&&0===a.wrap&&(a.status=Re),a.status===ve){let e=re+(a.w_bits-8<<4)<<8,i=-1;if(i=a.strategy>=ee||a.level<2?0:a.level<6?1:6===a.level?2:3,e|=i<<6,0!==a.strstart&&(e|=ke),e+=31-e%31,Ke(a,e),0!==a.strstart&&(Ke(a,t.adler>>>16),Ke(a,65535&t.adler)),t.adler=1,a.status=Re,Me(t),0!==a.pending)return a.last_flush=-1,Wt}if(a.status===ye)if(t.adler=0,je(a,31),je(a,139),je(a,8),a.gzhead)je(a,(a.gzhead.text?1:0)+(a.gzhead.hcrc?2:0)+(a.gzhead.extra?4:0)+(a.gzhead.name?8:0)+(a.gzhead.comment?16:0)),je(a,255&a.gzhead.time),je(a,a.gzhead.time>>8&255),je(a,a.gzhead.time>>16&255),je(a,a.gzhead.time>>24&255),je(a,9===a.level?2:a.strategy>=ee||a.level<2?4:0),je(a,255&a.gzhead.os),a.gzhead.extra&&a.gzhead.extra.length&&(je(a,255&a.gzhead.extra.length),je(a,a.gzhead.extra.length>>8&255)),a.gzhead.hcrc&&(t.adler=Ft(t.adler,a.pending_buf,a.pending,0)),a.gzindex=0,a.status=xe;else if(je(a,0),je(a,0),je(a,0),je(a,0),je(a,0),je(a,9===a.level?2:a.strategy>=ee||a.level<2?4:0),je(a,Oe),a.status=Re,Me(t),0!==a.pending)return a.last_flush=-1,Wt;if(a.status===xe){if(a.gzhead.extra){let e=a.pending,i=(65535&a.gzhead.extra.length)-a.gzindex;for(;a.pending+i>a.pending_buf_size;){let n=a.pending_buf_size-a.pending;if(a.pending_buf.set(a.gzhead.extra.subarray(a.gzindex,a.gzindex+n),a.pending),a.pending=a.pending_buf_size,a.gzhead.hcrc&&a.pending>e&&(t.adler=Ft(t.adler,a.pending_buf,a.pending-e,e)),a.gzindex+=n,Me(t),0!==a.pending)return a.last_flush=-1,Wt;e=0,i-=n}let n=new Uint8Array(a.gzhead.extra);a.pending_buf.set(n.subarray(a.gzindex,a.gzindex+i),a.pending),a.pending+=i,a.gzhead.hcrc&&a.pending>e&&(t.adler=Ft(t.adler,a.pending_buf,a.pending-e,e)),a.gzindex=0}a.status=ze}if(a.status===ze){if(a.gzhead.name){let e,i=a.pending;do{if(a.pending===a.pending_buf_size){if(a.gzhead.hcrc&&a.pending>i&&(t.adler=Ft(t.adler,a.pending_buf,a.pending-i,i)),Me(t),0!==a.pending)return a.last_flush=-1,Wt;i=0}e=a.gzindex<a.gzhead.name.length?255&a.gzhead.name.charCodeAt(a.gzindex++):0,je(a,e)}while(0!==e);a.gzhead.hcrc&&a.pending>i&&(t.adler=Ft(t.adler,a.pending_buf,a.pending-i,i)),a.gzindex=0}a.status=Ae}if(a.status===Ae){if(a.gzhead.comment){let e,i=a.pending;do{if(a.pending===a.pending_buf_size){if(a.gzhead.hcrc&&a.pending>i&&(t.adler=Ft(t.adler,a.pending_buf,a.pending-i,i)),Me(t),0!==a.pending)return a.last_flush=-1,Wt;i=0}e=a.gzindex<a.gzhead.comment.length?255&a.gzhead.comment.charCodeAt(a.gzindex++):0,je(a,e)}while(0!==e);a.gzhead.hcrc&&a.pending>i&&(t.adler=Ft(t.adler,a.pending_buf,a.pending-i,i))}a.status=Ee}if(a.status===Ee){if(a.gzhead.hcrc){if(a.pending+2>a.pending_buf_size&&(Me(t),0!==a.pending))return a.last_flush=-1,Wt;je(a,255&t.adler),je(a,t.adler>>8&255),t.adler=0}if(a.status=Re,Me(t),0!==a.pending)return a.last_flush=-1,Wt}if(0!==t.avail_in||0!==a.lookahead||e!==Kt&&a.status!==Ze){let i=0===a.level?Xe(a,e):a.strategy===ee?Qe(a,e):a.strategy===ae?Je(a,e):Ve[a.level].func(a,e);if(i!==De&&i!==Te||(a.status=Ze),i===Ue||i===De)return 0===t.avail_out&&(a.last_flush=-1),Wt;if(i===Se&&(e===Pt?jt(a):e!==Xt&&(Ct(a,0,0,!1),e===Yt&&(Le(a.head),0===a.lookahead&&(a.strstart=0,a.block_start=0,a.insert=0))),Me(t),0===t.avail_out))return a.last_flush=-1,Wt}return e!==Gt?Wt:a.wrap<=0?qt:(2===a.wrap?(je(a,255&t.adler),je(a,t.adler>>8&255),je(a,t.adler>>16&255),je(a,t.adler>>24&255),je(a,255&t.total_in),je(a,t.total_in>>8&255),je(a,t.total_in>>16&255),je(a,t.total_in>>24&255)):(Ke(a,t.adler>>>16),Ke(a,65535&t.adler)),Me(t),a.wrap>0&&(a.wrap=-a.wrap),0!==a.pending?Wt:qt)},oa=t=>{if(ta(t))return Jt;const e=t.state.status;return t.state=null,e===Re?Ie(t,Qt):Wt},la=(t,e)=>{let a=e.length;if(ta(t))return Jt;const i=t.state,n=i.wrap;if(2===n||1===n&&i.status!==ve||i.lookahead)return Jt;if(1===n&&(t.adler=Dt(t.adler,e,a,0)),i.wrap=0,a>=i.w_size){0===n&&(Le(i.head),i.strstart=0,i.block_start=0,i.insert=0);let t=new Uint8Array(i.w_size);t.set(e.subarray(a-i.w_size,a),0),e=t,a=i.w_size}const s=t.avail_in,r=t.next_in,o=t.input;for(t.avail_in=a,t.next_in=0,t.input=e,Ge(i);i.lookahead>=me;){let t=i.strstart,e=i.lookahead-(me-1);do{i.ins_h=Ce(i,i.ins_h,i.window[t+me-1]),i.prev[t&i.w_mask]=i.head[i.ins_h],i.head[i.ins_h]=t,t++}while(--e);i.strstart=t,i.lookahead=me-1,Ge(i)}return i.strstart+=i.lookahead,i.block_start=i.strstart,i.insert=i.lookahead,i.lookahead=0,i.match_length=i.prev_length=me-1,i.match_available=0,t.next_in=r,t.input=o,t.avail_in=s,i.wrap=n,Wt};var ha=sa,da=na,_a=aa,fa=ea,ua=ia,ca=ra,wa=oa,ba=la,ma="pako deflate (from Nodeca project)",ga={deflateInit:ha,deflateInit2:da,deflateReset:_a,deflateResetKeep:fa,deflateSetHeader:ua,deflate:ca,deflateEnd:wa,deflateSetDictionary:ba,deflateInfo:ma};const pa=(t,e)=>Object.prototype.hasOwnProperty.call(t,e);var ka=function(t){const e=Array.prototype.slice.call(arguments,1);for(;e.length;){const a=e.shift();if(a){if("object"!=typeof a)throw new TypeError(a+"must be non-object");for(const e in a)pa(a,e)&&(t[e]=a[e])}}return t},va=t=>{let e=0;for(let a=0,i=t.length;a<i;a++)e+=t[a].length;const a=new Uint8Array(e);for(let e=0,i=0,n=t.length;e<n;e++){let n=t[e];a.set(n,i),i+=n.length}return a},ya={assign:ka,flattenChunks:va};let xa=!0;try{String.fromCharCode.apply(null,new Uint8Array(1))}catch(t){xa=!1}const za=new Uint8Array(256);for(let t=0;t<256;t++)za[t]=t>=252?6:t>=248?5:t>=240?4:t>=224?3:t>=192?2:1;za[254]=za[254]=1;var Aa=t=>{if("function"==typeof TextEncoder&&TextEncoder.prototype.encode)return(new TextEncoder).encode(t);let e,a,i,n,s,r=t.length,o=0;for(n=0;n<r;n++)a=t.charCodeAt(n),55296==(64512&a)&&n+1<r&&(i=t.charCodeAt(n+1),56320==(64512&i)&&(a=65536+(a-55296<<10)+(i-56320),n++)),o+=a<128?1:a<2048?2:a<65536?3:4;for(e=new Uint8Array(o),s=0,n=0;s<o;n++)a=t.charCodeAt(n),55296==(64512&a)&&n+1<r&&(i=t.charCodeAt(n+1),56320==(64512&i)&&(a=65536+(a-55296<<10)+(i-56320),n++)),a<128?e[s++]=a:a<2048?(e[s++]=192|a>>>6,e[s++]=128|63&a):a<65536?(e[s++]=224|a>>>12,e[s++]=128|a>>>6&63,e[s++]=128|63&a):(e[s++]=240|a>>>18,e[s++]=128|a>>>12&63,e[s++]=128|a>>>6&63,e[s++]=128|63&a);return e};const Ea=(t,e)=>{if(e<65534&&t.subarray&&xa)return String.fromCharCode.apply(null,t.length===e?t:t.subarray(0,e));let a="";for(let i=0;i<e;i++)a+=String.fromCharCode(t[i]);return a};var Ra=(t,e)=>{const a=e||t.length;if("function"==typeof TextDecoder&&TextDecoder.prototype.decode)return(new TextDecoder).decode(t.subarray(0,e));let i,n;const s=new Array(2*a);for(n=0,i=0;i<a;){let e=t[i++];if(e<128){s[n++]=e;continue}let r=za[e];if(r>4)s[n++]=65533,i+=r-1;else{for(e&=2===r?31:3===r?15:7;r>1&&i<a;)e=e<<6|63&t[i++],r--;r>1?s[n++]=65533:e<65536?s[n++]=e:(e-=65536,s[n++]=55296|e>>10&1023,s[n++]=56320|1023&e)}}return Ea(s,n)},Za=(t,e)=>{e=e||t.length,e>t.length&&(e=t.length);let a=e-1;for(;a>=0&&128==(192&t[a]);)a--;return a<0?e:0===a?e:a+za[t[a]]>e?a:e},Ua={string2buf:Aa,buf2string:Ra,utf8border:Za},Sa=r;const Da=Object.prototype.toString,{Z_NO_FLUSH:Ta,Z_SYNC_FLUSH:Oa,Z_FULL_FLUSH:Ia,Z_FINISH:Fa,Z_OK:La,Z_STREAM_END:Na,Z_DEFAULT_COMPRESSION:Ba,Z_DEFAULT_STRATEGY:Ca,Z_DEFLATED:Ma}=Nt;o.prototype.push=function(t,e){const a=this.strm,i=this.options.chunkSize;let n,s;if(this.ended)return!1;for(s=e===~~e?e:!0===e?Fa:Ta,"string"==typeof t?a.input=Ua.string2buf(t):"[object ArrayBuffer]"===Da.call(t)?a.input=new Uint8Array(t):a.input=t,a.next_in=0,a.avail_in=a.input.length;;)if(0===a.avail_out&&(a.output=new Uint8Array(i),a.next_out=0,a.avail_out=i),(s===Oa||s===Ia)&&a.avail_out<=6)this.onData(a.output.subarray(0,a.next_out)),a.avail_out=0;else{if(n=ga.deflate(a,s),n===Na)return a.next_out>0&&this.onData(a.output.subarray(0,a.next_out)),n=ga.deflateEnd(this.strm),this.onEnd(n),this.ended=!0,n===La;if(0!==a.avail_out){if(s>0&&a.next_out>0)this.onData(a.output.subarray(0,a.next_out)),a.avail_out=0;else if(0===a.avail_in)break}else this.onData(a.output)}return!0},o.prototype.onData=function(t){this.chunks.push(t)},o.prototype.onEnd=function(t){t===La&&(this.result=ya.flattenChunks(this.chunks)),this.chunks=[],this.err=t,this.msg=this.strm.msg};var Ha=o,ja=l,Ka=h,Pa=d,Ya=Nt,Ga={Deflate:Ha,deflate:ja,deflateRaw:Ka,gzip:Pa,constants:Ya};const Xa=16209,Wa=16191;var qa=function(t,e){let a,i,n,s,r,o,l,h,d,_,f,u,c,w,b,m,g,p,k,v,y,x,z,A;const E=t.state;a=t.next_in,z=t.input,i=a+(t.avail_in-5),n=t.next_out,A=t.output,s=n-(e-t.avail_out),r=n+(t.avail_out-257),o=E.dmax,l=E.wsize,h=E.whave,d=E.wnext,_=E.window,f=E.hold,u=E.bits,c=E.lencode,w=E.distcode,b=(1<<E.lenbits)-1,m=(1<<E.distbits)-1;t:do{u<15&&(f+=z[a++]<<u,u+=8,f+=z[a++]<<u,u+=8),g=c[f&b];e:for(;;){if(p=g>>>24,f>>>=p,u-=p,p=g>>>16&255,0===p)A[n++]=65535&g;else{if(!(16&p)){if(0==(64&p)){g=c[(65535&g)+(f&(1<<p)-1)];continue e}if(32&p){E.mode=Wa;break t}t.msg="invalid literal/length code",E.mode=Xa;break t}k=65535&g,p&=15,p&&(u<p&&(f+=z[a++]<<u,u+=8),k+=f&(1<<p)-1,f>>>=p,u-=p),u<15&&(f+=z[a++]<<u,u+=8,f+=z[a++]<<u,u+=8),g=w[f&m];a:for(;;){if(p=g>>>24,f>>>=p,u-=p,p=g>>>16&255,!(16&p)){if(0==(64&p)){g=w[(65535&g)+(f&(1<<p)-1)];continue a}t.msg="invalid distance code",E.mode=Xa;break t}if(v=65535&g,p&=15,u<p&&(f+=z[a++]<<u,u+=8,u<p&&(f+=z[a++]<<u,u+=8)),v+=f&(1<<p)-1,v>o){t.msg="invalid distance too far back",E.mode=Xa;break t}if(f>>>=p,u-=p,p=n-s,v>p){if(p=v-p,p>h&&E.sane){t.msg="invalid distance too far back",E.mode=Xa;break t}if(y=0,x=_,0===d){if(y+=l-p,p<k){k-=p;do{A[n++]=_[y++]}while(--p);y=n-v,x=A}}else if(d<p){if(y+=l+d-p,
p-=d,p<k){k-=p;do{A[n++]=_[y++]}while(--p);if(y=0,d<k){p=d,k-=p;do{A[n++]=_[y++]}while(--p);y=n-v,x=A}}}else if(y+=d-p,p<k){k-=p;do{A[n++]=_[y++]}while(--p);y=n-v,x=A}for(;k>2;)A[n++]=x[y++],A[n++]=x[y++],A[n++]=x[y++],k-=3;k&&(A[n++]=x[y++],k>1&&(A[n++]=x[y++]))}else{y=n-v;do{A[n++]=A[y++],A[n++]=A[y++],A[n++]=A[y++],k-=3}while(k>2);k&&(A[n++]=A[y++],k>1&&(A[n++]=A[y++]))}break}}break}}while(a<i&&n<r);k=u>>3,a-=k,u-=k<<3,f&=(1<<u)-1,t.next_in=a,t.next_out=n,t.avail_in=a<i?i-a+5:5-(a-i),t.avail_out=n<r?r-n+257:257-(n-r),E.hold=f,E.bits=u};const Ja=15,Qa=852,Va=592,$a=0,ti=1,ei=2,ai=new Uint16Array([3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0]),ii=new Uint8Array([16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78]),ni=new Uint16Array([1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0]),si=new Uint8Array([16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64]),ri=(t,e,a,i,n,s,r,o)=>{const l=o.bits;let h,d,_,f,u,c,w=0,b=0,m=0,g=0,p=0,k=0,v=0,y=0,x=0,z=0,A=null;const E=new Uint16Array(Ja+1),R=new Uint16Array(Ja+1);let Z,U,S,D=null;for(w=0;w<=Ja;w++)E[w]=0;for(b=0;b<i;b++)E[e[a+b]]++;for(p=l,g=Ja;g>=1&&0===E[g];g--);if(p>g&&(p=g),0===g)return n[s++]=20971520,n[s++]=20971520,o.bits=1,0;for(m=1;m<g&&0===E[m];m++);for(p<m&&(p=m),y=1,w=1;w<=Ja;w++)if(y<<=1,y-=E[w],y<0)return-1;if(y>0&&(t===$a||1!==g))return-1;for(R[1]=0,w=1;w<Ja;w++)R[w+1]=R[w]+E[w];for(b=0;b<i;b++)0!==e[a+b]&&(r[R[e[a+b]]++]=b);if(t===$a?(A=D=r,c=20):t===ti?(A=ai,D=ii,c=257):(A=ni,D=si,c=0),z=0,b=0,w=m,u=s,k=p,v=0,_=-1,x=1<<p,f=x-1,t===ti&&x>Qa||t===ei&&x>Va)return 1;for(;;){Z=w-v,r[b]+1<c?(U=0,S=r[b]):r[b]>=c?(U=D[r[b]-c],S=A[r[b]-c]):(U=96,S=0),h=1<<w-v,d=1<<k,m=d;do{d-=h,n[u+(z>>v)+d]=Z<<24|U<<16|S|0}while(0!==d);for(h=1<<w-1;z&h;)h>>=1;if(0!==h?(z&=h-1,z+=h):z=0,b++,0==--E[w]){if(w===g)break;w=e[a+r[b]]}if(w>p&&(z&f)!==_){for(0===v&&(v=p),u+=m,k=w-v,y=1<<k;k+v<g&&(y-=E[k+v],!(y<=0));)k++,y<<=1;if(x+=1<<k,t===ti&&x>Qa||t===ei&&x>Va)return 1;_=z&f,n[_]=p<<24|k<<16|u-s|0}}return 0!==z&&(n[u+z]=w-v<<24|64<<16|0),o.bits=p,0};var oi=ri;const li=0,hi=1,di=2,{Z_FINISH:_i,Z_BLOCK:fi,Z_TREES:ui,Z_OK:ci,Z_STREAM_END:wi,Z_NEED_DICT:bi,Z_STREAM_ERROR:mi,Z_DATA_ERROR:gi,Z_MEM_ERROR:pi,Z_BUF_ERROR:ki,Z_DEFLATED:vi}=Nt,yi=16180,xi=16181,zi=16182,Ai=16183,Ei=16184,Ri=16185,Zi=16186,Ui=16187,Si=16188,Di=16189,Ti=16190,Oi=16191,Ii=16192,Fi=16193,Li=16194,Ni=16195,Bi=16196,Ci=16197,Mi=16198,Hi=16199,ji=16200,Ki=16201,Pi=16202,Yi=16203,Gi=16204,Xi=16205,Wi=16206,qi=16207,Ji=16208,Qi=16209,Vi=16210,$i=16211,tn=852,en=592,an=15,nn=an,sn=t=>(t>>>24&255)+(t>>>8&65280)+((65280&t)<<8)+((255&t)<<24),rn=t=>{if(!t)return 1;const e=t.state;return!e||e.strm!==t||e.mode<yi||e.mode>$i?1:0},on=t=>{if(rn(t))return mi;const e=t.state;return t.total_in=t.total_out=e.total=0,t.msg="",e.wrap&&(t.adler=1&e.wrap),e.mode=yi,e.last=0,e.havedict=0,e.flags=-1,e.dmax=32768,e.head=null,e.hold=0,e.bits=0,e.lencode=e.lendyn=new Int32Array(tn),e.distcode=e.distdyn=new Int32Array(en),e.sane=1,e.back=-1,ci},ln=t=>{if(rn(t))return mi;const e=t.state;return e.wsize=0,e.whave=0,e.wnext=0,on(t)},hn=(t,e)=>{let a;if(rn(t))return mi;const i=t.state;return e<0?(a=0,e=-e):(a=5+(e>>4),e<48&&(e&=15)),e&&(e<8||e>15)?mi:(null!==i.window&&i.wbits!==e&&(i.window=null),i.wrap=a,i.wbits=e,ln(t))},dn=(t,e)=>{if(!t)return mi;const a=new _;t.state=a,a.strm=t,a.window=null,a.mode=yi;const i=hn(t,e);return i!==ci&&(t.state=null),i},_n=t=>dn(t,nn);let fn,un,cn=!0;const wn=t=>{if(cn){fn=new Int32Array(512),un=new Int32Array(32);let e=0;for(;e<144;)t.lens[e++]=8;for(;e<256;)t.lens[e++]=9;for(;e<280;)t.lens[e++]=7;for(;e<288;)t.lens[e++]=8;for(oi(hi,t.lens,0,288,fn,0,t.work,{bits:9}),e=0;e<32;)t.lens[e++]=5;oi(di,t.lens,0,32,un,0,t.work,{bits:5}),cn=!1}t.lencode=fn,t.lenbits=9,t.distcode=un,t.distbits=5},bn=(t,e,a,i)=>{let n;const s=t.state;return null===s.window&&(s.wsize=1<<s.wbits,s.wnext=0,s.whave=0,s.window=new Uint8Array(s.wsize)),i>=s.wsize?(s.window.set(e.subarray(a-s.wsize,a),0),s.wnext=0,s.whave=s.wsize):(n=s.wsize-s.wnext,n>i&&(n=i),s.window.set(e.subarray(a-i,a-i+n),s.wnext),i-=n,i?(s.window.set(e.subarray(a-i,a),0),s.wnext=i,s.whave=s.wsize):(s.wnext+=n,s.wnext===s.wsize&&(s.wnext=0),s.whave<s.wsize&&(s.whave+=n))),0},mn=(t,e)=>{let a,i,n,s,r,o,l,h,d,_,f,u,c,w,b,m,g,p,k,v,y,x,z=0;const A=new Uint8Array(4);let E,R;const Z=new Uint8Array([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]);if(rn(t)||!t.output||!t.input&&0!==t.avail_in)return mi;a=t.state,a.mode===Oi&&(a.mode=Ii),r=t.next_out,n=t.output,l=t.avail_out,s=t.next_in,i=t.input,o=t.avail_in,h=a.hold,d=a.bits,_=o,f=l,x=ci;t:for(;;)switch(a.mode){case yi:if(0===a.wrap){a.mode=Ii;break}for(;d<16;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}if(2&a.wrap&&35615===h){0===a.wbits&&(a.wbits=15),a.check=0,A[0]=255&h,A[1]=h>>>8&255,a.check=Ft(a.check,A,2,0),h=0,d=0,a.mode=xi;break}if(a.head&&(a.head.done=!1),!(1&a.wrap)||(((255&h)<<8)+(h>>8))%31){t.msg="incorrect header check",a.mode=Qi;break}if((15&h)!==vi){t.msg="unknown compression method",a.mode=Qi;break}if(h>>>=4,d-=4,y=8+(15&h),0===a.wbits&&(a.wbits=y),y>15||y>a.wbits){t.msg="invalid window size",a.mode=Qi;break}a.dmax=1<<a.wbits,a.flags=0,t.adler=a.check=1,a.mode=512&h?Di:Oi,h=0,d=0;break;case xi:for(;d<16;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}if(a.flags=h,(255&a.flags)!==vi){t.msg="unknown compression method",a.mode=Qi;break}if(57344&a.flags){t.msg="unknown header flags set",a.mode=Qi;break}a.head&&(a.head.text=h>>8&1),512&a.flags&&4&a.wrap&&(A[0]=255&h,A[1]=h>>>8&255,a.check=Ft(a.check,A,2,0)),h=0,d=0,a.mode=zi;case zi:for(;d<32;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}a.head&&(a.head.time=h),512&a.flags&&4&a.wrap&&(A[0]=255&h,A[1]=h>>>8&255,A[2]=h>>>16&255,A[3]=h>>>24&255,a.check=Ft(a.check,A,4,0)),h=0,d=0,a.mode=Ai;case Ai:for(;d<16;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}a.head&&(a.head.xflags=255&h,a.head.os=h>>8),512&a.flags&&4&a.wrap&&(A[0]=255&h,A[1]=h>>>8&255,a.check=Ft(a.check,A,2,0)),h=0,d=0,a.mode=Ei;case Ei:if(1024&a.flags){for(;d<16;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}a.length=h,a.head&&(a.head.extra_len=h),512&a.flags&&4&a.wrap&&(A[0]=255&h,A[1]=h>>>8&255,a.check=Ft(a.check,A,2,0)),h=0,d=0}else a.head&&(a.head.extra=null);a.mode=Ri;case Ri:if(1024&a.flags&&(u=a.length,u>o&&(u=o),u&&(a.head&&(y=a.head.extra_len-a.length,a.head.extra||(a.head.extra=new Uint8Array(a.head.extra_len)),a.head.extra.set(i.subarray(s,s+u),y)),512&a.flags&&4&a.wrap&&(a.check=Ft(a.check,i,u,s)),o-=u,s+=u,a.length-=u),a.length))break t;a.length=0,a.mode=Zi;case Zi:if(2048&a.flags){if(0===o)break t;u=0;do{y=i[s+u++],a.head&&y&&a.length<65536&&(a.head.name+=String.fromCharCode(y))}while(y&&u<o);if(512&a.flags&&4&a.wrap&&(a.check=Ft(a.check,i,u,s)),o-=u,s+=u,y)break t}else a.head&&(a.head.name=null);a.length=0,a.mode=Ui;case Ui:if(4096&a.flags){if(0===o)break t;u=0;do{y=i[s+u++],a.head&&y&&a.length<65536&&(a.head.comment+=String.fromCharCode(y))}while(y&&u<o);if(512&a.flags&&4&a.wrap&&(a.check=Ft(a.check,i,u,s)),o-=u,s+=u,y)break t}else a.head&&(a.head.comment=null);a.mode=Si;case Si:if(512&a.flags){for(;d<16;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}if(4&a.wrap&&h!==(65535&a.check)){t.msg="header crc mismatch",a.mode=Qi;break}h=0,d=0}a.head&&(a.head.hcrc=a.flags>>9&1,a.head.done=!0),t.adler=a.check=0,a.mode=Oi;break;case Di:for(;d<32;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}t.adler=a.check=sn(h),h=0,d=0,a.mode=Ti;case Ti:if(0===a.havedict)return t.next_out=r,t.avail_out=l,t.next_in=s,t.avail_in=o,a.hold=h,a.bits=d,bi;t.adler=a.check=1,a.mode=Oi;case Oi:if(e===fi||e===ui)break t;case Ii:if(a.last){h>>>=7&d,d-=7&d,a.mode=Wi;break}for(;d<3;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}switch(a.last=1&h,h>>>=1,d-=1,3&h){case 0:a.mode=Fi;break;case 1:if(wn(a),a.mode=Hi,e===ui){h>>>=2,d-=2;break t}break;case 2:a.mode=Bi;break;case 3:t.msg="invalid block type",a.mode=Qi}h>>>=2,d-=2;break;case Fi:for(h>>>=7&d,d-=7&d;d<32;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}if((65535&h)!=(h>>>16^65535)){t.msg="invalid stored block lengths",a.mode=Qi;break}if(a.length=65535&h,h=0,d=0,a.mode=Li,e===ui)break t;case Li:a.mode=Ni;case Ni:if(u=a.length,u){if(u>o&&(u=o),u>l&&(u=l),0===u)break t;n.set(i.subarray(s,s+u),r),o-=u,s+=u,l-=u,r+=u,a.length-=u;break}a.mode=Oi;break;case Bi:for(;d<14;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}if(a.nlen=257+(31&h),h>>>=5,d-=5,a.ndist=1+(31&h),h>>>=5,d-=5,a.ncode=4+(15&h),h>>>=4,d-=4,a.nlen>286||a.ndist>30){t.msg="too many length or distance symbols",a.mode=Qi;break}a.have=0,a.mode=Ci;case Ci:for(;a.have<a.ncode;){for(;d<3;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}a.lens[Z[a.have++]]=7&h,h>>>=3,d-=3}for(;a.have<19;)a.lens[Z[a.have++]]=0;if(a.lencode=a.lendyn,a.lenbits=7,E={bits:a.lenbits},x=oi(li,a.lens,0,19,a.lencode,0,a.work,E),a.lenbits=E.bits,x){t.msg="invalid code lengths set",a.mode=Qi;break}a.have=0,a.mode=Mi;case Mi:for(;a.have<a.nlen+a.ndist;){for(;z=a.lencode[h&(1<<a.lenbits)-1],b=z>>>24,m=z>>>16&255,g=65535&z,!(b<=d);){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}if(g<16)h>>>=b,d-=b,a.lens[a.have++]=g;else{if(16===g){for(R=b+2;d<R;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}if(h>>>=b,d-=b,0===a.have){t.msg="invalid bit length repeat",a.mode=Qi;break}y=a.lens[a.have-1],u=3+(3&h),h>>>=2,d-=2}else if(17===g){for(R=b+3;d<R;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}h>>>=b,d-=b,y=0,u=3+(7&h),h>>>=3,d-=3}else{for(R=b+7;d<R;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}h>>>=b,d-=b,y=0,u=11+(127&h),h>>>=7,d-=7}if(a.have+u>a.nlen+a.ndist){t.msg="invalid bit length repeat",a.mode=Qi;break}for(;u--;)a.lens[a.have++]=y}}if(a.mode===Qi)break;if(0===a.lens[256]){t.msg="invalid code -- missing end-of-block",a.mode=Qi;break}if(a.lenbits=9,E={bits:a.lenbits},x=oi(hi,a.lens,0,a.nlen,a.lencode,0,a.work,E),a.lenbits=E.bits,x){t.msg="invalid literal/lengths set",a.mode=Qi;break}if(a.distbits=6,a.distcode=a.distdyn,E={bits:a.distbits},x=oi(di,a.lens,a.nlen,a.ndist,a.distcode,0,a.work,E),a.distbits=E.bits,x){t.msg="invalid distances set",a.mode=Qi;break}if(a.mode=Hi,e===ui)break t;case Hi:a.mode=ji;case ji:if(o>=6&&l>=258){t.next_out=r,t.avail_out=l,t.next_in=s,t.avail_in=o,a.hold=h,a.bits=d,qa(t,f),r=t.next_out,n=t.output,l=t.avail_out,s=t.next_in,i=t.input,o=t.avail_in,h=a.hold,d=a.bits,a.mode===Oi&&(a.back=-1);break}for(a.back=0;z=a.lencode[h&(1<<a.lenbits)-1],b=z>>>24,m=z>>>16&255,g=65535&z,!(b<=d);){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}if(m&&0==(240&m)){for(p=b,k=m,v=g;z=a.lencode[v+((h&(1<<p+k)-1)>>p)],b=z>>>24,m=z>>>16&255,g=65535&z,!(p+b<=d);){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}h>>>=p,d-=p,a.back+=p}if(h>>>=b,d-=b,a.back+=b,a.length=g,0===m){a.mode=Xi;break}if(32&m){a.back=-1,a.mode=Oi;break}if(64&m){t.msg="invalid literal/length code",a.mode=Qi;break}a.extra=15&m,a.mode=Ki;case Ki:if(a.extra){for(R=a.extra;d<R;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}a.length+=h&(1<<a.extra)-1,h>>>=a.extra,d-=a.extra,a.back+=a.extra}a.was=a.length,a.mode=Pi;case Pi:for(;z=a.distcode[h&(1<<a.distbits)-1],b=z>>>24,m=z>>>16&255,g=65535&z,!(b<=d);){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}if(0==(240&m)){for(p=b,k=m,v=g;z=a.distcode[v+((h&(1<<p+k)-1)>>p)],b=z>>>24,m=z>>>16&255,g=65535&z,!(p+b<=d);){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}h>>>=p,d-=p,a.back+=p}if(h>>>=b,d-=b,a.back+=b,64&m){t.msg="invalid distance code",a.mode=Qi;break}a.offset=g,a.extra=15&m,a.mode=Yi;case Yi:if(a.extra){for(R=a.extra;d<R;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}a.offset+=h&(1<<a.extra)-1,h>>>=a.extra,d-=a.extra,a.back+=a.extra}if(a.offset>a.dmax){t.msg="invalid distance too far back",a.mode=Qi;break}a.mode=Gi;case Gi:if(0===l)break t;if(u=f-l,a.offset>u){if(u=a.offset-u,u>a.whave&&a.sane){t.msg="invalid distance too far back",a.mode=Qi;break}u>a.wnext?(u-=a.wnext,c=a.wsize-u):c=a.wnext-u,u>a.length&&(u=a.length),w=a.window}else w=n,c=r-a.offset,u=a.length;u>l&&(u=l),l-=u,a.length-=u;do{n[r++]=w[c++]}while(--u);0===a.length&&(a.mode=ji);break;case Xi:if(0===l)break t;n[r++]=a.length,l--,a.mode=ji;break;case Wi:if(a.wrap){for(;d<32;){if(0===o)break t;o--,h|=i[s++]<<d,d+=8}if(f-=l,t.total_out+=f,a.total+=f,4&a.wrap&&f&&(t.adler=a.check=a.flags?Ft(a.check,n,f,r-f):Dt(a.check,n,f,r-f)),f=l,4&a.wrap&&(a.flags?h:sn(h))!==a.check){t.msg="incorrect data check",a.mode=Qi;break}h=0,d=0}a.mode=qi;case qi:if(a.wrap&&a.flags){for(;d<32;){if(0===o)break t;o--,h+=i[s++]<<d,d+=8}if(4&a.wrap&&h!==(4294967295&a.total)){t.msg="incorrect length check",a.mode=Qi;break}h=0,d=0}a.mode=Ji;case Ji:x=wi;break t;case Qi:x=gi;break t;case Vi:return pi;case $i:default:return mi}return t.next_out=r,t.avail_out=l,t.next_in=s,t.avail_in=o,a.hold=h,a.bits=d,(a.wsize||f!==t.avail_out&&a.mode<Qi&&(a.mode<Wi||e!==_i))&&bn(t,t.output,t.next_out,f-t.avail_out),_-=t.avail_in,f-=t.avail_out,t.total_in+=_,t.total_out+=f,a.total+=f,4&a.wrap&&f&&(t.adler=a.check=a.flags?Ft(a.check,n,f,t.next_out-f):Dt(a.check,n,f,t.next_out-f)),t.data_type=a.bits+(a.last?64:0)+(a.mode===Oi?128:0)+(a.mode===Hi||a.mode===Li?256:0),(0===_&&0===f||e===_i)&&x===ci&&(x=ki),x},gn=t=>{if(rn(t))return mi;let e=t.state;return e.window&&(e.window=null),t.state=null,ci},pn=(t,e)=>{if(rn(t))return mi;const a=t.state;return 0==(2&a.wrap)?mi:(a.head=e,e.done=!1,ci)},kn=(t,e)=>{const a=e.length;let i,n,s;return rn(t)?mi:(i=t.state,0!==i.wrap&&i.mode!==Ti?mi:i.mode===Ti&&(n=1,n=Dt(n,e,a,0),n!==i.check)?gi:(s=bn(t,e,a,a),s?(i.mode=Vi,pi):(i.havedict=1,ci)))};var vn=ln,yn=hn,xn=on,zn=_n,An=dn,En=mn,Rn=gn,Zn=pn,Un=kn,Sn="pako inflate (from Nodeca project)",Dn={inflateReset:vn,inflateReset2:yn,inflateResetKeep:xn,inflateInit:zn,inflateInit2:An,inflate:En,inflateEnd:Rn,inflateGetHeader:Zn,inflateSetDictionary:Un,inflateInfo:Sn},Tn=f;const On=Object.prototype.toString,{Z_NO_FLUSH:In,Z_FINISH:Fn,Z_OK:Ln,Z_STREAM_END:Nn,Z_NEED_DICT:Bn,Z_STREAM_ERROR:Cn,Z_DATA_ERROR:Mn,Z_MEM_ERROR:Hn}=Nt;u.prototype.push=function(t,e){const a=this.strm,i=this.options.chunkSize,n=this.options.dictionary;let s,r,o;if(this.ended)return!1;for(r=e===~~e?e:!0===e?Fn:In,"[object ArrayBuffer]"===On.call(t)?a.input=new Uint8Array(t):a.input=t,a.next_in=0,a.avail_in=a.input.length;;){for(0===a.avail_out&&(a.output=new Uint8Array(i),a.next_out=0,a.avail_out=i),s=Dn.inflate(a,r),s===Bn&&n&&(s=Dn.inflateSetDictionary(a,n),s===Ln?s=Dn.inflate(a,r):s===Mn&&(s=Bn));a.avail_in>0&&s===Nn&&a.state.wrap>0&&0!==t[a.next_in];)Dn.inflateReset(a),s=Dn.inflate(a,r);switch(s){case Cn:case Mn:case Bn:case Hn:return this.onEnd(s),this.ended=!0,!1}if(o=a.avail_out,a.next_out&&(0===a.avail_out||s===Nn))if("string"===this.options.to){let t=Ua.utf8border(a.output,a.next_out),e=a.next_out-t,n=Ua.buf2string(a.output,t);a.next_out=e,a.avail_out=i-e,e&&a.output.set(a.output.subarray(t,t+e),0),this.onData(n)}else this.onData(a.output.length===a.next_out?a.output:a.output.subarray(0,a.next_out));if(s!==Ln||0!==o){if(s===Nn)return s=Dn.inflateEnd(this.strm),this.onEnd(s),this.ended=!0,!0;if(0===a.avail_in)break}}return!0},u.prototype.onData=function(t){this.chunks.push(t)},u.prototype.onEnd=function(t){t===Ln&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=ya.flattenChunks(this.chunks)),this.chunks=[],this.err=t,this.msg=this.strm.msg};var jn=u,Kn=c,Pn=w,Yn=c,Gn=Nt,Xn={Inflate:jn,inflate:Kn,inflateRaw:Pn,ungzip:Yn,constants:Gn};const{Deflate:Wn,deflate:qn,deflateRaw:Jn,gzip:Qn}=Ga,{Inflate:Vn,inflate:$n,inflateRaw:ts,ungzip:es}=Xn;var as=Wn,is=qn,ns=Jn,ss=Qn,rs=Vn,os=$n,ls=ts,hs=es,ds=Nt,_s={Deflate:as,deflate:is,deflateRaw:ns,gzip:ss,Inflate:rs,inflate:os,inflateRaw:ls,ungzip:hs,constants:ds};t.Deflate=as,t.Inflate=rs,t.constants=ds,t.default=_s,t.deflate=is,t.deflateRaw=ns,t.gzip=ss,t.inflate=os,t.inflateRaw=ls,t.ungzip=hs,Object.defineProperty(t,"__esModule",{value:!0})}(t),t}
