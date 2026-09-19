/* Albyana ERP — kichik XLSX yozuvchi.
   Hech qanday tashqi kutubxonaga bog'liq emas: .xlsx fayli ZIP ichidagi
   bir nechta XML fayldan iborat, ZIP "saqlangan" (siqilmagan) usulda yoziladi.
   Excel, Google Sheets va LibreOffice bunday faylni muammosiz ochadi. */
(function (global) {
  'use strict';

  /* ---------- CRC32 ---------- */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(str) { return new TextEncoder().encode(str); }

  /* ---------- ZIP (saqlangan usul) ---------- */
  function zip(files) {
    var parts = [], central = [], offset = 0;
    var now = new Date();
    var dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() / 2)) & 0xFFFF;
    var dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

    files.forEach(function (f) {
      var nameBytes = utf8(f.name);
      var data = f.data;
      var crc = crc32(data);

      var local = new Uint8Array(30 + nameBytes.length);
      var dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);          // versiya
      dv.setUint16(6, 0x0800, true);      // UTF-8 nomlar
      dv.setUint16(8, 0, true);           // siqilmagan
      dv.setUint16(10, dosTime, true);
      dv.setUint16(12, dosDate, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      parts.push(local, data);

      var cen = new Uint8Array(46 + nameBytes.length);
      var cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint32(42, offset, true);
      cen.set(nameBytes, 46);
      central.push(cen);

      offset += local.length + data.length;
    });

    var centralSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    var end = new Uint8Array(22);
    var ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    var total = offset + centralSize + 22;
    var out = new Uint8Array(total);
    var pos = 0;
    parts.forEach(function (p) { out.set(p, pos); pos += p.length; });
    central.forEach(function (c) { out.set(c, pos); pos += c.length; });
    out.set(end, pos);
    return out;
  }

  /* ---------- XML yordamchilari ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      // XML ruxsat bermaydigan boshqaruv belgilarini olib tashlaymiz
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }
  function colName(n) {
    var s = '';
    n++;
    while (n > 0) {
      var r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  function isNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /**
   * rows: [[a, b, c], ...] — birinchi qator sarlavha.
   * Natija: Uint8Array (.xlsx fayl mazmuni)
   */
  function build(rows, sheetName) {
    var name = String(sheetName || 'AlBayan').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'AlBayan';
    var widths = [];
    rows.forEach(function (r) {
      (r || []).forEach(function (c, i) {
        var len = String(c == null ? '' : c).length;
        widths[i] = Math.min(46, Math.max(widths[i] || 10, len + 2));
      });
    });

    var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    if (widths.length) {
      xml += '<cols>';
      widths.forEach(function (w, i) {
        xml += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
      });
      xml += '</cols>';
    }
    xml += '<sheetData>';
    rows.forEach(function (row, ri) {
      xml += '<row r="' + (ri + 1) + '">';
      (row || []).forEach(function (cell, ci) {
        var ref = colName(ci) + (ri + 1);
        if (cell == null || cell === '') return;
        if (isNumber(cell)) {
          xml += '<c r="' + ref + '"><v>' + cell + '</v></c>';
        } else {
          xml += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' +
            esc(cell) + '</t></is></c>';
        }
      });
      xml += '</row>';
    });
    xml += '</sheetData></worksheet>';

    var files = [
      {
        name: '[Content_Types].xml', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '</Types>')
      },
      {
        name: '_rels/.rels', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>')
      },
      {
        name: 'xl/workbook.xml', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<sheets><sheet name="' + esc(name) + '" sheetId="1" r:id="rId1"/></sheets></workbook>')
      },
      {
        name: 'xl/_rels/workbook.xml.rels', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '</Relationships>')
      },
      { name: 'xl/worksheets/sheet1.xml', data: utf8(xml) }
    ];
    return zip(files);
  }

  global.XlsxLite = { build: build, zip: zip, crc32: crc32, colName: colName };
})(typeof window !== 'undefined' ? window : globalThis);
