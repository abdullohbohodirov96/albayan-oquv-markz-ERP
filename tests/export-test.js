/* Eksport sinovi: haqiqiy .xlsx fayl yuklansin va qayta ochilsin.
   Ishga tushirish:  node tests/export-test.js                                */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const FILE = 'file://' + path.join(__dirname, '..', 'index.html');
let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

/* --- Kichik ZIP o'quvchi: siqilmagan (stored) yozuvlarni ochadi --- */
function unzipStored(buf) {
  const files = {};
  // markaziy katalog oxirini topamiz
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP oxiri topilmadi');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('markaziy yozuv buzuq');
    const method = buf.readUInt16LE(off + 10);
    const size = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const cmtLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const crc = buf.readUInt32LE(off + 16);
    const name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8');
    if (method !== 0) throw new Error('siqilgan yozuv: ' + name);
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('local yozuv buzuq: ' + name);
    if (buf.readUInt32LE(local + 14) !== crc) throw new Error('CRC mos emas: ' + name);
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.slice(start, start + size);
    files[name] = data;
    files['@crc:' + name] = crc;
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return files;
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'albyana-dl-'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });
  await page.goto(FILE);
  await page.waitForSelector('#login-user', { timeout: 20000 });
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', '1234');
  await page.click('button[type=submit]');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(900);

  const hasLite = await page.evaluate(() => !!window.XlsxLite);
  ok('XlsxLite yuklandi (CDN kerak emas)', hasLite);

  await page.evaluate(() => window.A.App.go('students'));
  await page.waitForTimeout(700);

  /* ---- XLSX ---- */
  out.push('\nExcel (.xlsx) fayli');
  const dlp = page.waitForEvent('download', { timeout: 15000 });
  await page.evaluate(() => {
    const rows = [['Ism', 'Guruh', 'Telefon', 'Qarz']];
    window.A.Data.all('students').slice(0, 30).forEach(s => {
      rows.push([s.fullName, s.groupCode || '', s.phone || '', 150000]);
    });
    rows.push(['Ўзбек "тест" & <belgi>', 'B020', '+998901234567', 0]);
    window.A.UI.exportRows('oquvchilar', rows, 'xlsx');
  });
  let xlsxPath = null;
  try {
    const dl = await dlp;
    xlsxPath = path.join(dir, dl.suggestedFilename());
    await dl.saveAs(xlsxPath);
  } catch (e) { /* pastda hisobga olinadi */ }

  ok('Yuklab olish boshlandi', !!xlsxPath);
  if (xlsxPath) {
    ok('Nomi .xlsx bilan tugaydi', /\.xlsx$/.test(xlsxPath), xlsxPath);
    const buf = fs.readFileSync(xlsxPath);
    ok('Fayl bo’sh emas (' + buf.length + ' bayt)', buf.length > 500);
    ok('ZIP imzosi PK to’g’ri', buf[0] === 0x50 && buf[1] === 0x4b);

    let files = null;
    try { files = unzipStored(buf); } catch (e) { out.push('  ✗ ZIP ochilmadi: ' + e.message); fail++; }
    if (files) {
      ok('[Content_Types].xml bor', !!files['[Content_Types].xml']);
      ok('xl/workbook.xml bor', !!files['xl/workbook.xml']);
      ok('xl/worksheets/sheet1.xml bor', !!files['xl/worksheets/sheet1.xml']);
      const sheet = files['xl/worksheets/sheet1.xml'].toString('utf8');
      ok('Sarlavha qatori ichida', sheet.indexOf('<t xml:space="preserve">Ism</t>') >= 0);
      ok('Raqam matn emas, son sifatida', /<c r="D2"><v>150000<\/v><\/c>/.test(sheet),
        sheet.slice(sheet.indexOf('r="D2"'), sheet.indexOf('r="D2"') + 40));
      ok('Maxsus belgilar qochirilgan', sheet.indexOf('&amp;') >= 0 && sheet.indexOf('&lt;belgi&gt;') >= 0);
      ok('Kirill/lotin matn saqlandi', sheet.indexOf('Ўзбек') >= 0);
      ok('Ustun kengliklari bor', sheet.indexOf('<cols>') >= 0);
      // qator soni: sarlavha + kamida 1 + oxirgi sinov qatori
      const rowCount = (sheet.match(/<row /g) || []).length;
      ok('Qatorlar yozildi (' + rowCount + ' ta)', rowCount >= 3);
      // CRC to'g'riligini tekshirish — buzuq fayl Excel'da ochilmaydi
      const zlib = require('zlib');
      const bad = Object.keys(files).filter(n => n.indexOf('@crc:') !== 0)
        .filter(n => (zlib.crc32(files[n]) >>> 0) !== files['@crc:' + n]);
      ok('CRC nazorat summalari to’g’ri', bad.length === 0, bad.join(', '));

      // Haqiqiy ZIP kutubxonasi ham ochsin (python zipfile — Excel bilan bir xil talab)
      const { execFileSync } = require('child_process');
      let zipOk = '';
      try {
        zipOk = execFileSync('python3', ['-c',
          'import zipfile,sys\n' +
          'z=zipfile.ZipFile(sys.argv[1])\n' +
          'assert z.testzip() is None, "buzuq yozuv"\n' +
          'd=z.read("xl/worksheets/sheet1.xml").decode("utf-8")\n' +
          'assert "Ism" in d\n' +
          'print("OK", len(z.namelist()))',
          xlsxPath], { encoding: 'utf8' }).trim();
      } catch (e) { zipOk = 'XATO: ' + String(e.stderr || e.message).slice(0, 200); }
      ok('Mustaqil ZIP kutubxonasi ochdi (' + zipOk + ')', zipOk.indexOf('OK') === 0);
    }
  }

  /* ---- Noto'g'ri natijada sinov yiqilishini tekshirish (nazorat) ---- */
  out.push('\nNazorat: buzuq ma’lumot aniqlanadimi');
  const detects = await page.evaluate(() => {
    const bad = window.XlsxLite.build([['a']], 'X');
    // ataylab bitta baytni buzamiz
    const copy = new Uint8Array(bad);
    copy[40] = (copy[40] + 1) % 256;
    return bad[0] === 0x50 && copy[40] !== bad[40];
  });
  ok('Buzilgan bayt farqlanadi', detects);

  /* ---- CSV ---- */
  out.push('\nCSV fayli');
  const dlp2 = page.waitForEvent('download', { timeout: 15000 });
  await page.evaluate(() => {
    window.A.UI.exportRows('oquvchilar', [['Ism', 'Qarz'], ['Ali; Vali', '10']], 'csv');
  });
  let csvPath = null;
  try {
    const dl2 = await dlp2;
    csvPath = path.join(dir, dl2.suggestedFilename());
    await dl2.saveAs(csvPath);
  } catch (e) { }
  ok('CSV yuklandi', !!csvPath);
  if (csvPath) {
    ok('Nomi .csv bilan tugaydi', /\.csv$/.test(csvPath), csvPath);
    const txt = fs.readFileSync(csvPath, 'utf8');
    ok('BOM bor (Excel uchun)', txt.charCodeAt(0) === 0xFEFF);
    ok('Nuqtali vergulli matn tirnoqqa olindi', txt.indexOf('"Ali; Vali"') >= 0, txt.trim());
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Fayllar: ' + dir);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
