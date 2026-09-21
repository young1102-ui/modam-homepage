'use strict';
const admin = require('firebase-admin');
const crypto = require('node:crypto');
let app;
function firebase() {
  if (!app) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
    const credentials = JSON.parse(raw);
    app = admin.apps[0] || admin.initializeApp({credential: admin.credential.cert(credentials)});
  }
  return {auth:admin.auth(app),db:admin.firestore(app)};
}
function response(res, status, data) {res.status(status).setHeader('Cache-Control','no-store').json(data);}
function hashPassword(password, salt) {return crypto.scryptSync(password,salt,64).toString('hex');}
const limits = new Map();
function rateLimit(req, action) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const key = action+':'+crypto.createHash('sha256').update(ip).digest('hex');
  const now=Date.now(), record=limits.get(key);
  if(!record || now-record.start>60000){limits.set(key,{start:now,count:1});return false;}
  record.count++;return record.count>(action==='enter'?20:60);
}
async function requireAdmin(req) {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization||'')?.[1];
  if(!token) return false;
  const user = await firebase().auth.verifyIdToken(token,true);
  // The Google account is chosen privately in Vercel. A UID can be pinned later.
  const email=(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const uid=(process.env.ADMIN_UID || '').trim();
  return !!email && !!user.email_verified && user.email?.toLowerCase() === email
    && user.firebase?.sign_in_provider === 'google.com' && (!uid || user.uid === uid);
}
function validateRoom(body) {
  const name = typeof body?.name==='string'?body.name.trim():'';
  const targetUrl = typeof body?.targetUrl==='string'?body.targetUrl.trim():'';
  const password = typeof body?.password==='string'?body.password:'';
  let url;
  try {url=new URL(targetUrl);}catch{return {error:'이동할 주소를 확인해 주세요.'};}
  if(url.protocol!=='https:' || url.username || url.password || !url.hostname || targetUrl.length>2000) return {error:'https://로 시작하는 정상적인 자료실 주소를 입력해 주세요.'};
  if(name.length<1||name.length>100)return {error:'수업명은 1~100자로 입력해 주세요.'};
  if(password && (password.length<8||password.length>128))return {error:'수업 비밀번호는 8~128자로 입력해 주세요.'};
  return {name,targetUrl,password,active:body.active===true};
}
module.exports = async (req,res)=>{
  const action=String(req.query.action||'');
  try {
    if (action==='config' && req.method==='GET') {
      const raw=process.env.FIREBASE_WEB_CONFIG;
      if(!raw)return response(res,503,{error:'웹앱 설정이 완료되지 않았습니다.'});
      const c=JSON.parse(raw);
      return response(res,200,{apiKey:c.apiKey,authDomain:c.authDomain,projectId:c.projectId,appId:c.appId});
    }
    if (action==='enter' && req.method==='POST') {
      if(rateLimit(req,'enter'))return response(res,429,{error:'요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'});
      const pw=typeof req.body?.password==='string'?req.body.password:'';
      if(!pw || pw.length>128)return response(res,400,{error:'비밀번호를 확인해 주세요.'});
      const {db}=firebase();
      const docs=await db.collection('class_rooms').where('active','==',true).limit(100).get();
      let target;
      // Compare all active rows; no password or URL list is sent to the browser.
      for(const doc of docs.docs){const d=doc.data();if(!d.passwordSalt||!d.passwordHash)continue;
        const actual=Buffer.from(hashPassword(pw,d.passwordSalt),'hex');const expected=Buffer.from(d.passwordHash,'hex');
        if(actual.length===expected.length && crypto.timingSafeEqual(actual,expected))target=d.targetUrl;
      }
      if(!target)return response(res,401,{error:'비밀번호가 올바르지 않거나 종료된 수업입니다.'});
      return response(res,200,{targetUrl:target});
    }
    if(!['rooms','save','remove'].includes(action))return response(res,404,{error:'요청한 기능이 없습니다.'});
    if(rateLimit(req,'admin'))return response(res,429,{error:'요청이 너무 많습니다.'});
    if(!await requireAdmin(req))return response(res,403,{error:'관리자 권한이 없습니다.'});
    const {db}=firebase();const collection=db.collection('class_rooms');
    if(action==='rooms'&&req.method==='GET'){
      const snap=await collection.orderBy('createdAt','desc').limit(200).get();
      return response(res,200,{rooms:snap.docs.map(d=>({id:d.id,name:d.data().name,targetUrl:d.data().targetUrl,active:d.data().active===true,createdAt:d.data().createdAt?.toDate?.()?.toISOString()||null}))});
    }
    if(action==='save'&&req.method==='POST'){
      const v=validateRoom(req.body);if(v.error)return response(res,400,{error:v.error});
      const id=typeof req.body.id==='string'?req.body.id:'';let ref, old=null;
      if(id){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return response(res,400,{error:'수업 번호가 잘못되었습니다.'});
        ref=collection.doc(id);const snap=await ref.get();if(!snap.exists)return response(res,404,{error:'수업을 찾지 못했습니다.'});old=snap.data();
      } else ref=collection.doc();
      if(!id&&!v.password)return response(res,400,{error:'새 수업 비밀번호를 입력해 주세요.'});
      if(id && old && !old.active && v.active && !v.password)return response(res,400,{error:'종료된 수업을 다시 활성화할 때는 새 비밀번호를 입력해 주세요.'});
      if(v.password){
        const existing=await collection.where('active','==',true).limit(100).get();
        for(const doc of existing.docs){if(doc.id===id)continue;const d=doc.data();if(!d.passwordSalt||!d.passwordHash)continue;
          const actual=Buffer.from(hashPassword(v.password,d.passwordSalt),'hex');const expected=Buffer.from(d.passwordHash,'hex');
          if(actual.length===expected.length&&crypto.timingSafeEqual(actual,expected))return response(res,409,{error:'이미 다른 수업에서 사용하는 비밀번호입니다.'});
        }
      }
      const data={name:v.name,targetUrl:v.targetUrl,active:v.active,updatedAt:admin.firestore.FieldValue.serverTimestamp()};
      if(v.password){const salt=crypto.randomBytes(24).toString('hex');data.passwordSalt=salt;data.passwordHash=hashPassword(v.password,salt);}
      if(!id)data.createdAt=admin.firestore.FieldValue.serverTimestamp();
      await ref.set(data,{merge:true});return response(res,200,{ok:true,id:ref.id});
    }
    if(action==='remove'&&req.method==='POST'){
      const id=typeof req.body?.id==='string'?req.body.id:'';
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return response(res,400,{error:'수업 번호가 잘못되었습니다.'});
      await collection.doc(id).delete();return response(res,200,{ok:true});
    }
    return response(res,405,{error:'허용되지 않은 요청입니다.'});
  }catch(err){console.error('API error',err.code||err.message);return response(res,500,{error:'처리 중 오류가 발생했습니다. 설정 또는 네트워크 상태를 확인해 주세요.'});}
};
