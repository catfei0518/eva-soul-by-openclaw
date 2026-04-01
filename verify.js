const p=require('./package.json');
const pl=require('./openclaw.plugin.json');
const m=require('./_meta.json');
const logger=require('./hooks/logger');
const i18n=require('./i18n');
const state=require('./lib/core/state');
const emotion=require('./lib/emotion/emotion');
const mem=require('./lib/memory/memory');
const {evaluateImportance}=require('./lib/decision/decision');

let ok=0,fail=0;
function check(name,cond){
  if(cond){console.log('PASS: '+name);ok++;}
  else{console.log('FAIL: '+name);fail++;}
}

console.log('--- Versions ---');
check('package.json version=2.5.0',p.version==='2.5.0');
check('openclaw.plugin.json version=2.5.0',pl.version==='2.5.0');
check('_meta.json version=2.5.0',m.version==='2.5.0');

console.log('--- Logger ---');
check('logger.setLocale exists',typeof logger.setLocale==='function');
check('logger.t exists',typeof logger.t==='function');
check('logger.getLocale exists',typeof logger.getLocale==='function');
check('logger.hookWarn exists',typeof logger.hookWarn==='function');
check('logger.getLocale()=zh',logger.getLocale()==='zh');

console.log('--- i18n ---');
check('i18n.SUPPORTED=4',i18n.SUPPORTED.length===4);
check('detectLocale default=zh',i18n.detectLocale({},{})==='zh');
logger.setLocale('en');
const enTitle=logger.t('cli.status.title');
check('en title not empty',enTitle.length>0);
logger.setLocale('zh');

const zh=require('./i18n/zh');
const en=require('./i18n/en');
const ja=require('./i18n/ja');
const tw=require('./i18n/zh-TW');
function flatKeys(o,prefix){
  prefix=prefix||'';
  let keys=[];
  Object.keys(o).forEach(function(key){
    const full=prefix?prefix+'.'+key:key;
    if(typeof o[key]==='object'&&o[key]!==null&&!Array.isArray(o[key])){
      keys=keys.concat(flatKeys(o[key],full));
    }else{
      keys.push(full);
    }
  });
  return keys;
}
const zhDup=flatKeys(zh).filter(function(v,i,a){return a.indexOf(v)!==i;});
const enDup=flatKeys(en).filter(function(v,i,a){return a.indexOf(v)!==i;});
const jaDup=flatKeys(ja).filter(function(v,i,a){return a.indexOf(v)!==i;});
const twDup=flatKeys(tw).filter(function(v,i,a){return a.indexOf(v)!==i;});
check('zh no dups',zhDup.length===0);
check('en no dups',enDup.length===0);
check('ja no dups',jaDup.length===0);
check('tw no dups',twDup.length===0);

console.log('--- State ---');
const s=state.createState();
check('emotion=neutral',s.currentEmotion==='neutral');
check('personality=gentle',s.personality==='gentle');
check('isSleeping=false',s.isSleeping===false);
check('has initializedAt','initializedAt' in s);

console.log('--- Emotion ---');
check('getIntensity(9)=very_high',emotion.getIntensityLevel(9)==='very_high');
check('getIntensity(0.3)=low',emotion.getIntensityLevel(0.3)==='low');
check('EMOTIONS.happy exists','happy' in emotion.EMOTIONS);
check('EMOTIONS has 9+ types',emotion.getAllEmotions().length>=9);

console.log('--- Memory ---');
check('MEMORY_TIERS=4',Object.keys(mem.MEMORY_TIERS).length===4);
check('has short/archive',!!(mem.MEMORY_TIERS.short&&mem.MEMORY_TIERS.archive));
check('MEMORY_TYPES>0',Object.keys(mem.MEMORY_TYPES).length>0);

console.log('--- Plugin Tools ---');
check('plugin.tools>0',pl.tools&&pl.tools.length>0);

console.log('--- Importance (async) ---');
evaluateImportance('important meeting',{}).then(function(imp){
  if(imp&&imp.importance>=0){
    console.log('PASS: importance>=0 ('+imp.importance+')');ok++;
  }else{
    console.log('FAIL: importance>=0, got: '+(imp?imp.importance:'null'));fail++;
  }
  if(imp&&imp.level){
    console.log('PASS: level='+imp.level);ok++;
  }else{
    console.log('FAIL: level invalid, got: '+(imp?imp.level:'null'));fail++;
  }
  console.log('RESULT: '+ok+' passed, '+fail+' failed');
  process.exit(fail>0?1:0);
}).catch(function(e){
  console.log('FAIL: evaluateImportance threw: '+e.message);fail++;
  console.log('RESULT: '+ok+' passed, '+fail+' failed');
  process.exit(1);
});
