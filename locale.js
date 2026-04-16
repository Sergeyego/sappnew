let insNumber = function (val, dec){
    if (dec!=0){
        return val!=null ? new Intl.NumberFormat("ru-RU", {style: "decimal", minimumFractionDigits : dec, maximumFractionDigits : dec}).format(val) : "";
    } else {
        return val!=null ? new Intl.NumberFormat("ru-RU", {style: "decimal", minimumFractionDigits : dec }).format(val) : "";
    }
}

let insDate = function (dat){
    let dateoptions = {
        year: "numeric",
        month: "numeric",
        day: "numeric",
    };
    return new Intl.DateTimeFormat("ru-RU",dateoptions).format(dat);
}

let insDateLong = function (dat){
    let dateoptions = {
        year: "numeric",
        month: "long",
        day: "numeric",
    };
    return new Intl.DateTimeFormat("ru-RU",dateoptions).format(dat);
}

let insDateTime = function (dtm) {
    let dateoptions = {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
    };
    return new Intl.DateTimeFormat("ru-RU",dateoptions).format(dtm);
}

let insTime = function (tm) {
    let dateoptions = {
        hour: "numeric",
        minute: "numeric",
    };
    return new Intl.DateTimeFormat("ru-RU",dateoptions).format(tm);
}

let insUpperFirst = function (str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

let isEmptyStr = function(str){
    return str==='' || str===undefined || str===null || str.trim().length===0;
}

let insText = function (str) {
    return isEmptyStr(str) ? '' : str;
}

let insTrans = function (str, cfg){
    let out="";
    var map = new Map();

    map.set("а","a");
    map.set("б","b");
    map.set("в","v");
    map.set("г","g");
    map.set("д","d");
    map.set("е","e");
    map.set("ё","e");
    map.set("ж","zj");
    map.set("з","z");
    map.set("и","i");
    map.set("й","i");
    map.set("к","k");
    map.set("л","l");
    map.set("м","m");
    map.set("н","n");
    map.set("о","o");
    map.set("п","p");
    map.set("р","r");
    map.set("с","s");
    map.set("т","t");
    map.set("у","u");
    map.set("ф","f");
    map.set("х","kh");
    map.set("ц","ts");
    map.set("ч","ch");
    map.set("ш","sh");
    map.set("щ","shch");
    map.set("ъ","ie");
    map.set("ы","y");
    map.set("ь","");
    map.set("э","e");
    map.set("ю","iu");
    map.set("я","ia");

    var tmap = new Map(map);

    for (const key of map.keys()) {
        tmap.set(insUpperFirst(key),insUpperFirst(map.get(key)));
    }

    var cmap = new Map(tmap);
    cmap.set("Б","Nb");
    cmap.set("В","W");
    cmap.set("Г","Mn");
    cmap.set("Д","Cu");
    cmap.set("М","Mo");
    cmap.set("Н","Ni");
    cmap.set("С","Si");
    cmap.set("Т","Ti");
    cmap.set("Ф","V");
    cmap.set("Х","Cr");
    cmap.set("Ц","Zr");
    cmap.set("Ю","Al");

    for (let i=0; i<str.length; i++){
        let c=str[i];
        if (tmap.has(c)){
            if (cfg==='chem' && i>1){
                out+=cmap.get(c);
            } else {
                out+=tmap.get(c);
            }
        } else {
            out+=c;
        }
    }
    
    return out;
}

module.exports.insNumber = insNumber;
module.exports.insDate = insDate;
module.exports.insDateLong = insDateLong;
module.exports.insDateTime = insDateTime;
module.exports.insUpperFirst = insUpperFirst;
module.exports.insTrans = insTrans;
module.exports.isEmptyStr = isEmptyStr;
module.exports.insText = insText;
module.exports.insTime = insTime;