// ===================================================================
// AGS CONFIG — Pusat konfigurasi (jangan campur sama logic gold.html)
// ===================================================================

const AGS_CONFIG = {
  // ID spreadsheet (ambil dari URL: .../d/<ID>/edit)
  SPREADSHEET_ID: "1_6SdqHmcglIr2qA6LQnkQgBls66wRjkkLiN2xSEoync",

  // Nama TAB (sheet) di dalam spreadsheet — SESUAIKAN kalau nama tab lo beda
  SHEETS: {
    JOURNAL: "Journal",
    TRADING_PLAN: "Trading Plan",
    SETTINGS: "Settings",
    WATCHLIST: "Watchlist",
  },
};

// ===================================================================
// Cara kerja: pakai endpoint gviz/tq Google Sheets (read-only, CSV).
// SYARAT: Sheet harus di-share "Anyone with the link" -> Viewer.
// (Bukan publish-to-web, cukup share biasa)
// ===================================================================
function agsSheetCsvUrl(sheetName){
  const id = AGS_CONFIG.SPREADSHEET_ID;
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

// Parser CSV sederhana (handle koma di dalam tanda kutip)
function agsParseCSV(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if(c === '"') inQuotes = true;
      else if(c === ','){ row.push(field); field=''; }
      else if(c === '\n' || c === '\r'){
        if(c === '\r' && text[i+1] === '\n') i++;
        row.push(field); field='';
        if(row.length>1 || row[0]!=='') rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if(field!=='' || row.length){ row.push(field); rows.push(row); }
  return rows;
}

// Fetch + parse jadi array of object, key = header row
async function agsFetchSheet(sheetName){
  const url = agsSheetCsvUrl(sheetName);
  const res = await fetch(url);
  if(!res.ok) throw new Error('Gagal fetch sheet "'+sheetName+'" (status '+res.status+'). Pastikan sheet sudah di-share "Anyone with the link".');
  const text = await res.text();
  const rows = agsParseCSV(text);
  if(!rows.length) return [];
  const headers = rows[0].map(h=>h.trim());
  return rows.slice(1).map(r=>{
    const obj = {};
    headers.forEach((h,i)=> obj[h] = (r[i]??'').trim());
    return obj;
  });
}
