/* 

*/

let obj = JSON.parse($response.body);
let { vendors } = obj.cartInfo;

for (let index = 0; index < vendors.length; index++) {
  const { sorted } = vendors[index];

  for (let n = 0; n < sorted.length; n++) {
    const item = sorted[n];
    console.log(item);

    if ([0, 1].includes(n)) {
      item.checkedNum = 1;
      item.item.isNoCheck = 0;
      item.item.CheckType = 1;
      item.item.stockCode = 0;
    }
  }
}

$done({ body: JSON.stringify(obj) });
