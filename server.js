require("dotenv").config();

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, "public"), { recursive: true });

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, "public")));

function readJson(file, def){
  try{
    if(!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(def,null,2));
    return JSON.parse(fs.readFileSync(file,"utf8") || JSON.stringify(def));
  }catch(e){ return def; }
}
function writeJson(file, data){ fs.writeFileSync(file, JSON.stringify(data,null,2)); }
function readPosts(){ return readJson(POSTS_FILE, []); }
function writePosts(data){ writeJson(POSTS_FILE, data); }
function readAdmins(){ return readJson(ADMINS_FILE, [{name:"Owner",key1:"xyron",key2:"store123",role:"owner",avatar:"/uploads/admin.png",verified:true}]); }
function writeAdmins(data){ writeJson(ADMINS_FILE, data); }
function findAdmin(key1,key2,role){ return readAdmins().find(a=>a.key1===key1 && a.key2===key2 && (!role || a.role===role)); }

const upload = multer({ storage: multer.diskStorage({
  destination:(req,file,cb)=>cb(null,UPLOAD_DIR),
  filename:(req,file,cb)=>cb(null,Date.now()+"-"+Math.random().toString(36).slice(2)+path.extname(file.originalname||""))
})});


// ===== FINAL FITUR USER FIX =====
function getDevice(req){
  return String(
    req.headers["x-user-id"] ||
    req.body?.userId ||
    req.body?.deviceId ||
    req.ip ||
    "unknown"
  ).replace(/[^a-zA-Z0-9_-]/g,"_");
}

function getPostPack(id){
  const posts=readPosts();
  const post=posts.find(x=>String(x.id)===String(id));
  return {posts,post};
}

function viewFix(req,res){
  const {posts,post}=getPostPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  const uid=getDevice(req);
  post.viewedBy=post.viewedBy||{};

  if(!post.viewedBy[uid]){
    post.viewedBy[uid]=true;
    post.views=Number(post.views||0)+1;
  }

  writePosts(posts);
  res.json(post);
}
app.post("/api/posts/:id/view",viewFix);
app.post("/api/view/:id",viewFix);

function likeFix(req,res){
  const {posts,post}=getPostPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  const uid=getDevice(req);
  post.likedBy=post.likedBy||{};

  if(!post.likedBy[uid]){
    post.likedBy[uid]=true;
    post.likes=Number(post.likes||0)+1;
  }

  writePosts(posts);
  res.json(post);
}
app.post("/api/posts/:id/like",likeFix);
app.post("/api/like/:id",likeFix);

function dislikeFix(req,res){
  const {posts,post}=getPostPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  const uid=getDevice(req);
  post.dislikedBy=post.dislikedBy||{};

  if(!post.dislikedBy[uid]){
    post.dislikedBy[uid]=true;
    post.dislikes=Number(post.dislikes||post.unlikes||0)+1;
    post.unlikes=post.dislikes;
  }

  writePosts(posts);
  res.json(post);
}
app.post("/api/posts/:id/dislike",dislikeFix);
app.post("/api/dislike/:id",dislikeFix);

function ratingFix(req,res){
  const {posts,post}=getPostPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  const val=Number(req.body.rating||req.body.value||req.body.star||0);
  if(val<1||val>5) return res.status(400).json({message:"Rating salah"});

  const uid=getDevice(req);
  post.ratingBy=post.ratingBy||{};
  post.ratingBy[uid]=val;

  const vals=Object.values(post.ratingBy).map(Number);
  post.ratingCount=vals.length;
  post.rating=vals.reduce((a,b)=>a+b,0)/vals.length;
  post.ratingAvg=post.rating.toFixed(1);

  writePosts(posts);
  res.json(post);
}
app.post("/api/posts/:id/rating",ratingFix);
app.post("/api/rating/:id",ratingFix);

function commentFix(req,res){
  const {posts,post}=getPostPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  const uid=getDevice(req);
  const text=String(req.body.text||req.body.comment||"").trim();
  const name=String(req.body.name||"User").trim();

  if(!text) return res.status(400).json({message:"Komentar kosong"});

  post.comments=Array.isArray(post.comments)?post.comments:[];
  post.comments.push({
    id:Date.now().toString(),
    name,
    text,
    userId:uid,
    isAdmin:false,
    replies:[],
    createdAt:new Date().toISOString()
  });

  writePosts(posts);
  res.json(post);
}
app.post("/api/posts/:id/comment",commentFix);
app.post("/api/comment/:id",commentFix);

function downloadFix(req,res){
  const {posts,post}=getPostPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  post.downloads=Number(post.downloads||0)+1;
  writePosts(posts);
  res.json(post);
}
app.post("/api/download/:id",downloadFix);
app.post("/api/posts/:id/download",downloadFix);

app.post("/api/unlock/:id",(req,res)=>{
  const {post}=getPostPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  const input=String(req.body.key||req.body.password||req.body.vipKey||"").trim();
  const real=String(post.key||post.vipKey||post.password||"").trim();

  if(real && input!==real){
    return res.status(401).json({message:"Password salah"});
  }

  res.json({
    ok:true,
    video:post.video || (post.videos&&post.videos[0]) || "",
    videos:post.videos || (post.video?[post.video]:[])
  });
});


// ===== FIX LIKE UNLIKE RATING FINAL =====
function getDeviceFinal(req){
  return String(req.headers["x-user-id"] || req.body?.userId || req.ip || "device").replace(/[^a-zA-Z0-9_-]/g,"_");
}

function getPostFinal(id){
  const posts = readPosts();
  const post = posts.find(p=>String(p.id)===String(id));
  return {posts,post};
}

function likeFinal(req,res){
  const {posts,post}=getPostFinal(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  const uid=getDeviceFinal(req);
  post.likedBy=post.likedBy || {};

  if(!post.likedBy[uid]){
    post.likedBy[uid]=true;
    post.likes=Number(post.likes||0)+1;
  }

  writePosts(posts);
  res.json(post);
}

function unlikeFinal(req,res){
  const {posts,post}=getPostFinal(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  const uid=getDeviceFinal(req);
  post.unlikedBy=post.unlikedBy || {};

  if(!post.unlikedBy[uid]){
    post.unlikedBy[uid]=true;
    post.unlikes=Number(post.unlikes||post.dislikes||0)+1;
    post.dislikes=post.unlikes;
  }

  writePosts(posts);
  res.json(post);
}

function ratingFinal(req,res){
  const {posts,post}=getPostFinal(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  const value=Number(req.body.rating || req.body.rate || req.body.value || req.body.star || 0);
  if(value<1 || value>5) return res.status(400).json({message:"Rating harus 1-5"});

  const uid=getDeviceFinal(req);
  post.ratingBy=post.ratingBy || {};
  post.ratingBy[uid]=value;

  const vals=Object.values(post.ratingBy).map(Number);
  post.ratingCount=vals.length;
  post.rating=vals.reduce((a,b)=>a+b,0)/vals.length;
  post.ratingAvg=post.rating.toFixed(1);

  writePosts(posts);
  res.json(post);
}

app.post("/api/fix/like/:id",likeFinal);
app.post("/api/fix/unlike/:id",unlikeFinal);
app.post("/api/fix/rating/:id",ratingFinal);

app.get("/api/posts",(req,res)=>res.json(readPosts()));
app.get("/api/admin/posts",(req,res)=>res.json(readPosts()));

app.post("/api/upload", upload.fields([
  {name:"thumbnail",maxCount:1},
  {name:"thumb",maxCount:1},
  {name:"video",maxCount:9}
]), (req,res)=>{
  const posts=readPosts();
  const thumb=req.files?.thumbnail?.[0] || req.files?.thumb?.[0];
  const videos=(req.files?.video||[]).map(v=>"/uploads/"+v.filename);

  if(!videos.length) return res.status(400).json({message:"Video wajib dipilih"});
  if(videos.length>9) return res.status(400).json({message:"Maksimal 9 video"});

  const post={
    id:Date.now().toString(),
    title:req.body.title||"Video",
    desc:req.body.desc||"",
    type:req.body.type||"public",
    key:req.body.key||"",
    thumb:thumb?"/uploads/"+thumb.filename:"",
    thumbnail:thumb?"/uploads/"+thumb.filename:"",
    video:videos[0],
    videos,
    views:0,
    likes:0,
    unlikes:0,
    dislikes:0,
    downloads:0,
    rating:0,
    ratingAvg:"0.0",
    ratingCount:0,
    comments:[],
    createdAt:new Date().toISOString()
  };

  posts.unshift(post);
  writePosts(posts);
  res.json({ok:true,post});
});

app.delete("/api/admin/posts/:id",(req,res)=>{
  writePosts(readPosts().filter(p=>p.id!==req.params.id));
  res.json({ok:true});
});













app.post("/api/admin/posts/:postId/comments/:i/reply",(req,res)=>{
  const posts=readPosts(); const p=posts.find(x=>x.id===req.params.postId);
  if(!p) return res.status(404).json({message:"Post tidak ditemukan"});
  const c=p.comments?.[Number(req.params.i)];
  if(!c) return res.status(404).json({message:"Komentar tidak ditemukan"});
  c.replies=Array.isArray(c.replies)?c.replies:[];
  c.replies.push({name:req.body.adminName||"Admin",text:req.body.text||"",role:req.body.role||"admin",avatar:req.body.avatar||"/uploads/admin.png",verified:true,createdAt:new Date().toISOString()});
  writePosts(posts); res.json(p);
});

app.delete("/api/admin/delete-comment/:postId/:i",(req,res)=>{
  const posts=readPosts(); const p=posts.find(x=>x.id===req.params.postId);
  if(!p) return res.status(404).json({message:"Post tidak ditemukan"});
  p.comments.splice(Number(req.params.i),1); writePosts(posts); res.json(p);
});

app.post("/api/role-login",(req,res)=>{
  const {key1,key2,role}=req.body||{};
  const admin=findAdmin(key1,key2,role);
  if(!admin) return res.status(401).json({message:"Login salah"});
  res.json({ok:true,admin,adminRole:admin.role,adminName:admin.name});
});



app.delete("/api/owner/accounts/:name",(req,res)=>{
  let admins=readAdmins().filter(a=>a.name!==req.params.name || a.role==="owner");
  writeAdmins(admins); res.json({ok:true,admins});
});

app.post("/api/admin/profile", upload.single("avatar"), (req,res)=>{
  const admins=readAdmins();
  const name=req.body.name||"Admin", key1=req.body.key1||"", key2=req.body.key2||"", role=req.body.role||"admin";
  const avatar=req.file?"/uploads/"+req.file.filename:"/uploads/admin.png";
  const old=admins.find(a=>a.name===name);
  if(old){ old.key1=key1; old.key2=key2; old.role=role; old.avatar=avatar; old.verified=true; }
  else admins.push({name,key1,key2,role,avatar,verified:true});
  writeAdmins(admins); res.json({ok:true,admins});
});





// ===== ADMIN LOGIN AUTO FIX =====
function clean(v){ return String(v || "").trim().toLowerCase(); }

function loginAdminAuto(req,res){
  const b = req.body || {};
  const k1 = clean(b.key1 || b.username || b.user || b.name);
  const k2 = clean(b.key2 || b.password || b.pass || b.sandi);

  const admin = readAdmins().find(a =>
    clean(a.key1) === k1 &&
    clean(a.key2) === k2 &&
    clean(a.role) === "admin"
  );

  if(!admin) return res.status(401).json({message:"Login salah"});
  res.json({ok:true,admin,adminRole:"admin",adminName:admin.name});
}

app.post("/api/admin/login", loginAdminAuto);
app.post("/api/login-admin", loginAdminAuto);
app.post("/api/login", loginAdminAuto);


app.post("/api/admin-login-final",(req,res)=>{
  const b=req.body||{};
  const key1=String(b.key1||"").trim().toLowerCase();
  const key2=String(b.key2||"").trim().toLowerCase();

  const admin=readAdmins().find(a=>
    String(a.key1||"").trim().toLowerCase()===key1 &&
    String(a.key2||"").trim().toLowerCase()===key2 &&
    String(a.role||"").trim().toLowerCase()==="admin"
  );

  if(!admin) return res.status(401).json({message:"Login salah"});
  res.json({ok:true,admin,adminRole:"admin",adminName:admin.name});
});


// ===== LOGIN ADMIN PASTI FIX =====
app.post("/api/admin-login-pasti",(req,res)=>{
  const b=req.body||{};
  const key1=String(b.key1||b.username||b.name||"").trim().toLowerCase();
  const key2=String(b.key2||b.password||b.pass||"").trim().toLowerCase();

  const admin=readAdmins().find(a=>
    String(a.name||"").trim().toLowerCase()===key1 &&
    String(a.key2||"").trim().toLowerCase()===key2 &&
    String(a.role||"").trim().toLowerCase()==="admin"
  );

  if(!admin) return res.status(401).json({message:"Login salah"});
  res.json({ok:true,admin,adminName:admin.name,adminRole:"admin"});
});


// ===== COMPAT ROUTES FIX =====







// ===== USER ACTION FIX FINAL =====
function uid(req){
  return String(req.headers["x-user-id"]||req.body?.userId||req.ip||"u").replace(/[^a-zA-Z0-9_-]/g,"_");
}
function pack(id){
  const posts=readPosts();
  return {posts,post:posts.find(p=>String(p.id)===String(id))};
}
app.post("/api/user/view/:id",(req,res)=>{
  const {posts,post}=pack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  const u=uid(req);
  post.viewedBy=post.viewedBy||{};
  if(!post.viewedBy[u]){
    post.viewedBy[u]=true;
    post.views=Number(post.views||0)+1;
  }
  writePosts(posts); res.json(post);
});
app.post("/api/user/like/:id",(req,res)=>{
  const {posts,post}=pack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  const u=uid(req);
  post.likedBy=post.likedBy||{};
  if(!post.likedBy[u]){
    post.likedBy[u]=true;
    post.likes=Number(post.likes||0)+1;
  }
  writePosts(posts); res.json(post);
});
app.post("/api/user/unlike/:id",(req,res)=>{
  const {posts,post}=pack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  const u=uid(req);
  post.unlikedBy=post.unlikedBy||{};
  if(!post.unlikedBy[u]){
    post.unlikedBy[u]=true;
    post.unlikes=Number(post.unlikes||post.dislikes||0)+1;
    post.dislikes=post.unlikes;
  }
  writePosts(posts); res.json(post);
});
app.post("/api/user/rating/:id",(req,res)=>{
  const {posts,post}=pack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  const val=Number(req.body.rating||req.body.value||req.body.star||0);
  if(val<1||val>5) return res.status(400).json({message:"Rating salah"});
  const u=uid(req);
  post.ratingBy=post.ratingBy||{};
  post.ratingBy[u]=val;
  const vals=Object.values(post.ratingBy).map(Number);
  post.ratingCount=vals.length;
  post.rating=vals.reduce((a,b)=>a+b,0)/vals.length;
  post.ratingAvg=post.rating.toFixed(1);
  writePosts(posts); res.json(post);
});
app.post("/api/user/unlock/:id",(req,res)=>{
  const {post}=pack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  const input=String(req.body.key||req.body.password||req.body.vipKey||"").trim();
  const real=String(post.key||post.vipKey||post.password||"").trim();
  if(real && input!==real) return res.status(401).json({message:"Kunci salah"});
  res.json({ok:true,post,video:post.video||(post.videos&&post.videos[0])||"",videos:post.videos||[]});
});


// ===== X USER FINAL FIX =====
function xReadPack(id){
  const posts = readPosts();
  const post = posts.find(p=>String(p.id)===String(id));
  return {posts,post};
}
function xUid(req){
  return String(req.headers["x-user-id"] || req.body?.userId || req.ip || "u").replace(/[^a-zA-Z0-9_-]/g,"_");
}

app.post("/api/x/view/:id",(req,res)=>{
  const {posts,post}=xReadPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  const uid=xUid(req);
  post.viewedBy=post.viewedBy||{};
  if(!post.viewedBy[uid]){
    post.viewedBy[uid]=true;
    post.views=Number(post.views||0)+1;
  }
  writePosts(posts);
  res.json(post);
});

app.post("/api/x/like/:id",(req,res)=>{
  const {posts,post}=xReadPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  const uid=xUid(req);
  post.likedBy=post.likedBy||{};
  if(!post.likedBy[uid]){
    post.likedBy[uid]=true;
    post.likes=Number(post.likes||0)+1;
  }
  writePosts(posts);
  res.json(post);
});

app.post("/api/x/unlike/:id",(req,res)=>{
  const {posts,post}=xReadPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  const uid=xUid(req);
  post.unlikedBy=post.unlikedBy||{};
  if(!post.unlikedBy[uid]){
    post.unlikedBy[uid]=true;
    post.unlikes=Number(post.unlikes||post.dislikes||0)+1;
    post.dislikes=post.unlikes;
  }
  writePosts(posts);
  res.json(post);
});

app.post("/api/x/rating/:id",(req,res)=>{
  const {posts,post}=xReadPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  const val=Number(req.body.rating||0);
  if(val<1||val>5) return res.status(400).json({message:"Rating salah"});
  const uid=xUid(req);
  post.ratingBy=post.ratingBy||{};
  post.ratingBy[uid]=val;
  const vals=Object.values(post.ratingBy).map(Number);
  post.ratingCount=vals.length;
  post.rating=vals.reduce((a,b)=>a+b,0)/vals.length;
  post.ratingAvg=post.rating.toFixed(1);
  writePosts(posts);
  res.json(post);
});

app.post("/api/x/unlock/:id",(req,res)=>{
  const {post}=xReadPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  const input=String(req.body.key||"").trim();
  const real=String(post.key||post.vipKey||post.password||"").trim();
  if(real && input!==real) return res.status(401).json({message:"Kunci salah"});
  res.json({ok:true,post,videos:post.videos||[post.video].filter(Boolean)});
});


// ===== LIKE UNLIKE LOCK FINAL =====
app.post("/api/z/like/:id",(req,res)=>{
  const posts=readPosts();
  const post=posts.find(p=>String(p.id)===String(req.params.id));
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  const uid=String(req.headers["x-user-id"]||req.ip).replace(/[^a-zA-Z0-9_-]/g,"_");

  post.likedBy=post.likedBy||{};
  post.unlikedBy=post.unlikedBy||{};

  if(post.unlikedBy[uid]){
    return res.status(400).json({message:"Kamu sudah unlike, tidak bisa like lagi"});
  }

  if(post.likedBy[uid]){
    return res.status(400).json({message:"Kamu sudah like"});
  }

  post.likedBy[uid]=true;
  post.likes=Number(post.likes||0)+1;

  writePosts(posts);
  res.json(post);
});

app.post("/api/z/unlike/:id",(req,res)=>{
  const posts=readPosts();
  const post=posts.find(p=>String(p.id)===String(req.params.id));
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  const uid=String(req.headers["x-user-id"]||req.ip).replace(/[^a-zA-Z0-9_-]/g,"_");

  post.likedBy=post.likedBy||{};
  post.unlikedBy=post.unlikedBy||{};

  if(post.likedBy[uid]){
    return res.status(400).json({message:"Kamu sudah like, tidak bisa unlike"});
  }

  if(post.unlikedBy[uid]){
    return res.status(400).json({message:"Kamu sudah unlike"});
  }

  post.unlikedBy[uid]=true;
  post.unlikes=Number(post.unlikes||post.dislikes||0)+1;
  post.dislikes=post.unlikes;

  writePosts(posts);
  res.json(post);
});


// ===== TIKTOK LIKE UNLIKE TOGGLE FINAL =====
function tPack(id){
  const posts=readPosts();
  const post=posts.find(p=>String(p.id)===String(id));
  return {posts,post};
}
function tUid(req){
  return String(req.headers["x-user-id"]||req.ip||"u").replace(/[^a-zA-Z0-9_-]/g,"_");
}

app.post("/api/t/like/:id",(req,res)=>{
  const {posts,post}=tPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  const uid=tUid(req);
  post.likedBy=post.likedBy||{};
  post.unlikedBy=post.unlikedBy||{};

  if(post.likedBy[uid]){
    delete post.likedBy[uid];
  }else{
    post.likedBy[uid]=true;
    delete post.unlikedBy[uid];
  }

  post.likes=Object.keys(post.likedBy).length;
  post.unlikes=Object.keys(post.unlikedBy).length;
  post.dislikes=post.unlikes;
  writePosts(posts);
  res.json(post);
});

app.post("/api/t/unlike/:id",(req,res)=>{
  const {posts,post}=tPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  const uid=tUid(req);
  post.likedBy=post.likedBy||{};
  post.unlikedBy=post.unlikedBy||{};

  if(post.unlikedBy[uid]){
    delete post.unlikedBy[uid];
  }else{
    post.unlikedBy[uid]=true;
    delete post.likedBy[uid];
  }

  post.likes=Object.keys(post.likedBy).length;
  post.unlikes=Object.keys(post.unlikedBy).length;
  post.dislikes=post.unlikes;
  writePosts(posts);
  res.json(post);
});

app.post("/api/t/download/:id",(req,res)=>{
  const {posts,post}=tPack(req.params.id);
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});
  post.downloads=Number(post.downloads||0)+1;
  writePosts(posts);
  res.json(post);
});


// ===== GLOBAL SYNC DATA FINAL =====
function syncPost(post){
  post.likedBy = post.likedBy || {};
  post.unlikedBy = post.unlikedBy || {};
  post.viewedBy = post.viewedBy || {};
  post.ratingBy = post.ratingBy || {};

  post.likes = Object.keys(post.likedBy).length;
  post.unlikes = Object.keys(post.unlikedBy).length;
  post.dislikes = post.unlikes;
  post.views = Object.keys(post.viewedBy).length;

  const vals = Object.values(post.ratingBy).map(Number);
  post.ratingCount = vals.length;
  post.rating = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
  post.ratingAvg = post.rating.toFixed(1);

  return post;
}


// ===== VIEW 1 DEVICE ONLY =====
app.post("/api/t/view/:id",(req,res)=>{
  const posts=readPosts();
  const post=posts.find(p=>String(p.id)===String(req.params.id));
  if(!post) return res.status(404).json({});

  const uid=String(req.headers["x-user-id"]||req.ip);
  post.viewedBy=post.viewedBy||{};

  if(!post.viewedBy[uid]){
    post.viewedBy[uid]=true;
  }

  syncPost(post);
  writePosts(posts);
  res.json(post);
});


// ===== COMMENT REPLY + USER DELETE FINAL =====
function cUid(req){
  return String(req.headers["x-user-id"] || req.body?.userId || req.ip || "u").replace(/[^a-zA-Z0-9_-]/g,"_");
}

app.post("/api/comment/reply/:postId/:i",(req,res)=>{
  const posts=readPosts();
  const post=posts.find(p=>String(p.id)===String(req.params.postId));
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  post.comments=Array.isArray(post.comments)?post.comments:[];
  const c=post.comments[Number(req.params.i)];
  if(!c) return res.status(404).json({message:"Komentar tidak ditemukan"});

  const text=String(req.body.text||"").trim();
  if(!text) return res.status(400).json({message:"Balasan kosong"});

  c.replies=Array.isArray(c.replies)?c.replies:[];
  c.replies.push({
    id:Date.now().toString(),
    name:req.body.name || "Admin",
    text,
    isAdmin:true,
    verified:true,
    avatar:"/uploads/admin.png",
    createdAt:new Date().toISOString()
  });

  writePosts(posts);
  res.json(post);
});

app.delete("/api/comment/user-delete/:postId/:i",(req,res)=>{
  const posts=readPosts();
  const post=posts.find(p=>String(p.id)===String(req.params.postId));
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  post.comments=Array.isArray(post.comments)?post.comments:[];
  const idx=Number(req.params.i);
  const c=post.comments[idx];
  if(!c) return res.status(404).json({message:"Komentar tidak ditemukan"});

  const uid=cUid(req);
  const owner=String(c.userId||"")===uid || String(c.deviceId||"")===uid;

  if(!owner){
    return res.status(403).json({message:"Kamu cuma bisa hapus komentar kamu sendiri"});
  }

  post.comments.splice(idx,1);
  writePosts(posts);
  res.json(post);
});


// ===== OWNER + LIKE FIX FINAL =====
app.get("/api/owner/accounts-final",(req,res)=>{
  res.json(readAdmins().map(a=>({
    name:a.name,
    role:a.role||"admin",
    status:a.status || (a.verified===false?"pending":"active")
  })));
});



app.patch("/api/owner/accounts-final/:name/status",(req,res)=>{
  const admins=readAdmins();
  const a=admins.find(x=>x.name==req.params.name);
  if(!a) return res.status(404).json({message:"Akun tidak ditemukan"});
  if(a.role==="owner") return res.status(400).json({message:"Owner tidak bisa diubah"});
  a.status=req.body.status;
  a.verified=a.status==="active";
  writeAdmins(admins);
  res.json({ok:true});
});

app.delete("/api/owner/accounts-final/:name",(req,res)=>{
  let admins=readAdmins();
  admins=admins.filter(x=>x.name!=req.params.name);
  writeAdmins(admins);
  res.json({ok:true});
});

// ===== LIKE UNLIKE =====
function getUid(req){
  return String(req.headers["x-user-id"]||req.ip||"u");
}

app.post("/api/final-like/:id",(req,res)=>{
  const posts=readPosts();
  const post=posts.find(p=>p.id==req.params.id);
  if(!post) return res.status(404).json({});
  const uid=getUid(req);

  post.likedBy=post.likedBy||{};
  post.unlikedBy=post.unlikedBy||{};

  if(post.likedBy[uid]) delete post.likedBy[uid];
  else{
    post.likedBy[uid]=true;
    delete post.unlikedBy[uid];
  }

  post.likes=Object.keys(post.likedBy).length;
  post.unlikes=Object.keys(post.unlikedBy).length;

  writePosts(posts);
  res.json(post);
});

app.post("/api/final-unlike/:id",(req,res)=>{
  const posts=readPosts();
  const post=posts.find(p=>p.id==req.params.id);
  if(!post) return res.status(404).json({});
  const uid=getUid(req);

  post.likedBy=post.likedBy||{};
  post.unlikedBy=post.unlikedBy||{};

  if(post.unlikedBy[uid]) delete post.unlikedBy[uid];
  else{
    post.unlikedBy[uid]=true;
    delete post.likedBy[uid];
  }

  post.likes=Object.keys(post.likedBy).length;
  post.unlikes=Object.keys(post.unlikedBy).length;

  writePosts(posts);
  res.json(post);
});


// ===== LOGIN ADMIN / MOD / OWNER FINAL =====
app.post("/api/admin-login-ownerfix",(req,res)=>{
  const {key1,key2}=req.body||{};
  const admins=readAdmins();

  const user = admins.find(a=>
    (String(a.name)===String(key1) && String(a.key2)===String(key2)) ||
    (String(a.key1)===String(key1) && String(a.key2)===String(key2))
  );

  if(!user) return res.status(401).json({message:"Login salah"});

  const status = user.status || (user.verified===false?"pending":"active");

  if(status==="pending") return res.status(403).json({message:"Akun masih pending"});
  if(status==="kicked") return res.status(403).json({message:"Akun sudah dikick owner"});

  res.json({ok:true,role:user.role||"admin",name:user.name});
});

// ===== HAPUS KOMENTAR (MOD / ADMIN) =====
app.delete("/api/admin/comment/:id/:idx",(req,res)=>{
  const {id,idx}=req.params;
  const posts=readPosts();

  const post = posts.find(p=>String(p.id)===String(id));
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  post.comments = post.comments || [];

  if(!post.comments[idx]) return res.status(404).json({message:"Komentar tidak ada"});

  post.comments.splice(Number(idx),1);

  writePosts(posts);

  res.json({ok:true});
});


// ===== UPLOAD MAX 9 VIDEO FINAL =====
app.post("/api/upload", upload.fields([
  {name:"thumbnail",maxCount:1},
  {name:"video",maxCount:9}
]), (req,res)=>{
  const posts=readPosts();

  const thumb=req.files?.thumbnail?.[0];
  const videos=(req.files?.video||[]).map(v=>"/uploads/"+v.filename);

  if(!videos.length) return res.status(400).json({message:"Pilih video"});
  if(videos.length>9) return res.status(400).json({message:"Maksimal 9 video"});

  const post={
    id:Date.now().toString(),
    title:req.body.title||"Video",
    thumb:thumb?"/uploads/"+thumb.filename:"",
    video:videos[0],
    videos,
    like:0,
    unlike:0,
    views:0,
    comments:[]
  };

  posts.unshift(post);
  writePosts(posts);

  res.json({ok:true});
});

// ===== LIKE / UNLIKE FINAL =====
function getUid(req){
  return String(req.headers["x-user-id"]||req.ip||"u");
}

app.post("/api/react/:id",(req,res)=>{
  const {type}=req.body;
  const posts=readPosts();
  const p=posts.find(x=>x.id==req.params.id);

  if(!p) return res.status(404).end();

  p.likedBy=p.likedBy||{};
  p.unlikedBy=p.unlikedBy||{};

  const uid=getUid(req);

  if(type==="like"){
    if(p.likedBy[uid]) delete p.likedBy[uid];
    else{
      p.likedBy[uid]=true;
      delete p.unlikedBy[uid];
    }
  }

  if(type==="unlike"){
    if(p.unlikedBy[uid]) delete p.unlikedBy[uid];
    else{
      p.unlikedBy[uid]=true;
      delete p.likedBy[uid];
    }
  }

  p.like=Object.keys(p.likedBy).length;
  p.unlike=Object.keys(p.unlikedBy).length;

  writePosts(posts);
  res.json(p);
});


// ===== LOGIN STATUS REAL FIX =====
app.post("/api/login-role-real",(req,res)=>{
  const {key1,key2}=req.body||{};
  const admins=readAdmins();

  const a=admins.find(x=>
    (String(x.name)===String(key1) && String(x.key2)===String(key2)) ||
    (String(x.key1)===String(key1) && String(x.key2)===String(key2))
  );

  if(!a) return res.status(401).json({message:"Login salah"});

  const status=a.status || (a.verified===false ? "pending" : "active");

  if(status==="pending") return res.status(403).json({message:"Akun masih PENDING"});
  if(status==="kicked") return res.status(403).json({message:"Akun sudah di-KICK owner"});

  res.json({ok:true,adminName:a.name,role:a.role||"admin",status});
});

app.get("/api/account-status/:name",(req,res)=>{
  const admins=readAdmins();
  const a=admins.find(x=>String(x.name)===String(req.params.name));
  if(!a) return res.status(404).json({message:"Akun tidak ditemukan"});
  const status=a.status || (a.verified===false ? "pending" : "active");
  res.json({ok:true,name:a.name,role:a.role||"admin",status});
});


// ===== OWNER CREATE ACCOUNT FIX =====
app.post("/api/owner/accounts-final",(req,res)=>{
  const {name,key1,key2,role}=req.body||{};

  if(!name||!key1||!key2){
    return res.status(400).json({message:"Nama, key1, key2 wajib diisi"});
  }

  const admins=readAdmins();
  const idx=admins.findIndex(a=>String(a.name).toLowerCase()===String(name).toLowerCase());

  const data={
    name:String(name).trim(),
    key1:String(key1).trim(),
    key2:String(key2).trim(),
    role:role||"admin",
    status:"active",
    verified:true
  };

  if(idx>=0){
    admins[idx]={...admins[idx],...data};
  }else{
    admins.push(data);
  }

  writeAdmins(admins);
  res.json({ok:true,message:"Akun tersimpan",account:data});
});


// ===== OWNER ACCOUNT FINAL FIX =====
app.get("/api/owner/accounts-final",(req,res)=>{
  const admins=readAdmins();
  if(!admins.find(a=>a.role==="owner")){
    admins.unshift({
      name:"Owner",
      key1:"xyron",
      key2:"store123",
      role:"owner",
      status:"active",
      verified:true
    });
    writeAdmins(admins);
  }

  res.json(readAdmins().map(a=>({
    name:a.name,
    role:a.role||"admin",
    status:a.status || (a.verified===false ? "pending" : "active")
  })));
});

app.post("/api/owner/accounts-final",(req,res)=>{
  const {name,key1,key2,role}=req.body||{};

  if(!name || !key1 || !key2){
    return res.status(400).json({message:"Data belum lengkap"});
  }

  const admins=readAdmins();
  const idx=admins.findIndex(a=>String(a.name).toLowerCase()===String(name).toLowerCase());

  const acc={
    name:String(name).trim(),
    key1:String(key1).trim(),
    key2:String(key2).trim(),
    role:role||"admin",
    status:"active",
    verified:true
  };

  if(idx>=0){
    admins[idx]={...admins[idx],...acc};
  }else{
    admins.push(acc);
  }

  writeAdmins(admins);
  res.json({ok:true,account:acc});
});

app.patch("/api/owner/accounts-final/:name/status",(req,res)=>{
  const admins=readAdmins();
  const acc=admins.find(a=>String(a.name)===String(req.params.name));

  if(!acc) return res.status(404).json({message:"Akun tidak ditemukan"});
  if(acc.role==="owner") return res.status(400).json({message:"Owner tidak bisa diubah"});

  acc.status=req.body.status || "active";
  acc.verified=acc.status==="active";

  writeAdmins(admins);
  res.json({ok:true});
});

app.delete("/api/owner/accounts-final/:name",(req,res)=>{
  let admins=readAdmins();
  admins=admins.filter(a=>String(a.name)!==String(req.params.name) || a.role==="owner");
  writeAdmins(admins);
  res.json({ok:true});
});



// ===== LOGIN REAL ADMIN MOD OWNER =====
app.post("/api/admin-login-real",(req,res)=>{
  const {name,key}=req.body||{};
  const admins=readAdmins();

  const acc=admins.find(a =>
    String(a.name||"").toLowerCase() === String(name||"").toLowerCase()
  );

  if(!acc) return res.status(404).json({message:"Akun tidak ditemukan"});
  if(acc.status==="pending") return res.status(403).json({message:"Akun masih PENDING"});
  if(acc.status==="kicked") return res.status(403).json({message:"Akun di KICK"});

  const okKey =
    String(acc.key1||"") === String(key||"") ||
    String(acc.key2||"") === String(key||"");

  if(!okKey) return res.status(401).json({message:"Key salah"});

  res.json({
    ok:true,
    name:acc.name,
    role:acc.role||"admin",
    status:acc.status||"active"
  });
});


// ===== CHECK ACCOUNT STATUS REALTIME =====
app.get("/api/check-account-status/:name",(req,res)=>{
  const admins=readAdmins();
  const acc=admins.find(a=>String(a.name).toLowerCase()===String(req.params.name).toLowerCase());

  if(!acc) return res.status(404).json({message:"Akun tidak ditemukan"});

  res.json({
    ok:true,
    name:acc.name,
    role:acc.role||"admin",
    status:acc.status || (acc.verified===false ? "pending" : "active")
  });
});


// ===== ADMIN/MOD REPLY COMMENT =====
app.post("/api/admin/comments/:postId/:index/reply",(req,res)=>{
  const adminName=req.headers["x-admin-name"];
  const {reply}=req.body||{};

  if(!adminName) return res.status(401).json({message:"Unauthorized"});
  if(!reply) return res.status(400).json({message:"Reply kosong"});

  const admins=readAdmins();
  const acc=admins.find(a=>
    String(a.name).toLowerCase()===String(adminName).toLowerCase() &&
    (a.status||"active")==="active"
  );

  if(!acc) return res.status(403).json({message:"Akun tidak aktif"});

  const posts=readPosts();
  const post=posts.find(p=>String(p.id)===String(req.params.postId));
  if(!post) return res.status(404).json({message:"Post tidak ditemukan"});

  const idx=Number(req.params.index);
  if(!post.comments || !post.comments[idx]){
    return res.status(404).json({message:"Komentar tidak ditemukan"});
  }

  post.comments[idx].reply={
    name:acc.name,
    role:acc.role||"admin",
    text:String(reply).trim(),
    at:new Date().toISOString()
  };

  writePosts(posts);
  res.json({ok:true,reply:post.comments[idx].reply});
});


// ===== ADMIN UPLOAD VIDEO MAX 9 =====
const adminUpload = multer({
  dest: path.join(__dirname,"uploads"),
  limits:{ fileSize: 300 * 1024 * 1024 }
});

app.post("/api/admin/upload-final",
  adminUpload.fields([
    {name:"thumb",maxCount:1},
    {name:"videos",maxCount:9}
  ]),
  (req,res)=>{
    const adminName=req.headers["x-admin-name"];
    if(!adminName) return res.status(401).json({message:"Unauthorized"});

    const admins=readAdmins();
    const acc=admins.find(a=>
      String(a.name).toLowerCase()===String(adminName).toLowerCase() &&
      (a.status||"active")==="active"
    );

    if(!acc) return res.status(403).json({message:"Admin tidak aktif"});

    const {title,desc,type,key}=req.body||{};
    const thumb=req.files?.thumb?.[0];
    const videos=req.files?.videos||[];

    if(!title) return res.status(400).json({message:"Judul wajib"});
    if(!thumb) return res.status(400).json({message:"Thumbnail wajib"});
    if(videos.length<1) return res.status(400).json({message:"Video wajib"});
    if(videos.length>9) return res.status(400).json({message:"Maksimal 9 video"});

    const posts=readPosts();
    const created=[];

    videos.forEach((v,i)=>{
      const id=Date.now().toString()+Math.floor(Math.random()*9999);
      const post={
        id,
        title: videos.length>1 ? `${title} ${i+1}` : title,
        desc:desc||"",
        type:type||"public",
        key:key||"",
        thumb:"/uploads/"+thumb.filename,
        video:"/uploads/"+v.filename,
        views:0,
        likes:0,
        unlikes:0,
        downloads:0,
        comments:[],
        createdAt:new Date().toISOString(),
        uploader:adminName
      };
      posts.unshift(post);
      created.push(post);
    });

    writePosts(posts);
    res.json({ok:true,count:created.length,posts:created});
  }
);

app.listen(PORT,"0.0.0.0",()=>console.log("🔥 Web aktif di http://localhost:"+PORT));
